import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import getDb from '@/lib/db'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!temPermissao(session.perfil, 'PMO'))
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const projetoId = Number(id)
  const body = await req.json() as { status: string; nova_data: string; justificativa: string }
  const { status, nova_data, justificativa } = body

  if (!status || !nova_data || !justificativa?.trim())
    return NextResponse.json({ error: 'status, nova_data e justificativa são obrigatórios.' }, { status: 400 })

  const db = getDb()
  const existing = db.prepare(
    'SELECT data_limite, data_baseline FROM projeto_fase_prazo WHERE projeto_id = ? AND status = ?'
  ).get(projetoId, status) as { data_limite: string | null; data_baseline: string | null } | undefined

  if (!existing?.data_baseline)
    return NextResponse.json({ error: 'Esta Macro Fase ainda não possui prazo salvo. Salve primeiro antes de reprogramar.' }, { status: 400 })

  const tx = db.transaction(() => {
    // Preserve baseline, update data_limite (vigente) to nova_data
    db.prepare(`
      UPDATE projeto_fase_prazo
      SET data_limite = ?, usuario_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE projeto_id = ? AND status = ?
    `).run(nova_data, session.id, projetoId, status)

    // Register in history
    db.prepare(`
      INSERT INTO projeto_fase_prazo_historico
        (projeto_id, status, data_anterior, nova_data, justificativa, usuario_id, usuario_nome)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(projetoId, status, existing.data_limite, nova_data, justificativa.trim(), session.id, session.nome)
  })
  tx()

  return NextResponse.json({ ok: true })
}
