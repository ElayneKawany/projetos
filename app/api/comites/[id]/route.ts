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
  if (isNaN(comiteId)) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })

  const comite = await ComitesRepository.findById(comiteId)
  if (!comite) return NextResponse.json({ error: 'Comitê não encontrado.' }, { status: 404 })

  const participantes = await ComitesRepository.findParticipantes(comiteId)
  const comiteProjetos = ComitesRepository.findProjetosByComiteId(comiteId)
  const decisoes = ComitesRepository.findDecisoesByComiteId(comiteId)
  const pendencias = ComitesRepository.findPendenciasByComiteId(comiteId)
  const ata = ComitesRepository.findAta(comiteId)

  return NextResponse.json({ comite, participantes, comiteProjetos, decisoes, pendencias, ata })
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'PMO')) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  const { id } = await params
  const comiteId = parseInt(id)
  if (isNaN(comiteId)) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })

  const atual = ComitesRepository.findRaw(comiteId)
  if (!atual) return NextResponse.json({ error: 'Comitê não encontrado.' }, { status: 404 })

  const body = await request.json()
  if ((atual as Record<string, unknown>).status === 'REALIZADO' && session.perfil !== 'ADMIN') {
    const hasDisallowedField = Object.keys(body).some(k => k !== 'status')
    if (hasDisallowedField) {
      return NextResponse.json({ error: 'Comitê finalizado. Somente Administradores podem editar.' }, { status: 403 })
    }
  }

  const campos = ['titulo','tipo','data_realizacao','hora','local','pauta','decisao_geral','status','periodo_inicio','periodo_fim','diretorias_ids','resumo_executivo_ia','resumo_executivo_ia_json','resumo_ia_gerado_em']
  const fields: Record<string, unknown> = {}
  for (const campo of campos) {
    if (body[campo] !== undefined) fields[campo] = body[campo]
  }
  if (Object.keys(fields).length === 0) return NextResponse.json({ error: 'Nenhum campo para atualizar.' }, { status: 422 })

  ComitesRepository.updateFull(comiteId, fields)
  const atualizado = ComitesRepository.findRaw(comiteId)

  registrarAuditoria({
    usuario_id: session.id, usuario_nome: session.nome,
    acao: 'UPDATE', entidade: 'comites', entidade_id: comiteId,
    descricao: `Comitê "${atual.titulo}" atualizado`,
    dados_antes: atual, dados_depois: atualizado,
  })

  return NextResponse.json({ comite: atualizado })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'PMO')) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  const { id } = await params
  const comiteId = parseInt(id)
  if (isNaN(comiteId)) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })

  const atual = ComitesRepository.findRaw(comiteId)
  if (!atual) return NextResponse.json({ error: 'Comitê não encontrado.' }, { status: 404 })

  ComitesRepository.deleteCascade(comiteId)

  registrarAuditoria({
    usuario_id: session.id, usuario_nome: session.nome,
    acao: 'DELETE', entidade: 'comites', entidade_id: comiteId,
    descricao: `Comitê "${atual.titulo}" excluído`,
    dados_antes: atual, dados_depois: null,
  })

  return NextResponse.json({ ok: true })
}
