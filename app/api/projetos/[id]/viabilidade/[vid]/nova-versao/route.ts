import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import { db } from '@/lib/database'
import { ViabilidadeRepository } from '@/lib/repositories'
import { registrarAuditoria } from '@/lib/db/auditoria'
import { registrarEvento } from '@/lib/timeline'

const CAMPOS_COPIA = [
  'selic', 'taxa_desconto', 'inflacao',
  'investimento_total', 'receitas_previstas', 'custos_previstos', 'economia_prevista',
  'roi', 'tir', 'payback_meses',
  'impacto_operacional', 'recursos_necessarios', 'mudanca_processo',
  'tecnologias', 'integrações', 'infraestrutura', 'riscos', 'impactos',
  'data_inicio_prev', 'data_fim_prev', 'marcos',
  'resumo_executivo', 'sistemas_envolvidos', 'dependencia_fornecedores',
  'recomendacao', 'justificativa_recomendacao', 'conclusao',
  'capex', 'opex', 'opex_periodicidade',
  'economia_estimada', 'economia_periodicidade',
  'tipo_payback', 'payback_informado', 'payback_unidade',
  'condicoes_aprovacao', 'complexidade_tecnica',
  'baseline_valor', 'meta_valor', 'tipo_indicador', 'economia_mensal_esperada',
]

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; vid: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'PMO')) {
    return NextResponse.json({ error: 'Sem permissão. Apenas PMO ou Admin.' }, { status: 403 })
  }

  const { id, vid } = await params
  const projeto_id = Number(id)
  const via_id = Number(vid)

  const viabilidade = ViabilidadeRepository.findByIdAndProjetoId(via_id, projeto_id)
  if (!viabilidade) {
    return NextResponse.json({ error: 'Viabilidade não encontrada.' }, { status: 404 })
  }
  if (viabilidade.status !== 'APROVADO') {
    return NextResponse.json(
      { error: 'Apenas viabilidades com status APROVADO podem gerar uma nova versão.' },
      { status: 400 }
    )
  }

  const novaVersao = (viabilidade.versao) + 1

  const novaViaId = db.transaction(() => {
    const vals: Record<string, unknown> = {
      projeto_id,
      versao: novaVersao,
      status: 'RASCUNHO',
      criado_por: session.id,
    }
    for (const campo of CAMPOS_COPIA) {
      const key = campo.replace(/[^a-zA-Z0-9_]/g, '_')
      vals[key] = (viabilidade as unknown as Record<string, unknown>)[campo] ?? null
    }

    const novoId = ViabilidadeRepository.insertCopia(vals)

    const grupos = ViabilidadeRepository.findGruposAtivos(projeto_id)
    for (const grupo of grupos) {
      const itens = ViabilidadeRepository.findItensGrupoAtivos(grupo.id as number)
      ViabilidadeRepository.softDeleteItensGrupo(grupo.id as number)
      ViabilidadeRepository.softDeleteGrupo(grupo.id as number)

      const novoGrupoId = ViabilidadeRepository.insertGrupo({
        projeto_id,
        viabilidade_id: novoId,
        tipo: grupo.tipo,
        nome: grupo.nome,
        cor: grupo.cor,
        icone: grupo.icone,
        ordem: grupo.ordem,
        criado_por: session.id,
      })

      for (const item of itens) {
        ViabilidadeRepository.insertItemOrcamento({
          grupo_id: novoGrupoId,
          projeto_id,
          nome: item.nome,
          descricao: item.descricao,
          conta_contabil_id: item.conta_contabil_id,
          centro_custo_id: item.centro_custo_id,
          valor_aprovado: item.valor_aprovado,
          valor_revisado: item.valor_revisado,
          status: item.status,
          prioridade: item.prioridade,
          responsavel_usuario_id: item.responsavel_usuario_id,
          ordem: item.ordem,
          criado_por: session.id,
        })
      }
    }

    return novoId
  })

  registrarEvento({
    projeto_id,
    modulo: 'VIABILIDADE',
    artefato: 'VIABILIDADE',
    evento: 'CRIADO',
    titulo: `Nova versão do Estudo de Viabilidade criada (V${novaVersao})`,
    descricao: `Baseada na versão aprovada V${viabilidade.versao}`,
    usuario_id: session.id,
    usuario_nome: session.nome,
    referencia_id: Number(novaViaId),
    referencia_tipo: 'viabilidade',
  })

  registrarAuditoria({
    usuario_id: session.id,
    usuario_nome: session.nome,
    acao: 'CREATE',
    entidade: 'viabilidade',
    entidade_id: Number(novaViaId),
    projeto_id,
    descricao: `Nova versão V${novaVersao} criada a partir da versão aprovada V${viabilidade.versao}`,
    dados_depois: { versao: novaVersao, status: 'RASCUNHO', baseada_em: via_id },
  })

  return NextResponse.json({ ok: true, id: novaViaId, versao: novaVersao }, { status: 201 })
}
