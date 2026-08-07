import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'
import { registrarAuditoria } from '@/lib/db/auditoria'

export async function GET() {
  const db = getDb()
  const areas = db.prepare(`
    SELECT a.*,
      d.nome as diretoria_nome,
      (SELECT COUNT(*) FROM projetos p WHERE p.area_id = a.id AND p.ativo = 1) as projeto_count
    FROM areas a
    JOIN diretorias d ON a.diretoria_id = d.id
    ORDER BY a.nome
  `).all()
  return NextResponse.json({ areas })
}

export async function POST(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (session.perfil !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão — apenas ADMIN.' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 }) }

  const nome = String(body.nome ?? '').trim()
  if (!nome) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 422 })

  const diretoria_id = body.diretoria_id ? Number(body.diretoria_id) : null
  if (!diretoria_id) return NextResponse.json({ error: 'Diretoria é obrigatória.' }, { status: 422 })

  const db = getDb()
  const dir = db.prepare('SELECT id FROM diretorias WHERE id = ? AND ativo = 1').get(diretoria_id)
  if (!dir) return NextResponse.json({ error: 'Diretoria não encontrada ou inativa.' }, { status: 422 })

  const sigla = String(body.sigla ?? '').trim() || nome.substring(0, 5).toUpperCase()
  const codigo = String(body.codigo ?? '').trim() || `AREA_${Date.now()}`
  const descricao = body.descricao ? String(body.descricao).trim() : null
  const ativo = body.ativo !== undefined ? (body.ativo ? 1 : 0) : 1

  const result = db.prepare(`
    INSERT INTO areas (codigo, nome, sigla, diretoria_id, descricao, ativo, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(codigo, nome, sigla, diretoria_id, descricao, ativo)

  registrarAuditoria({
    usuario_id: session.id,
    usuario_nome: session.nome,
    acao: 'CREATE',
    entidade: 'areas',
    entidade_id: result.lastInsertRowid as number,
    descricao: `Área "${nome}" criada`,
    dados_antes: null,
    dados_depois: { id: result.lastInsertRowid, nome, sigla, diretoria_id, descricao, ativo },
  })

  return NextResponse.json({ ok: true, id: result.lastInsertRowid }, { status: 201 })
}
