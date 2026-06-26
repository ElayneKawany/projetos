import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'
import { registrarAuditoria } from '@/lib/db/auditoria'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const db = getDb()
  const comites = db.prepare('SELECT * FROM comites ORDER BY data_realizacao DESC').all()
  return NextResponse.json({ comites })
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!['ADMIN','PMO'].includes(session.perfil)) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }
  const body = await request.json()
  const db = getDb()
  const result = db.prepare(`
    INSERT INTO comites (titulo, tipo, data_realizacao, local, pauta, created_by)
    VALUES (@titulo, @tipo, @data_realizacao, @local, @pauta, @created_by)
  `).run({ ...body, created_by: session.id })

  registrarAuditoria({
    usuario_id: session.id, usuario_nome: session.nome,
    acao: 'CREATE', entidade: 'comites', entidade_id: Number(result.lastInsertRowid),
    descricao: `Comitê criado: "${body.titulo}"`,
  })
  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 })
}
