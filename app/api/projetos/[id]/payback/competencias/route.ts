import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { buscarCompetencias } from '@/lib/payback'
import { registrarAuditoria } from '@/lib/db/auditoria'
import { registrarEvento } from '@/lib/timeline'
import getDb from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const projetoId = Number(id)
  if (isNaN(projetoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const competencias = buscarCompetencias(projetoId)
  return NextResponse.json({ competencias })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const projetoId = Number(id)
  if (isNaN(projetoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const body = await request.json() as {
    ano: number
    mes: number
    receita?: number
    economia?: number
    capex?: number
    opex?: number
    observacao?: string
  }

  const { ano, mes } = body
  if (!ano || !mes || mes < 1 || mes > 12) {
    return NextResponse.json({ error: 'Ano e mês são obrigatórios' }, { status: 400 })
  }

  const db = getDb()
  const receita  = body.receita  ?? 0
  const economia = body.economia ?? 0
  const capex    = body.capex    ?? 0
  const opex     = body.opex     ?? 0
  const fluxo    = receita + economia - capex - opex

  const result = db.prepare(`
    INSERT INTO payback_competencias (projeto_id, ano, mes, receita, economia, capex, opex, fluxo, observacao, criado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(projetoId, ano, mes, receita, economia, capex, opex, fluxo, body.observacao ?? null, session.id)

  const novaId = result.lastInsertRowid

  registrarEvento({
    projeto_id:    projetoId,
    modulo:        'PAYBACK',
    artefato:      'COMPETENCIA',
    evento:        'COMPETENCIA_CRIADA',
    titulo:        `Competência ${String(mes).padStart(2, '0')}/${ano} lançada`,
    usuario_id:    session.id,
    usuario_nome:  session.nome,
    referencia_id: Number(novaId),
    referencia_tipo: 'payback_competencias',
  })

  registrarAuditoria({
    usuario_id:    session.id,
    usuario_nome:  session.nome,
    acao:          'CREATE',
    entidade:      'payback_competencias',
    entidade_id:   Number(novaId),
    projeto_id:    projetoId,
    descricao:     `Competência ${String(mes).padStart(2, '0')}/${ano} criada`,
    dados_depois:  { ano, mes, receita, economia, capex, opex, fluxo },
  })

  return NextResponse.json({ id: novaId }, { status: 201 })
}
