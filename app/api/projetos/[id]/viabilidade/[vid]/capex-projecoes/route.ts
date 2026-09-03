import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'
import { asyncDb } from '@/lib/database'

export interface CapexProjecao {
  id: number
  viabilidade_id: number
  projeto_id: number
  periodo_ref: string
  valor: number
  descricao: string
  usuario_nome: string | null
  created_at: string
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; vid: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { id, vid } = await params
  const db = getDb()
  const rows = db.prepare(`
    SELECT id, viabilidade_id, projeto_id, periodo_ref, valor, descricao, usuario_nome, created_at
    FROM viabilidade_capex_projecoes
    WHERE viabilidade_id = ? AND projeto_id = ?
    ORDER BY created_at ASC
  `).all(Number(vid), Number(id)) as CapexProjecao[]
  return NextResponse.json({ projecoes: rows })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; vid: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { id, vid } = await params
  const projetoId = Number(id)
  const viabilidadeId = Number(vid)

  const db = getDb()

  // Verify viabilidade exists for this project
  const via = await asyncDb.queryOne(
    `SELECT id FROM "AI"."TI_PMO_VIABILIDADE" WHERE id = ? AND projeto_id = ?`,
    [viabilidadeId, projetoId]
  )
  if (!via) return NextResponse.json({ error: 'Viabilidade não encontrada.' }, { status: 404 })

  const body = await req.json() as { periodo_ref?: string; valor?: number; descricao?: string }
  const { periodo_ref, valor, descricao } = body

  if (!periodo_ref?.trim()) return NextResponse.json({ error: 'Período de referência é obrigatório.' }, { status: 400 })
  if (valor === undefined || valor === null || isNaN(Number(valor))) return NextResponse.json({ error: 'Valor é obrigatório.' }, { status: 400 })
  if (!descricao?.trim()) return NextResponse.json({ error: 'Descrição/justificativa é obrigatória.' }, { status: 400 })

  const result = db.prepare(`
    INSERT INTO viabilidade_capex_projecoes
      (viabilidade_id, projeto_id, periodo_ref, valor, descricao, usuario_id, usuario_nome)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(viabilidadeId, projetoId, periodo_ref.trim(), Number(valor), descricao.trim(), session.id, session.nome)

  return NextResponse.json({ ok: true, id: result.lastInsertRowid })
}
