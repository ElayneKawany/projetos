import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'

export async function POST(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const body = await request.json()
  const { atividade_id, projeto_id, projeto_codigo, projeto_nome } = body

  if (!atividade_id || !projeto_id || !projeto_codigo) {
    return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 })
  }

  const db = getDb()

  // Verifica se o projeto existe
  const projeto = db.prepare('SELECT id, codigo, nome FROM projetos WHERE id = ? AND ativo = 1').get(Number(projeto_id))
  if (!projeto) return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })

  // Upsert em ti_prioridades: cria ou atualiza o registro para esta atividade
  db.prepare(`
    INSERT INTO ti_prioridades (atividade_id, fonte, projeto_id, projeto_codigo, projeto_nome, updated_at)
    VALUES (?, 'dev2026', ?, ?, ?, datetime('now'))
    ON CONFLICT(atividade_id, fonte) DO UPDATE SET
      projeto_id     = excluded.projeto_id,
      projeto_codigo = excluded.projeto_codigo,
      projeto_nome   = excluded.projeto_nome,
      updated_at     = excluded.updated_at
  `).run(Number(atividade_id), Number(projeto_id), (projeto as any).codigo, (projeto as any).nome)

  return NextResponse.json({ ok: true, projeto_codigo: (projeto as any).codigo, projeto_nome: (projeto as any).nome })
}
