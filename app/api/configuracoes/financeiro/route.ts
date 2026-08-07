import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'
import { registrarAuditoria } from '@/lib/db/auditoria'

export async function PATCH(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!['ADMIN', 'PMO'].includes(session.perfil)) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  const { chave, valor } = await request.json()

  const chavesPermitidas = ['selic', 'taxa_desconto', 'inflacao']
  if (!chavesPermitidas.includes(chave)) {
    return NextResponse.json({ error: 'Chave inválida.' }, { status: 400 })
  }

  const db = getDb()
  const anterior = db.prepare('SELECT valor FROM config_global WHERE chave = ?').get(chave) as { valor: string } | undefined

  db.prepare(`
    UPDATE config_global SET valor = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE chave = ?
  `).run(valor, session.id, chave)

  registrarAuditoria({
    usuario_id: session.id,
    usuario_nome: session.nome,
    acao: 'UPDATE',
    entidade: 'config_global',
    descricao: `Premissa financeira "${chave}" alterada de ${anterior?.valor}% para ${valor}%`,
    dados_antes: { chave, valor: anterior?.valor },
    dados_depois: { chave, valor },
  })

  return NextResponse.json({ success: true })
}
