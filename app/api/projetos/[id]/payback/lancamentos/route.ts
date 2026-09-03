import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import getDb from '@/lib/db'
import { asyncDb } from '@/lib/database'
import { registrarAuditoria } from '@/lib/db/auditoria'
import { calcularResumoPayback } from '@/lib/payback/calcularLancamentos'
import type { PaybackLancamento } from '@/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id } = await params
  const projeto_id = Number(id)
  const db = getDb()

  const projeto = db.prepare(
    'SELECT capex_aprovado, opex_aprovado, data_conclusao_real, nome FROM projetos WHERE id = ? AND ativo = 1'
  ).get(projeto_id) as { capex_aprovado: number; opex_aprovado: number; data_conclusao_real: string | null; nome: string } | undefined

  if (!projeto) return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })

  // Viabilidade aprovada mais recente
  const viabilidade = await asyncDb.queryOne<{ capex: number | null; opex: number | null; economia_estimada: number | null; payback_meses: number | null }>(
    `SELECT capex, opex, economia_estimada, payback_meses
     FROM "AI"."TI_PMO_VIABILIDADE"
     WHERE projeto_id = ? AND status = 'APROVADO'
     ORDER BY versao DESC LIMIT 1`,
    [projeto_id]
  )

  const lancamentos = db.prepare(
    'SELECT * FROM payback_lancamentos WHERE projeto_id = ? ORDER BY competencia ASC'
  ).all(projeto_id) as PaybackLancamento[]

  const resumo = calcularResumoPayback(viabilidade ?? null, projeto, lancamentos)

  return NextResponse.json({ resumo, projeto: { nome: projeto.nome } })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'PMO')) {
    return NextResponse.json({ error: 'Sem permissão. Apenas PMO ou Admin.' }, { status: 403 })
  }

  const { id } = await params
  const projeto_id = Number(id)
  const db = getDb()

  const projeto = db.prepare('SELECT id FROM projetos WHERE id = ? AND ativo = 1').get(projeto_id)
  if (!projeto) return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })

  const body = await request.json()
  const { competencia, data_lancamento, investimento_periodo, beneficio_periodo, tipo_beneficio, observacao } = body

  if (!competencia || !data_lancamento) {
    return NextResponse.json({ error: 'Competência e data de lançamento são obrigatórias.' }, { status: 400 })
  }
  if (investimento_periodo == null && beneficio_periodo == null) {
    return NextResponse.json({ error: 'Informe ao menos o investimento ou o benefício.' }, { status: 400 })
  }

  const stmt = db.prepare(`
    INSERT INTO payback_lancamentos
      (projeto_id, competencia, data_lancamento, investimento_periodo, beneficio_periodo, tipo_beneficio, observacao, usuario_id, usuario_nome)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const result = stmt.run(
    projeto_id,
    competencia,
    data_lancamento,
    Number(investimento_periodo ?? 0),
    Number(beneficio_periodo ?? 0),
    tipo_beneficio ?? null,
    observacao ?? null,
    session.id,
    session.nome,
  ) as { lastInsertRowid: number }

  registrarAuditoria({
    usuario_id: session.id,
    usuario_nome: session.nome,
    acao: 'CREATE',
    entidade: 'payback_lancamentos',
    entidade_id: result.lastInsertRowid,
    projeto_id,
    descricao: `Lançamento de payback criado — competência ${competencia}`,
    dados_depois: { competencia, investimento_periodo, beneficio_periodo, tipo_beneficio },
  })

  const novo = db.prepare('SELECT * FROM payback_lancamentos WHERE id = ?').get(result.lastInsertRowid)
  return NextResponse.json(novo, { status: 201 })
}
