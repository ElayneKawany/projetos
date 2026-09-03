import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { criarItem, atualizarItem, desativarItem, desativarGrupo } from '@/lib/orcamento'
import { registrarEvento } from '@/lib/timeline'
import { asyncDb } from '@/lib/database'

async function verificarBloqueioWorkflow(projeto_id: number): Promise<boolean> {
  const v = await asyncDb.queryOne<{ status: string }>(
    `SELECT status FROM "AI"."TI_PMO_VIABILIDADE" WHERE projeto_id = ? ORDER BY versao DESC LIMIT 1`,
    [projeto_id]
  )
  return v?.status === 'APROVADO'
}

const MSG_BLOQUEIO = 'O orçamento está bloqueado. O Estudo de Viabilidade foi aprovado. Solicite uma revisão para editar.'

type Params = { params: Promise<{ id: string; grupoId: string }> }

/** POST /api/projetos/[id]/orcamento/grupos/[grupoId]/itens — cria item */
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  if (!['ADMIN', 'PMO', 'GESTOR'].includes(session.perfil)) {
    return NextResponse.json({ error: 'Sem permissão para criar itens de orçamento.' }, { status: 403 })
  }

  const { id, grupoId } = await params
  const projeto_id = Number(id)
  const grupo_id   = Number(grupoId)

  if (await verificarBloqueioWorkflow(projeto_id)) {
    return NextResponse.json({ error: MSG_BLOQUEIO }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as {
    nome?: string
    descricao?: string
    conta_contabil_id?: number
    centro_custo_id?: number
    valor_aprovado?: number
    prioridade?: string
    responsavel_usuario_id?: number
    ordem?: number
  }

  if (!body.nome?.trim()) {
    return NextResponse.json({ error: 'Nome do item é obrigatório.' }, { status: 400 })
  }
  if (!body.valor_aprovado || body.valor_aprovado < 0) {
    return NextResponse.json({ error: 'Valor aprovado deve ser maior ou igual a zero.' }, { status: 400 })
  }

  const itemId = criarItem({
    grupo_id,
    projeto_id,
    nome: body.nome.trim(),
    descricao: body.descricao,
    conta_contabil_id: body.conta_contabil_id,
    centro_custo_id: body.centro_custo_id,
    valor_aprovado: body.valor_aprovado ?? 0,
    prioridade: body.prioridade,
    responsavel_usuario_id: body.responsavel_usuario_id,
    ordem: body.ordem ?? 0,
    criado_por: session.id,
  })

  registrarEvento({
    projeto_id,
    modulo: 'ORCAMENTO',
    artefato: 'ITEM',
    evento: 'CRIADO',
    titulo: `Item orçado: ${body.nome}`,
    descricao: `Valor aprovado: R$ ${(body.valor_aprovado ?? 0).toFixed(2)}`,
    usuario_id: session.id,
    usuario_nome: session.nome,
    referencia_id: itemId,
    referencia_tipo: 'orcamento_itens',
  })

  return NextResponse.json({ ok: true, id: itemId }, { status: 201 })
}

/** PATCH /api/projetos/[id]/orcamento/grupos/[grupoId]/itens — atualiza item (body.itemId obrigatório) */
export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  if (!['ADMIN', 'PMO', 'GESTOR'].includes(session.perfil)) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  const { id } = await params
  if (await verificarBloqueioWorkflow(Number(id))) {
    return NextResponse.json({ error: MSG_BLOQUEIO }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as { itemId?: number; [k: string]: unknown }

  if (!body.itemId) return NextResponse.json({ error: 'itemId obrigatório.' }, { status: 400 })

  const { itemId, ...campos } = body

  atualizarItem(
    itemId,
    campos as Parameters<typeof atualizarItem>[1],
    session.id,
  )

  registrarEvento({
    projeto_id: Number(id),
    modulo: 'ORCAMENTO',
    artefato: 'ITEM',
    evento: 'ALTERADO',
    titulo: 'Item de orçamento atualizado',
    usuario_id: session.id,
    usuario_nome: session.nome,
    referencia_id: itemId,
    referencia_tipo: 'orcamento_itens',
  })

  return NextResponse.json({ ok: true })
}

/** DELETE /api/projetos/[id]/orcamento/grupos/[grupoId]/itens?itemId=X — desativa item ou grupo */
export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  if (!['ADMIN', 'PMO'].includes(session.perfil)) {
    return NextResponse.json({ error: 'Apenas PMO ou Admin pode remover itens.' }, { status: 403 })
  }

  const { id, grupoId } = await params
  if (await verificarBloqueioWorkflow(Number(id))) {
    return NextResponse.json({ error: MSG_BLOQUEIO }, { status: 403 })
  }

  const url = new URL(request.url)
  const itemId = url.searchParams.get('itemId')

  if (itemId) {
    desativarItem(Number(itemId), session.id)
  } else {
    desativarGrupo(Number(grupoId), session.id)
  }

  registrarEvento({
    projeto_id: Number(id),
    modulo: 'ORCAMENTO',
    artefato: itemId ? 'ITEM' : 'GRUPO',
    evento: 'CANCELADO',
    titulo: itemId ? 'Item de orçamento removido' : 'Grupo de orçamento removido',
    usuario_id: session.id,
    usuario_nome: session.nome,
    referencia_id: itemId ? Number(itemId) : Number(grupoId),
    referencia_tipo: itemId ? 'orcamento_itens' : 'orcamento_grupos',
  })

  return NextResponse.json({ ok: true })
}
