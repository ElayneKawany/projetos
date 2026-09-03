import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { buscarOrcamento, calcularTotaisOrcamento, criarGrupo } from '@/lib/orcamento'
import type { TipoInvestimento } from '@/lib/orcamento'
import { registrarEvento } from '@/lib/timeline'
import { asyncDb } from '@/lib/database'

/** GET /api/projetos/[id]/orcamento — retorna grupos + itens + totais */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id } = await params
  const projeto_id = Number(id)

  const grupos = await buscarOrcamento(projeto_id)
  const totais  = calcularTotaisOrcamento(projeto_id)

  return NextResponse.json({ grupos, totais })
}

/** POST /api/projetos/[id]/orcamento — cria novo grupo */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  if (!['ADMIN', 'PMO', 'GESTOR'].includes(session.perfil)) {
    return NextResponse.json({ error: 'Sem permissão para criar grupos de orçamento.' }, { status: 403 })
  }

  const { id } = await params
  const projeto_id = Number(id)

  // Bloquear criação se a viabilidade mais recente estiver APROVADA e não houver revisão
  const viabilidade = await asyncDb.queryOne<{ status: string }>(
    `SELECT status FROM "AI"."TI_PMO_VIABILIDADE" WHERE projeto_id = ? ORDER BY versao DESC LIMIT 1`,
    [projeto_id]
  )
  if (viabilidade?.status === 'APROVADO') {
    return NextResponse.json({ error: 'O orçamento está bloqueado. O Estudo de Viabilidade foi aprovado. Solicite uma revisão para editar.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as {
    tipo?: TipoInvestimento
    nome?: string
    cor?: string
    icone?: string
    viabilidade_id?: number
    ordem?: number
  }

  if (!body.tipo || !body.nome?.trim()) {
    return NextResponse.json({ error: 'Tipo e nome são obrigatórios.' }, { status: 400 })
  }

  const grupoId = criarGrupo({
    projeto_id,
    viabilidade_id: body.viabilidade_id ?? null,
    tipo: body.tipo,
    nome: body.nome.trim(),
    cor: body.cor,
    icone: body.icone,
    ordem: body.ordem ?? 0,
    criado_por: session.id,
  })

  registrarEvento({
    projeto_id,
    modulo: 'ORCAMENTO',
    artefato: 'GRUPO',
    evento: 'CRIADO',
    titulo: `Grupo de orçamento criado: ${body.nome}`,
    descricao: `Tipo: ${body.tipo}`,
    usuario_id: session.id,
    usuario_nome: session.nome,
    referencia_id: grupoId,
    referencia_tipo: 'orcamento_grupos',
  })

  return NextResponse.json({ ok: true, id: grupoId }, { status: 201 })
}
