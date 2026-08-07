import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import { ComitesRepository } from '@/lib/repositories'
import { registrarAuditoria } from '@/lib/db/auditoria'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { id } = await params
  const comiteId = parseInt(id)
  const ata = ComitesRepository.findAta(comiteId)
  const historico = ComitesRepository.findAtaHistorico(comiteId)
  return NextResponse.json({ ata, historico })
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'PMO')) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  const { id } = await params
  const comiteId = parseInt(id)

  const existente = ComitesRepository.findAta(comiteId)
  if (existente) return NextResponse.json({ error: 'Ata já existe. Use PATCH para atualizar.' }, { status: 409 })

  const body = await request.json()
  const ataId = Number(ComitesRepository.insertAta({
    comite_id: comiteId,
    transcricao: body.transcricao || null,
    conteudo: body.conteudo || '',
    conteudo_json: body.conteudo_json || null,
    gerado_por_ia: !!body.gerado_por_ia,
    status: body.status || 'RASCUNHO',
    hora_inicio: body.hora_inicio || null,
    hora_fim: body.hora_fim || null,
    duracao_min: body.duracao_min || null,
    created_by: session.id,
  }))

  ComitesRepository.insertAtaHistorico({
    comite_id: comiteId, ata_id: ataId, versao: 1,
    conteudo_snap: body.conteudo || null, acao: 'CRIAR',
    usuario_id: session.id, usuario_nome: session.nome,
  })

  return NextResponse.json({ id: ataId }, { status: 201 })
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id } = await params
  const comiteId = parseInt(id)
  const body = await request.json()

  const ata = ComitesRepository.findAta(comiteId) as Record<string, unknown> | undefined

  if (!ata) {
    if (!temPermissao(session.perfil, 'PMO')) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    const ataId = Number(ComitesRepository.insertAta({
      comite_id: comiteId,
      transcricao: body.transcricao || null,
      conteudo: body.conteudo || '',
      conteudo_json: body.conteudo_json || null,
      gerado_por_ia: !!body.gerado_por_ia,
      status: body.status || 'RASCUNHO',
      hora_inicio: body.hora_inicio || null,
      hora_fim: body.hora_fim || null,
      duracao_min: body.duracao_min || null,
      created_by: session.id,
    }))
    ComitesRepository.insertAtaHistorico({
      comite_id: comiteId, ata_id: ataId, versao: 1,
      conteudo_snap: body.conteudo || null, acao: 'CRIAR',
      usuario_id: session.id, usuario_nome: session.nome,
    })
    return NextResponse.json({ ok: true })
  }

  if (body.status === 'APROVADO' && !temPermissao(session.perfil, 'PMO')) {
    return NextResponse.json({ error: 'Somente PMO pode aprovar a ata.' }, { status: 403 })
  }

  const campos = ['transcricao', 'conteudo', 'conteudo_json', 'gerado_por_ia', 'status', 'hora_inicio', 'hora_fim', 'duracao_min']
  const fields: Record<string, unknown> = {}
  for (const c of campos) {
    if (body[c] !== undefined) fields[c] = body[c]
  }
  if (Object.keys(fields).length === 0) return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 422 })

  const novaVersao = (ata.versao as number) + 1
  ComitesRepository.updateAta(comiteId, fields, novaVersao)

  const acao = body.status === 'APROVADO' ? 'APROVAR' : body.status === 'PENDENTE_APROVACAO' ? 'SUBMETER' : 'EDITAR'
  ComitesRepository.insertAtaHistorico({
    comite_id: comiteId, ata_id: ata.id as number, versao: novaVersao,
    conteudo_snap: body.conteudo || null, acao,
    usuario_id: session.id, usuario_nome: session.nome,
  })

  if (body.status === 'APROVADO') {
    registrarAuditoria({
      usuario_id: session.id, usuario_nome: session.nome,
      acao: 'APPROVE', entidade: 'comite_ata', entidade_id: ata.id as number,
      descricao: `Ata do Comitê ${comiteId} aprovada (v${novaVersao})`,
    })
  }

  return NextResponse.json({ ok: true, versao: novaVersao })
}
