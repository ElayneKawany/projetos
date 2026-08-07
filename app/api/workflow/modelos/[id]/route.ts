import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import getDb from '@/lib/db'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const body = await request.json() as {
    nome?: string
    descricao?: string
    etapas?: { ordem: number; usuario_id: number; usuario_nome: string; tipo: string }[]
    ativo?: number
  }

  const db = getDb()
  const modelo = db.prepare('SELECT * FROM workflow_modelos WHERE id = ?').get(Number(id))
  if (!modelo) return NextResponse.json({ error: 'Modelo não encontrado' }, { status: 404 })

  // Inativar: verificar se pode
  if (typeof body.ativo === 'number') {
    // Não verifica uso para inativação (modelos podem ser aposentados)
    db.prepare('UPDATE workflow_modelos SET ativo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(body.ativo, Number(id))
    return NextResponse.json({ ok: true })
  }

  if (!body.nome?.trim()) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })

  db.prepare('UPDATE workflow_modelos SET nome = ?, descricao = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(body.nome.trim(), body.descricao?.trim() ?? null, Number(id))

  // Se etapas foram enviadas, recria-as
  if (body.etapas?.length) {
    db.prepare('DELETE FROM workflow_modelo_etapas WHERE modelo_id = ?').run(Number(id))
    const ins = db.prepare(
      'INSERT INTO workflow_modelo_etapas (modelo_id, ordem, usuario_id, usuario_nome, tipo) VALUES (?, ?, ?, ?, ?)'
    )
    for (const e of body.etapas) {
      ins.run(Number(id), e.ordem, e.usuario_id, e.usuario_nome, e.tipo)
    }
  }

  return NextResponse.json({ ok: true })
}
