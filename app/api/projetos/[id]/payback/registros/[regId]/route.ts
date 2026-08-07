import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import { getDb } from '@/lib/db'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; regId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id, regId } = await params
  const projetoId = Number(id)
  const registroId = Number(regId)
  const db = getDb()

  const registro = db.prepare(
    'SELECT id, criado_por FROM payback_registros WHERE id = ? AND projeto_id = ?'
  ).get(registroId, projetoId) as { id: number; criado_por: number } | undefined

  if (!registro) return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 })

  // Só PMO/ADMIN ou o próprio criador pode excluir
  if (registro.criado_por !== session.id && !temPermissao(session.perfil, 'PMO')) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  db.prepare('DELETE FROM payback_registros WHERE id = ?').run(registroId)

  return NextResponse.json({ ok: true })
}
