import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { TapRepository } from '@/lib/repositories'
import { registrarAuditoria } from '@/lib/db/auditoria'
import { registrarEvento } from '@/lib/timeline'

const CAMPOS_COPIA = [
  'objetivo_detalhado', 'situacao_atual', 'escopo_fisico', 'escopo_sistemico', 'escopo_processo',
  'setores_envolvidos', 'etapas_projeto', 'entregaveis', 'pontos_atencao', 'pontos_definir',
  'beneficios_tap', 'escopo_inicial', 'escopo_fora', 'restricoes', 'premissas', 'riscos_iniciais',
  'fase_origem',
]

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tapId: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (session.perfil !== 'ADMIN') {
    return NextResponse.json({ error: 'Sem permissão. Apenas ADMIN pode editar um TAP aprovado.' }, { status: 403 })
  }

  const { id, tapId } = await params
  const projeto_id = Number(id)
  const tap_id = Number(tapId)

  const tapOriginal = await TapRepository.findByIdAndProjetoId(tap_id, projeto_id)
  if (!tapOriginal) {
    return NextResponse.json({ error: 'TAP não encontrado.' }, { status: 404 })
  }
  if (tapOriginal.status !== 'APROVADO') {
    return NextResponse.json(
      { error: 'Apenas TAPs com status APROVADO podem gerar nova versão por esta rota.' },
      { status: 400 }
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const novaVersao = await TapRepository.nextVersao(projeto_id)
  const novoLabel = `TAP V${novaVersao}`

  const vals: Record<string, unknown> = {
    projeto_id,
    versao: novaVersao,
    label: novoLabel,
    status: 'RASCUNHO',
    criado_por: session.id,
  }

  for (const campo of CAMPOS_COPIA) {
    vals[campo] = (tapOriginal as unknown as Record<string, unknown>)[campo] ?? null
  }

  const camposEditaveis = CAMPOS_COPIA.filter(c => c !== 'fase_origem')
  for (const campo of camposEditaveis) {
    if (body[campo] !== undefined) vals[campo] = body[campo]
  }

  const novoTapId = await TapRepository.insertCopia(vals)

  registrarEvento({
    projeto_id,
    modulo: 'TAP',
    artefato: 'TAP',
    evento: 'CRIADO',
    titulo: `Nova versão do TAP criada por ADMIN (${novoLabel})`,
    descricao: `Baseada na versão aprovada V${tapOriginal.versao}. Nova versão em rascunho para revisão.`,
    usuario_id: session.id,
    usuario_nome: session.nome,
    referencia_id: Number(novoTapId),
    referencia_tipo: 'tap_versoes',
  })

  registrarAuditoria({
    usuario_id: session.id,
    usuario_nome: session.nome,
    acao: 'CREATE',
    entidade: 'tap_versoes',
    entidade_id: Number(novoTapId),
    projeto_id,
    descricao: `ADMIN criou ${novoLabel} a partir da versão aprovada V${tapOriginal.versao}`,
    dados_antes: { id: tap_id, versao: tapOriginal.versao, status: 'APROVADO' },
    dados_depois: { id: novoTapId, versao: novaVersao, label: novoLabel, status: 'RASCUNHO' },
  })

  return NextResponse.json({ ok: true, id: novoTapId, versao: novaVersao, label: novoLabel }, { status: 201 })
}
