import { NextRequest, NextResponse } from 'next/server'
import { getSession, hashSenha } from '@/lib/auth'
import getDb from '@/lib/db'
import { registrarAuditoria } from '@/lib/db/auditoria'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const db = getDb()
  const usuarios = db.prepare(`
    SELECT u.id, u.cpf, u.nome, u.email, u.cargo, u.ativo,
           p.codigo as perfil, d.nome as diretoria_nome
    FROM usuarios u JOIN perfis p ON u.perfil_id=p.id
    LEFT JOIN diretorias d ON u.diretoria_id=d.id
    WHERE u.ativo=1 ORDER BY u.nome
  `).all()
  return NextResponse.json({ usuarios })
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session || session.perfil !== 'ADMIN') {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }
  const body = await request.json()
  const { nome, cpf, email, cargo, perfil_id, diretoria_id, area_id, senha } = body

  if (!nome || !cpf || !email || !senha || !perfil_id) {
    return NextResponse.json({ error: 'Campos obrigatórios faltando.' }, { status: 400 })
  }
  if (senha.length < 8) {
    return NextResponse.json({ error: 'Senha deve ter no mínimo 8 caracteres.' }, { status: 400 })
  }

  const db = getDb()
  const existente = db.prepare('SELECT id FROM usuarios WHERE cpf=? OR email=?').get(cpf, email)
  if (existente) return NextResponse.json({ error: 'CPF ou e-mail já cadastrado.' }, { status: 409 })

  const senhaHash = await hashSenha(senha)
  const result = db.prepare(`
    INSERT INTO usuarios (cpf, nome, email, senha_hash, cargo, perfil_id, diretoria_id, area_id)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(cpf, nome, email, senhaHash, cargo||null, perfil_id, diretoria_id||null, area_id||null)

  registrarAuditoria({
    usuario_id: session.id, usuario_nome: session.nome,
    acao: 'CREATE', entidade: 'usuarios', entidade_id: Number(result.lastInsertRowid),
    descricao: `Usuário criado: ${nome} (${email})`,
  })

  return NextResponse.json({ id: result.lastInsertRowid }, { status: 201 })
}
