import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import { concluirProjeto } from '@/lib/projetos'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'projetos:manage')) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  const { id } = await params
  const projeto_id = Number(id)

  const body = await request.json()
  const { data_conclusao_real, hora_conclusao, responsavel_conclusao, motivo_conclusao, checklist_conclusao } = body

  if (!data_conclusao_real) {
    return NextResponse.json({ error: 'Data de conclusão é obrigatória.' }, { status: 400 })
  }
  if (!responsavel_conclusao?.trim()) {
    return NextResponse.json({ error: 'Responsável é obrigatório.' }, { status: 400 })
  }

  try {
    await concluirProjeto(
      projeto_id,
      {
        data_conclusao_real,
        hora_conclusao: hora_conclusao ?? '',
        responsavel_conclusao,
        motivo_conclusao: motivo_conclusao ?? '',
        checklist_conclusao: typeof checklist_conclusao === 'object'
          ? JSON.stringify(checklist_conclusao)
          : (checklist_conclusao ?? '{}'),
      },
      session.id,
      session.nome,
    )
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro ao concluir projeto.' },
      { status: 400 }
    )
  }
}
