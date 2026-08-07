import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'
import { registrarAuditoria } from '@/lib/db/auditoria'

export async function GET(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const db = getDb()
  const diretorias = db.prepare(`
    SELECT d.*,
      COUNT(DISTINCT p.id)  AS projeto_count,
      COUNT(DISTINCT a.id)  AS area_count,
      COUNT(DISTINCT us.id) AS usuario_count,
      dir.nome AS diretor_responsavel_nome
    FROM diretorias d
    LEFT JOIN projetos  p  ON p.diretoria_id  = d.id AND p.ativo = 1
    LEFT JOIN areas     a  ON a.diretoria_id  = d.id AND a.ativo = 1
    LEFT JOIN usuarios  us ON us.diretoria_id = d.id AND us.ativo = 1
    LEFT JOIN usuarios  dir ON dir.id = d.diretor_responsavel_id
    GROUP BY d.id
    ORDER BY d.nome
  `).all()

  return NextResponse.json({ diretorias })
}

export async function POST(request: NextRequest) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (session.perfil !== 'ADMIN')
    return NextResponse.json({ error: 'Sem permissão — apenas ADMIN.' }, { status: 403 })

  const body = await request.json()
  const nome = String(body.nome || '').trim().replace(/\s+/g, ' ')
  const descricao = body.descricao ? String(body.descricao).trim() : null
  const ativo = body.ativo === 0 ? 0 : 1

  if (!nome) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 422 })

  const db = getDb()
  const duplicado = db.prepare('SELECT id FROM diretorias WHERE LOWER(TRIM(nome)) = LOWER(?) AND id != 0').get(nome)
  if (duplicado) return NextResponse.json({ error: 'Já existe uma diretoria com este nome.' }, { status: 409 })

  const sigla = nome.replace(/[aeiouáéíóúãõâêôàèìùç\s]/gi, '').toUpperCase().slice(0, 5) || nome.slice(0, 4).toUpperCase()
  const base = 'DIR-' + nome.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10)
  let codigo = base
  let seq = 2
  while (db.prepare('SELECT id FROM diretorias WHERE codigo = ?').get(codigo)) {
    codigo = base + seq++
  }

  const now = new Date().toISOString()
  const diretor_responsavel_id = body.diretor_responsavel_id ? Number(body.diretor_responsavel_id) : null
  if (diretor_responsavel_id) {
    const dir = db.prepare("SELECT id FROM usuarios WHERE id = ? AND ativo = 1 AND perfil_id = (SELECT id FROM perfis WHERE codigo = 'DIRETOR')").get(diretor_responsavel_id)
    if (!dir) return NextResponse.json({ error: 'Diretor responsável inválido. O usuário deve estar ativo e ter perfil DIRETOR.' }, { status: 422 })
  }

  const result = db.prepare(`
    INSERT INTO diretorias (codigo, nome, sigla, descricao, ativo, diretor_responsavel_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(codigo, nome, sigla, descricao, ativo, diretor_responsavel_id, now, now)

  const nova = db.prepare('SELECT * FROM diretorias WHERE id = ?').get(result.lastInsertRowid)

  registrarAuditoria({
    usuario_id: session.id,
    usuario_nome: session.nome,
    acao: 'CREATE',
    entidade: 'diretorias',
    entidade_id: Number(result.lastInsertRowid),
    descricao: `Diretoria "${nome}" criada`,
    dados_antes: null,
    dados_depois: nova,
  })

  return NextResponse.json({ diretoria: nova }, { status: 201 })
}
