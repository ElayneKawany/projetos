import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import getDb from '@/lib/db'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'PMO'))
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  const db = getDb()
  const { id } = await params
  const body = await request.json() as { nome?: string; descricao?: string; ordem?: number; ativo?: number }

  const motivo = db.prepare('SELECT * FROM config_motivos_pausa WHERE id = ?').get(Number(id))
  if (!motivo) return NextResponse.json({ error: 'Motivo não encontrado.' }, { status: 404 })

  if (typeof body.ativo === 'number') {
    db.prepare('UPDATE config_motivos_pausa SET ativo = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(body.ativo, Number(id))
  } else {
    if (!body.nome?.trim())
      return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 })
    db.prepare(
      'UPDATE config_motivos_pausa SET nome = ?, descricao = ?, ordem = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).run(body.nome.trim(), body.descricao?.trim() ?? null, body.ordem ?? 0, Number(id))
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'ADMIN'))
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  const db = getDb()
  const { id } = await params
  const emUso = db.prepare('SELECT COUNT(*) as c FROM projetos WHERE motivo_pausa_id = ?').get(Number(id)) as { c: number }
  if (emUso.c > 0)
    return NextResponse.json({ error: 'Este motivo está em uso em projetos e não pode ser excluído.' }, { status: 409 })

  db.prepare('DELETE FROM config_motivos_pausa WHERE id = ?').run(Number(id))
  return NextResponse.json({ ok: true })
}
