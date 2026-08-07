import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { TapRepository } from '@/lib/repositories'
import { registrarAuditoria } from '@/lib/db/auditoria'
import { verificarBloqueioEdicao } from '@/lib/artefatos'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tapId: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { id, tapId } = await params
  const tap = TapRepository.findByIdAndProjetoId(Number(tapId), Number(id))
  if (!tap) return NextResponse.json({ error: 'TAP não encontrado.' }, { status: 404 })
  if (verificarBloqueioEdicao(tap.status)) {
    return NextResponse.json({ error: 'Este documento não pode ser editado no status atual.' }, { status: 403 })
  }
  const body = await request.json()
  const fields = [
    'objetivo_detalhado', 'situacao_atual', 'escopo_fisico', 'escopo_sistemico', 'escopo_processo',
    'setores_envolvidos', 'etapas_projeto', 'entregaveis', 'pontos_atencao', 'pontos_definir',
    'beneficios_tap', 'escopo_inicial', 'escopo_fora', 'restricoes', 'premissas', 'riscos_iniciais',
  ]
  const dados: Record<string, unknown> = {}
  for (const f of fields) {
    if (body[f] !== undefined) dados[f] = body[f]
  }
  if (!Object.keys(dados).length) return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 })
  TapRepository.update(Number(tapId), dados)
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
