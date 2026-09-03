import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import { atualizarStatusProjeto, buscarProjetoPorId } from '@/lib/projetos'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'PMO')) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  const { id } = await params
  const projeto_id = Number(id)
  const body = await request.json().catch(() => ({}))
  const motivo: string = body?.motivo ?? ''

  try {
    const projeto = buscarProjetoPorId(projeto_id)
    if (!projeto) return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })
    if (projeto.status === 'CANCELADO') {
      return NextResponse.json({ error: 'Projeto já está cancelado.' }, { status: 400 })
    }
    if (projeto.status === 'PROJETO_ENCERRADO') {
      return NextResponse.json({ error: 'Projeto já foi encerrado oficialmente e não pode ser cancelado.' }, { status: 400 })
    }

    await atualizarStatusProjeto(projeto_id, 'CANCELADO', session.id, motivo || 'Projeto cancelado')
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro ao cancelar projeto.' },
      { status: 400 }
    )
  }
}
