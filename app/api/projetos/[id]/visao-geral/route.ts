import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'
import { registrarAuditoria } from '@/lib/db/auditoria'
import { registrarHistoricoAlteracao } from '@/lib/projetos'
import { registrarEvento } from '@/lib/timeline'
import type Database from 'better-sqlite3'

const CAMPO_LABELS: Record<string, string> = {
  nome: 'Nome',
  descricao: 'Descrição',
  objetivo: 'Objetivo',
  solicitante_id: 'Solicitante',
  contato: 'Contato',
  gerente_id: 'Gerente Responsável',
  pmo_responsavel_id: 'PMO Responsável',
  ponto_focal: 'Ponto Focal',
  diretoria_id: 'Diretoria',
  area_id: 'Área',
  prioridade: 'Prioridade',
  tipo_beneficio: 'Tipo de Benefício',
  data_inicio_prev: 'Data Prevista de Início',
  data_fim_prev: 'Data Prevista de Término',
  complexidade: 'Complexidade',
  classificacao: 'Classificação',
}

const CAMPOS_EDITAVEIS = Object.keys(CAMPO_LABELS) as (keyof typeof CAMPO_LABELS)[]

const CAMPOS_OBRIGATORIOS: Record<string, string> = {
  nome: 'Nome',
  descricao: 'Descrição',
  objetivo: 'Objetivo',
  solicitante_id: 'Solicitante',
  diretoria_id: 'Diretoria',
  area_id: 'Área',
  gerente_id: 'Gerente Responsável',
  pmo_responsavel_id: 'PMO Responsável',
  prioridade: 'Prioridade',
  tipo_beneficio: 'Tipo de Benefício',
  data_fim_prev: 'Data Prevista de Término',
}

function resolverLabel(db: Database.Database, campo: string, valor: unknown): string {
  if (valor == null || valor === '') return '(vazio)'
  switch (campo) {
    case 'solicitante_id':
    case 'gerente_id':
    case 'pmo_responsavel_id': {
      const u = db.prepare('SELECT nome FROM usuarios WHERE id = ?').get(Number(valor)) as { nome: string } | undefined
      return u?.nome ?? String(valor)
    }
    case 'diretoria_id': {
      const d = db.prepare('SELECT nome FROM diretorias WHERE id = ?').get(Number(valor)) as { nome: string } | undefined
      return d?.nome ?? String(valor)
    }
    case 'area_id': {
      const a = db.prepare('SELECT nome FROM areas WHERE id = ?').get(Number(valor)) as { nome: string } | undefined
      return a?.nome ?? String(valor)
    }
    case 'prioridade': {
      const map: Record<string, string> = { ALTA: 'Alta', MEDIA: 'Média', BAIXA: 'Baixa' }
      return map[String(valor)] ?? String(valor)
    }
    case 'data_inicio_prev':
    case 'data_fim_prev': {
      try {
        return new Date(String(valor) + 'T00:00:00').toLocaleDateString('pt-BR')
      } catch { return String(valor) }
    }
    default:
      return String(valor)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const podeGerenciar = ['ADMIN', 'PMO', 'GESTOR'].includes(session.perfil)
  if (!podeGerenciar) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  const { id } = await params
  const projetoId = parseInt(id)
  if (isNaN(projetoId)) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })

  const db = getDb()
  const antes = db.prepare(`SELECT * FROM projetos WHERE id = ? AND ativo = 1`).get(projetoId) as Record<string, unknown> | undefined
  if (!antes) return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  // Validate required fields
  for (const [campo, label] of Object.entries(CAMPOS_OBRIGATORIOS)) {
    if (campo in body) {
      const val = body[campo]
      if (val == null || String(val).trim() === '') {
        return NextResponse.json({ error: `${label} é obrigatório e não pode estar vazio.` }, { status: 422 })
      }
    }
  }

  // Validate FK references exist
  if (body.solicitante_id != null) {
    const sol = db.prepare('SELECT id FROM usuarios WHERE id = ? AND ativo = 1').get(Number(body.solicitante_id))
    if (!sol) return NextResponse.json({ error: 'Solicitante não encontrado.' }, { status: 422 })
  }
  if (body.diretoria_id != null) {
    const dir = db.prepare('SELECT id FROM diretorias WHERE id = ? AND ativo = 1').get(Number(body.diretoria_id))
    if (!dir) return NextResponse.json({ error: 'Diretoria não encontrada.' }, { status: 422 })
  }
  if (body.area_id != null) {
    const area = db.prepare('SELECT id FROM areas WHERE id = ? AND ativo = 1').get(Number(body.area_id))
    if (!area) return NextResponse.json({ error: 'Área não encontrada.' }, { status: 422 })
  }
  if (body.gerente_id != null) {
    const ger = db.prepare('SELECT id FROM usuarios WHERE id = ? AND ativo = 1').get(Number(body.gerente_id))
    if (!ger) return NextResponse.json({ error: 'Gerente não encontrado.' }, { status: 422 })
  }
  if (body.pmo_responsavel_id != null) {
    const pmo = db.prepare('SELECT id FROM usuarios WHERE id = ? AND ativo = 1').get(Number(body.pmo_responsavel_id))
    if (!pmo) return NextResponse.json({ error: 'PMO Responsável não encontrado.' }, { status: 422 })
  }

  const updates: string[] = []
  const vals: Record<string, unknown> = {}
  const camposAlterados: { campo: string; anterior: unknown; novo: unknown }[] = []

  for (const campo of CAMPOS_EDITAVEIS) {
    if (!(campo in body)) continue
    const novoValor = body[campo] != null && body[campo] !== '' ? body[campo] : null
    const valorAnterior = antes[campo] ?? null
    if (String(novoValor ?? '') !== String(valorAnterior ?? '')) {
      updates.push(`${campo} = @${campo}`)
      vals[campo] = novoValor
      camposAlterados.push({ campo, anterior: valorAnterior, novo: novoValor })
    }
  }

  if (camposAlterados.length === 0) return NextResponse.json({ ok: true })

  try {
    vals.id = projetoId
    vals.updated_at = new Date().toISOString()
    db.prepare(`UPDATE projetos SET ${updates.join(', ')}, updated_at = @updated_at WHERE id = @id`).run(vals)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Erro ao salvar no banco de dados: ${msg}` }, { status: 500 })
  }

  try {
    for (const alt of camposAlterados) {
      registrarHistoricoAlteracao({
        projeto_id: projetoId,
        usuario_id: session.id,
        usuario_nome: session.nome,
        campo: alt.campo,
        valor_anterior: alt.anterior != null ? String(alt.anterior) : null,
        valor_novo: alt.novo != null ? String(alt.novo) : null,
      })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Erro ao registrar histórico: ${msg}` }, { status: 500 })
  }

  const depois = db.prepare(`SELECT * FROM projetos WHERE id = ?`).get(projetoId)

  const resumoCampos = camposAlterados.map(c => CAMPO_LABELS[c.campo] ?? c.campo).join(', ')

  try {
    registrarAuditoria({
      usuario_id: session.id,
      usuario_nome: session.nome,
      acao: 'UPDATE',
      entidade: 'projetos',
      entidade_id: projetoId,
      projeto_id: projetoId,
      descricao: `Dados gerais atualizados: ${resumoCampos}`,
      dados_antes: antes,
      dados_depois: depois,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Erro ao registrar auditoria: ${msg}` }, { status: 500 })
  }

  try {
    const linhasTimeline = camposAlterados.map(alt => {
      const label = CAMPO_LABELS[alt.campo] ?? alt.campo
      const antesStr = resolverLabel(db, alt.campo, alt.anterior)
      const depoisStr = resolverLabel(db, alt.campo, alt.novo)
      return `${label} alterado de: "${antesStr}" para: "${depoisStr}"`
    })

    registrarEvento({
      projeto_id: projetoId,
      modulo: 'PROJETO',
      artefato: 'PROJETO',
      evento: 'ALTERADO',
      titulo: `Dados gerais atualizados: ${resumoCampos}`,
      descricao: linhasTimeline.join('\n'),
      usuario_id: session.id,
      usuario_nome: session.nome,
      referencia_id: projetoId,
      referencia_tipo: 'projetos',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Erro ao registrar timeline: ${msg}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, projeto: depois })
}
