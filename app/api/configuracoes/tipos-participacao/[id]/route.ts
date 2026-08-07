import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import getDb from '@/lib/db'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(request)
  if (!session || !temPermissao(session.perfil, 'PMO'))
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { id } = await params
  const body = await request.json()
  const db = getDb()

  const tipo = db.prepare('SELECT * FROM workflow_tipos_participacao WHERE id = ?').get(Number(id))
  if (!tipo) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  // Operação: toggle ativo / atualizar nome+descricao
  if (typeof body.ativo === 'number') {
    // Inativar: verificar se está sendo usado
    if (body.ativo === 0) {
      const emUso = db.prepare(
        "SELECT COUNT(*) as c FROM workflow_etapas WHERE tipo = (SELECT codigo FROM workflow_tipos_participacao WHERE id = ?)"
      ).get(Number(id)) as { c: number }
      if (emUso.c > 0)
        return NextResponse.json(
          { error: 'Este tipo está sendo utilizado em workflows e não pode ser inativado' },
          { status: 409 }
        )
    }
    db.prepare('UPDATE workflow_tipos_participacao SET ativo = ? WHERE id = ?').run(body.ativo, Number(id))
  } else {
    if (!body.nome?.trim()) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    db.prepare('UPDATE workflow_tipos_participacao SET nome = ?, descricao = ? WHERE id = ?')
      .run(body.nome.trim(), body.descricao?.trim() ?? null, Number(id))
  }

  return NextResponse.json({ ok: true })
}
