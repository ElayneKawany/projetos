import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'
import { registrarAuditoria } from '@/lib/db/auditoria'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; vid: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { id, vid } = await params
  const db = getDb()
  const viabilidade = db
    .prepare('SELECT * FROM viabilidade_versoes WHERE id = ? AND projeto_id = ?')
    .get(Number(vid), Number(id))
  if (!viabilidade) return NextResponse.json({ error: 'Viabilidade não encontrada.' }, { status: 404 })
  const body = await request.json()
  const fields = [
    'resumo_executivo', 'investimento_total', 'roi', 'vpl', 'tir', 'payback_meses',
    'sistemas_envolvidos', 'dependencia_fornecedores', 'infraestrutura', 'impacto_operacional',
    'mudanca_processo', 'recursos_necessarios', 'impactos', 'riscos',
    'data_inicio_prev', 'data_fim_prev', 'marcos', 'recomendacao',
    'justificativa_recomendacao', 'conclusao', 'status',
  ]
  const sets = fields
    .filter((f) => body[f] !== undefined)
    .map((f) => `${f} = @${f}`)
    .join(', ')
  if (!sets) return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 })
  const values: Record<string, unknown> = { id: Number(vid) }
  fields.filter((f) => body[f] !== undefined).forEach((f) => (values[f] = body[f]))
  db.prepare(`UPDATE viabilidade_versoes SET ${sets} WHERE id = @id`).run(values)
  registrarAuditoria({
    usuario_id: session.id,
    usuario_nome: session.nome,
    acao: 'UPDATE',
    entidade: 'viabilidade_versoes',
    entidade_id: Number(vid),
    projeto_id: Number(id),
    descricao: 'Viabilidade atualizada',
    dados_depois: body,
  })
  return NextResponse.json({ ok: true })
}
