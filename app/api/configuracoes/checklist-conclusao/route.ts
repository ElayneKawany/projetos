import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'

export async function GET(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const db = getDb()
  const items = db.prepare(
    `SELECT id, codigo, label, obrigatorio, ordem FROM config_checklist_conclusao WHERE ativo = 1 ORDER BY ordem`
  ).all()
  return NextResponse.json(items)
}
