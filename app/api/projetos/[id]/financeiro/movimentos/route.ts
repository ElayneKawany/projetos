import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { FinanceiroRepository } from '@/lib/repositories'
import { registrarEvento } from '@/lib/timeline'
import { registrarAuditoria } from '@/lib/db/auditoria'

type Params = { params: Promise<{ id: string }> }

const TIPOS_VALIDOS = ['NF', 'CONTRATO', 'COMPROVANTE', 'MEDICAO', 'ADIANTAMENTO', 'OUTRO']
const STATUS_VALIDOS = ['PENDENTE', 'APROVADO', 'REJEITADO', 'CANCELADO']

/** GET /api/projetos/[id]/financeiro/movimentos — lista movimentos do projeto */
export async function GET(
  request: NextRequest,
  { params }: Params
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id } = await params
  const movimentos = FinanceiroRepository.findMovimentos(Number(id))
  return NextResponse.json({ movimentos })
}

/** POST /api/projetos/[id]/financeiro/movimentos — cria novo movimento (documento/NF) */
export async function POST(
  request: NextRequest,
  { params }: Params
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  if (!['ADMIN', 'PMO', 'GESTOR'].includes(session.perfil)) {
    return NextResponse.json({ error: 'Sem permissão para lançar documentos financeiros.' }, { status: 403 })
  }

  const { id } = await params
  const projeto_id = Number(id)
  const body = await request.json().catch(() => ({})) as {
    item_id?: number
    tipo_movimento?: string
    numero_doc?: string
    fornecedor?: string
    valor_total?: number
    data_emissao?: string
    data_vencimento?: string
    observacoes?: string
  }

  if (!body.tipo_movimento || !TIPOS_VALIDOS.includes(body.tipo_movimento)) {
    return NextResponse.json({
      error: `tipo_movimento inválido. Use: ${TIPOS_VALIDOS.join(', ')}`,
    }, { status: 400 })
  }

  if (!body.valor_total || body.valor_total <= 0) {
    return NextResponse.json({ error: 'valor_total deve ser maior que zero.' }, { status: 400 })
  }

  const movimentoId = Number(FinanceiroRepository.insertMovimento({
    projeto_id,
    item_id:        body.item_id ?? null,
    tipo_movimento: body.tipo_movimento!,
    numero_doc:     body.numero_doc ?? null,
    fornecedor:     body.fornecedor ?? null,
    valor_total:    body.valor_total!,
    data_emissao:   body.data_emissao ?? null,
    data_vencimento: body.data_vencimento ?? null,
    observacoes:    body.observacoes ?? null,
    criado_por:     session.id,
  }))

  registrarEvento({
    projeto_id,
    modulo: 'FINANCEIRO',
    artefato: 'MOVIMENTO',
    evento: 'CRIADO',
    titulo: `${body.tipo_movimento}${body.numero_doc ? ` ${body.numero_doc}` : ''} lançado`,
    descricao: `Valor: R$ ${body.valor_total.toFixed(2)}${body.fornecedor ? ` | ${body.fornecedor}` : ''}`,
    usuario_id: session.id,
    usuario_nome: session.nome,
    referencia_id: movimentoId,
    referencia_tipo: 'financeiro_movimentos',
    dados: { valor: body.valor_total, tipo: body.tipo_movimento },
  })

  registrarAuditoria({
    entidade: 'financeiro_movimentos',
    entidade_id: movimentoId,
    acao: 'CREATE',
    descricao: `Movimento financeiro criado: ${body.tipo_movimento ?? ''}${body.numero_doc ? ` ${body.numero_doc}` : ''}`,
    dados_depois: body,
    usuario_id: session.id,
    usuario_nome: session.nome,
    projeto_id: projeto_id,
  })

  return NextResponse.json({ ok: true, id: movimentoId }, { status: 201 })
}

/** PATCH /api/projetos/[id]/financeiro/movimentos — aprova ou rejeita um movimento */
export async function PATCH(
  request: NextRequest,
  { params }: Params
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  if (!['ADMIN', 'PMO', 'DIRETOR', 'CEO'].includes(session.perfil)) {
    return NextResponse.json({ error: 'Sem permissão para aprovar documentos financeiros.' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({})) as {
    movimentoId?: number
    status?: string
    observacoes?: string
  }

  if (!body.movimentoId) return NextResponse.json({ error: 'movimentoId obrigatório.' }, { status: 400 })
  if (!body.status || !STATUS_VALIDOS.includes(body.status)) {
    return NextResponse.json({ error: `status inválido. Use: ${STATUS_VALIDOS.join(', ')}` }, { status: 400 })
  }

  const movimento = FinanceiroRepository.findMovimentoById(body.movimentoId) as { status: string } | undefined

  if (!movimento) return NextResponse.json({ error: 'Movimento não encontrado.' }, { status: 404 })
  if (movimento.status !== 'PENDENTE') {
    return NextResponse.json({ error: 'Apenas movimentos PENDENTE podem ser atualizados.' }, { status: 400 })
  }

  FinanceiroRepository.updateMovimentoStatus(body.movimentoId, body.status!, body.observacoes ?? null, session.id)

  const evento = body.status === 'APROVADO' ? 'APROVADO' : body.status === 'REJEITADO' ? 'REJEITADO' : 'CANCELADO'

  registrarEvento({
    projeto_id: Number(id),
    modulo: 'FINANCEIRO',
    artefato: 'MOVIMENTO',
    evento: evento as 'APROVADO' | 'REJEITADO' | 'CANCELADO',
    titulo: `Documento ${body.status.toLowerCase()}`,
    descricao: body.observacoes ?? null,
    usuario_id: session.id,
    usuario_nome: session.nome,
    referencia_id: body.movimentoId,
    referencia_tipo: 'financeiro_movimentos',
  })

  return NextResponse.json({ ok: true })
}
