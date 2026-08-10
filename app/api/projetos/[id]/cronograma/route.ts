import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/database'
import { CronogramaRepository } from '@/lib/repositories'
import { registrarAuditoria } from '@/lib/db/auditoria'
import { apiLogger } from '@/lib/logger'
import { registrarEvento, type EventoTimeline, type OrigemTimeline } from '@/lib/timeline'
import { parsearExcelCronograma, DEFAULT_RESPONSAVEL_IMPORTACAO } from '@/lib/importadores/cronograma-excel'
import { calcularDuracao } from '@/lib/utils/date'

// ─── WBS Auto-generation ─────────────────────────────────────────────────────

interface TarefaInput {
  nome: string
  nivel?: string
  tipo?: string
  criticidade?: string
  tipo_macro?: string | null
  data_inicio?: string | null
  data_fim?: string | null
  duracao_dias?: number | null
  responsavel_id?: number | null
  responsavel_nome_ext?: string | null
  executor_id?: number | null
  executor_nome_ext?: string | null
  area_id?: number | null
  ordem?: number
  peso?: number
  /**
   * Posição (1-based `ordem`) do item pai neste mesmo array.
   * Vem do parser Excel (TarefaParseada.parentOrdinal).
   * É resolvido para o DB id real dentro da transação de INSERT.
   */
  parentOrdinal?: number | null
  prazo_status?: string | null
  /** Múltiplos responsáveis — nomes (podem incluir texto livre) */
  responsaveis_nomes?: string[]
}

/**
 * Gera WBS automaticamente a partir de uma lista ordenada de tarefas.
 * O servidor é a fonte oficial do WBS — o cliente pode sugerir mas é recalculado.
 */
function calcularWBS(tarefas: TarefaInput[]): string[] {
  let faseCount     = 0
  let tarefaCount   = 0
  let subtarefaCount = 0
  let rootCount     = 0

  return tarefas.map(t => {
    if (t.nivel === 'FASE') {
      faseCount++; tarefaCount = 0; subtarefaCount = 0
      return String(faseCount)
    }
    if (t.nivel === 'SUBTAREFA') {
      subtarefaCount++
      if (faseCount > 0 && tarefaCount > 0) return `${faseCount}.${tarefaCount}.${subtarefaCount}`
      if (tarefaCount > 0) return `${tarefaCount}.${subtarefaCount}`
      return `${rootCount}.${subtarefaCount}`
    }
    // TAREFA
    subtarefaCount = 0
    if (faseCount > 0) { tarefaCount++; return `${faseCount}.${tarefaCount}` }
    rootCount++; return String(rootCount)
  })
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const { id } = await params
    const projetoId = Number(id)

    const versoes = CronogramaRepository.findAllVersoes(projetoId)

    const cronogramaIdParam = new URL(request.url).searchParams.get('cronogramaId')
    let cronograma

    if (cronogramaIdParam) {
      cronograma = CronogramaRepository.findByIdAndProjetoId(Number(cronogramaIdParam), projetoId)
    } else {
      cronograma = CronogramaRepository.findLatestByProjectId(projetoId)
    }

    if (!cronograma) return NextResponse.json({ cronograma: null, tarefas: [], versoes })

    const cronogramaId = cronograma.id

    const tarefas = CronogramaRepository.findTasks(cronogramaId) as unknown as Record<string, unknown>[]

    const respRows = CronogramaRepository.findResponsaveisForCronograma(cronogramaId)

    const respMap = new Map<number, { id?: number; nome: string }[]>()
    for (const r of respRows) {
      const arr = respMap.get(r.cronograma_tarefa_id) ?? []
      arr.push({ id: r.usuario_id ?? undefined, nome: r.nome })
      respMap.set(r.cronograma_tarefa_id, arr)
    }

    const tarefasComResp = tarefas.map(t => ({
      ...t,
      responsaveis: respMap.get(t.id as number) ?? null,
    }))

    return NextResponse.json({ cronograma, tarefas: tarefasComResp, versoes })
  } catch (err: unknown) {
    apiLogger.error({ err, route: 'CRONOGRAMA GET' }, 'Erro não tratado')
    return NextResponse.json(
      { error: 'Erro interno ao buscar cronograma.' },
      { status: 500 }
    )
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Guarda-chuva externo: qualquer falha não tratada retorna JSON, nunca body vazio
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const { id } = await params
    const projetoId = Number(id)

    const contentType = request.headers.get('content-type') ?? ''
    const isExcel = contentType.includes('multipart/form-data')

    let label:   string  = ''
    let modo:    string  = 'CENTRALIZADO'
    let fonte:   string  = 'MANUAL'
    let arquivo: string  = ''
    let acao:    string  = 'NOVA_VERSAO'
    let tarefas: TarefaInput[] = []
    let importWarnings: string[] = []
    let importStats: {
      linhasLidas: number; fasesCriadas: number; tarefasCriadas: number
      subtarefasCriadas: number; tarefasDescartadas: number; errosPorLinha?: unknown[]
    } = { linhasLidas: 0, fasesCriadas: 0, tarefasCriadas: 0, subtarefasCriadas: 0, tarefasDescartadas: 0 }

    // ── Importação Excel ──────────────────────────────────────────────────────
    if (isExcel) {
      const formData = await request.formData()
      const file = formData.get('file')
      if (!file || !(file instanceof Blob)) {
        return NextResponse.json({ error: 'Arquivo não enviado.' }, { status: 400 })
      }

      arquivo = (file as File).name ?? 'planilha.xlsx'
      acao    = formData.get('acao')?.toString() === 'SUBSTITUIR' ? 'SUBSTITUIR' : 'NOVA_VERSAO'
      label   = formData.get('label')?.toString() || ''
      modo    = 'IMPORTADO'
      fonte   = 'EXCEL'

      // Responsável padrão lido do banco — NUNCA usa session.id como fallback
      const cfgResp = CronogramaRepository.findConfigResponsavelPadrao()
      const responsavelPadraoId = cfgResp?.valor ? Number(cfgResp.valor) : (DEFAULT_RESPONSAVEL_IMPORTACAO)
      const defaultResponsavelId: number | null = responsavelPadraoId

      let resultado
      try {
        const buffer = await file.arrayBuffer()
        const usuarios = CronogramaRepository.findUsuariosAtivos()
        resultado = parsearExcelCronograma(buffer, usuarios, { defaultResponsavelId })
      } catch (e: unknown) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : 'Erro ao processar o arquivo Excel.' },
          { status: 422 }
        )
      }

      // Erros fatais (layout inválido) impedem qualquer importação
      if (resultado.errosFatais && resultado.errosFatais.length > 0) {
        return NextResponse.json(
          {
            error:    resultado.errosFatais[0],
            detalhes: resultado.errosFatais,
          },
          { status: 422 }
        )
      }

      // Sem nenhuma tarefa importável
      if (resultado.importadas === 0) {
        return NextResponse.json(
          {
            error:       'Nenhuma linha válida encontrada na planilha.',
            linhasLidas: resultado.linhasLidas,
            ignoradas:   resultado.ignoradas,
            erros:       resultado.erros,
            warnings:    resultado.warnings,
          },
          { status: 422 }
        )
      }

      tarefas        = resultado.tarefas
      importWarnings = resultado.warnings
      importStats    = {
        linhasLidas:        resultado.linhasLidas,
        fasesCriadas:       resultado.fasesCriadas,
        tarefasCriadas:     resultado.tarefasCriadas,
        subtarefasCriadas:  resultado.subtarefasCriadas,
        tarefasDescartadas: resultado.ignoradas,
        errosPorLinha:      resultado.erros,
      }

    // ── Entrada manual (JSON) ─────────────────────────────────────────────────
    } else {
      const body: { label?: string; modo?: string; fonte_importacao?: string; tarefas?: TarefaInput[] } =
        await request.json()

      label   = body.label   ?? ''
      modo    = body.modo    ?? 'CENTRALIZADO'
      fonte   = body.fonte_importacao ?? 'MANUAL'
      tarefas = body.tarefas ?? []

      for (let i = 0; i < tarefas.length; i++) {
        const t = tarefas[i]
        if (!t.responsavel_id) {
          return NextResponse.json(
            { error: `Tarefa "${t.nome || `#${i + 1}`}" deve ter um responsável.` },
            { status: 400 }
          )
        }
      }
    }

    // ── Versão alvo ───────────────────────────────────────────────────────────
    const cronogramaAtual = CronogramaRepository.findAtivoSimples(projetoId)

    const isSobrepor = acao === 'SUBSTITUIR' && !!cronogramaAtual

    const maxVersao = CronogramaRepository.maxVersao(projetoId)

    const nextVersao = isSobrepor ? (cronogramaAtual?.versao ?? maxVersao) : maxVersao + 1
    const labelFinal = label.trim() || `Versão ${nextVersao}`

    // ── WBS server-side ───────────────────────────────────────────────────────
    const wbsCodes = calcularWBS(tarefas)

    // Lookup map: nome → id (case-insensitive, partial match)
    const usuariosMap = CronogramaRepository.findUsuariosAtivos()
    function resolveUserId(nome: string): number | null {
      const q = nome.trim().toLowerCase()
      const exato = usuariosMap.find(u => u.nome.toLowerCase() === q)
      if (exato) return exato.id
      if (q.length >= 5) {
        const parcial = usuariosMap.find(u => u.nome.toLowerCase().includes(q) || q.includes(u.nome.toLowerCase()))
        if (parcial) return parcial.id
      }
      return null
    }

    // ── Pré-calcular strings de evento (fora da transação) ───────────────────
    const eventoEvento: EventoTimeline = isExcel ? 'CRONOGRAMA_IMPORTADO' : 'CRIADO'
    const eventoTitulo    = isExcel
      ? (isSobrepor
          ? `Cronograma V${nextVersao} substituído (${arquivo})`
          : `Cronograma V${nextVersao} importado (${arquivo})`)
      : `Cronograma V${nextVersao} criado`
    const eventoDescricao = isExcel
      ? [
          `Arquivo: ${arquivo}`,
          `Linhas lidas: ${importStats.linhasLidas}`,
          `Fases: ${importStats.fasesCriadas}`,
          `Tarefas: ${importStats.tarefasCriadas}`,
          `Warnings: ${importWarnings.length}`,
          ...(isSobrepor ? ['Modo: Substituição'] : []),
        ].join(' · ')
      : `Modo: ${modo} · ${tarefas.length} item(ns)`
    const eventoOrigem: OrigemTimeline = isExcel ? 'IMPORTACAO' : 'MANUAL'

    const auditoriaDescricao = isExcel
      ? (isSobrepor
          ? `Cronograma V${nextVersao} substituído via "${arquivo}" (${importStats.tarefasCriadas} tarefa(s))`
          : `Cronograma V${nextVersao} importado de "${arquivo}" (${importStats.tarefasCriadas} tarefa(s))`)
      : `Cronograma V${nextVersao} criado (${modo})`
    const auditoriaJson = JSON.stringify(
      isExcel
        ? { versao: nextVersao, modo, arquivo, acao, ...importStats, warnings: importWarnings.length }
        : { versao: nextVersao, modo, tarefas: tarefas.length }
    )

    // ── Transação atômica ─────────────────────────────────────────────────────
    let cronogramaId  = 0
    let tarefasSalvas = 0

    try {
      db.transaction(() => {
        if (isSobrepor && cronogramaAtual) {
          // Modo SUBSTITUIR: reutiliza o cronograma existente
          cronogramaId = cronogramaAtual.id
          CronogramaRepository.softDeleteTarefas(cronogramaId)
          CronogramaRepository.updateLabelFonte(cronogramaId, labelFinal, fonte, arquivo || null)
        } else {
          // Modo NOVA_VERSAO: cria novo registro de cronograma
          cronogramaId = Number(CronogramaRepository.insertCronograma({
            projeto_id: projetoId,
            versao: nextVersao,
            label: labelFinal,
            modo,
            fonte_importacao: fonte,
            arquivo_origem: arquivo || undefined,
            criado_por: session.id,
          }))
        }

        // Inserir tarefas
        // ordemToId: mapeia ordem (1-based) → DB id inserido, para resolver parent_id
        const ordemToId = new Map<number, number>()

        for (let i = 0; i < tarefas.length; i++) {
          const t          = tarefas[i] as typeof tarefas[0] & {
            descricao?: string | null
            percentual?: number
            status_tarefa?: string
            observacoes?: string | null
            parentOrdinal?: number | null
          }
          const executorId = t.executor_id ?? t.responsavel_id
          const duracao    = t.duracao_dias ?? calcularDuracao(t.data_inicio, t.data_fim)
          const ordemValue = t.ordem ?? i + 1

          // Resolve parent_id a partir do parentOrdinal gerado pelo parser Excel
          const parentId = (t.parentOrdinal != null)
            ? (ordemToId.get(t.parentOrdinal) ?? null)
            : null

          const nowISO   = new Date().toISOString().replace('T', ' ').slice(0, 19)
          const today    = nowISO.slice(0, 10)   // 'YYYY-MM-DD'
          const tParsed  = t as { data_conclusao?: string | null }

          // Tarefa com data_fim futura e sem data real de conclusão não pode ser
          // considerada concluída — rebaixar para EM_ANDAMENTO evita que planilhas
          // com datas planejadas no futuro apareçam como "Concluída no prazo".
          const temDataRealConclusao = !!tParsed.data_conclusao
          const dataFimFutura        = !!t.data_fim && t.data_fim > today
          const statusRaw            = t.status_tarefa ?? 'PENDENTE'
          const statusFinal          = statusRaw === 'CONCLUIDA' && dataFimFutura && !temDataRealConclusao
            ? 'EM_ANDAMENTO'
            : statusRaw

          const prazoFinal = statusFinal === 'CONCLUIDA' ? (t.prazo_status ?? null) : null

          // Prioridade: (1) data real da planilha, (2) data_fim planejada se for passada
          // (assume concluída no prazo), (3) nowISO como último recurso.
          // Não usar data_fim futura como data_conclusao: task ainda não foi concluída.
          const dataFimPassada = t.data_fim && t.data_fim <= today ? t.data_fim : null
          const dataConclusao  = statusFinal === 'CONCLUIDA'
            ? (tParsed.data_conclusao ?? dataFimPassada ?? nowISO)
            : null

          const tarefaDbId = Number(CronogramaRepository.insertTarefa({
            cronograma_id:        cronogramaId,
            parent_id:            parentId,
            codigo:               wbsCodes[i],
            nome:                 t.nome,
            descricao:            t.descricao ?? null,
            nivel:                t.nivel ?? 'TAREFA',
            tipo:                 t.tipo ?? 'TAREFA',
            criticidade:          t.criticidade ?? 'NORMAL',
            data_inicio:          t.data_inicio ?? null,
            data_fim:             t.data_fim ?? null,
            duracao_dias:         duracao,
            responsavel_id:       t.responsavel_id ?? null,
            responsavel_nome_ext: (t as TarefaInput).responsavel_nome_ext ?? null,
            executor_id:          executorId ?? null,
            executor_nome_ext:    (t as TarefaInput).executor_nome_ext ?? null,
            area_id:              t.area_id ?? null,
            peso:                 t.peso ?? 1,
            ordem:                ordemValue,
            percentual:           t.percentual ?? 0,
            status:               statusFinal,
            prazo_status:         prazoFinal,
            data_conclusao:       dataConclusao,
            observacoes:          t.observacoes ?? null,
            tipo_macro:           t.nivel === 'FASE' ? (t.tipo_macro ?? 'OUTRO') : null,
            criado_por:           session.id,
            alterado_por:         session.id,
          }))

          ordemToId.set(ordemValue, tarefaDbId)

          // Inserir responsáveis na tabela N:N
          const tFull = t as typeof tarefas[0] & { responsaveis_nomes?: string[] }
          let nomes: string[] = tFull.responsaveis_nomes ?? []
          if (nomes.length === 0) {
            const nm = (t as TarefaInput).responsavel_nome_ext
            if (nm) nomes = [nm]
            else if (t.responsavel_id) {
              const u = usuariosMap.find(u => u.id === t.responsavel_id)
              if (u) nomes = [u.nome]
            }
          }
          for (const nome of nomes) {
            const uid = resolveUserId(nome)
            CronogramaRepository.insertResponsavel(tarefaDbId, uid, uid ? null : nome.trim())
          }
        }

        // Verificar COUNT dentro da transação — ROLLBACK se 0 (safety net)
        const count = CronogramaRepository.countTarefas(cronogramaId)
        if (count === 0 && tarefas.length > 0) {
          throw new Error(`Nenhuma tarefa foi persistida para o cronograma id=${cronogramaId}`)
        }
        tarefasSalvas = count

        registrarEvento({
          projeto_id:      projetoId,
          modulo:          'CRONOGRAMA',
          artefato:        'CRONOGRAMA',
          evento:          eventoEvento,
          titulo:          eventoTitulo,
          descricao:       eventoDescricao,
          origem:          eventoOrigem,
          usuario_id:      session.id,
          usuario_nome:    session.nome,
          referencia_id:   cronogramaId,
          referencia_tipo: 'cronograma',
        })

        registrarAuditoria({
          usuario_id:   session.id,
          usuario_nome: session.nome,
          acao:         isExcel ? 'IMPORT' : 'CREATE',
          entidade:     'cronogramas',
          entidade_id:  cronogramaId,
          projeto_id:   projetoId,
          descricao:    auditoriaDescricao,
          dados_depois: JSON.parse(auditoriaJson),
        })
      })
    } catch (txErr: unknown) {
      return NextResponse.json(
        {
          error: txErr instanceof Error
            ? txErr.message
            : 'Erro ao persistir o cronograma. Tente novamente.',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok:           true,
      cronogramaId,
      versao:       nextVersao,
      tarefasSalvas,
      ...(isExcel
        ? {
            arquivo,
            ...importStats,
            warnings: importWarnings,
          }
        : {}),
    })

  } catch (fatalErr: unknown) {
    // Guarda-chuva final: garante que NUNCA retornamos body vazio
    apiLogger.error({ err: fatalErr, route: 'CRONOGRAMA POST' }, 'ERRO FATAL não tratado')
    return NextResponse.json(
      { error: 'Erro interno no servidor. Verifique os logs.' },
      { status: 500 }
    )
  }
}
