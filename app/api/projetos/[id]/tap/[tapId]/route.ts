import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'
import { registrarAuditoria } from '@/lib/db/auditoria'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tapId: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { id, tapId } = await params
  const db = getDb()
  const tap = db
    .prepare('SELECT * FROM tap_versoes WHERE id = ? AND projeto_id = ?')
    .get(Number(tapId), Number(id))
  if (!tap) return NextResponse.json({ error: 'TAP não encontrado.' }, { status: 404 })
  const body = await request.json()
  const fields = [
    'objetivo_detalhado', 'situacao_atual', 'escopo_fisico', 'escopo_sistemico', 'escopo_processo',
    'setores_envolvidos', 'etapas_projeto', 'entregaveis', 'pontos_atencao', 'pontos_definir',
    'beneficios_tap', 'escopo_inicial', 'escopo_fora', 'restricoes', 'premissas', 'riscos_iniciais',
  ]
  const sets = fields
    .filter((f) => body[f] !== undefined)
    .map((f) => `${f} = @${f}`)
    .join(', ')
  if (!sets) return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 })
  const values: Record<string, unknown> = { id: Number(tapId) }
  fields.filter((f) => body[f] !== undefined).forEach((f) => (values[f] = body[f]))
  db.prepare(`UPDATE tap_versoes SET ${sets} WHERE id = @id`).run(values)
  registrarAuditoria({
    usuario_id: session.id,
    usuario_nome: session.nome,
    acao: 'UPDATE',
    entidade: 'tap_versoes',
    entidade_id: Number(tapId),
    projeto_id: Number(id),
    descricao: 'TAP atualizado',
    dados_depois: body,
  })
  return NextResponse.json({ ok: true })
}
