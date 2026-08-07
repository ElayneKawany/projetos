import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { calcularPayback, type DadosBasePayback, type RegistroPayback } from '@/lib/payback/calcularPayback'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const projetoId = Number(id)
  const db = getDb()

  // Busca dados base da viabilidade aprovada mais recente
  const viab = db.prepare(`
    SELECT v.capex, v.opex, v.economia_estimada, v.economia_periodicidade,
           v.payback_informado, v.payback_unidade,
           v.baseline_valor, v.meta_valor, v.tipo_indicador, v.economia_mensal_esperada,
           v.tipo_payback_quantitativo, v.tipo_payback_qualitativo
    FROM viabilidade v
    WHERE v.projeto_id = ? AND v.status = 'APROVADO'
    ORDER BY v.versao DESC LIMIT 1
  `).get(projetoId) as Record<string, unknown> | undefined

  // Se não há aprovada, pega a mais recente (qualquer status)
  const viabFallback = !viab ? db.prepare(`
    SELECT v.capex, v.opex, v.economia_estimada, v.economia_periodicidade,
           v.payback_informado, v.payback_unidade,
           v.baseline_valor, v.meta_valor, v.tipo_indicador, v.economia_mensal_esperada,
           v.tipo_payback_quantitativo, v.tipo_payback_qualitativo
    FROM viabilidade v
    WHERE v.projeto_id = ? ORDER BY v.versao DESC LIMIT 1
  `).get(projetoId) as Record<string, unknown> | undefined : undefined

  const v = viab ?? viabFallback

  // Projeto — para data conclusão real e investimento total
  const projeto = db.prepare(`
    SELECT data_conclusao_real, data_fim_prev, data_inicio_prev, capex_aprovado, opex_aprovado
    FROM projetos WHERE id = ?
  `).get(projetoId) as Record<string, unknown> | undefined

  // Registros de payback
  const registros = db.prepare(`
    SELECT pr.id, pr.data, pr.valor_real, pr.origem, pr.observacao, pr.criado_por, pr.created_at,
           u.nome AS criador_nome
    FROM payback_registros pr
    LEFT JOIN usuarios u ON u.id = pr.criado_por
    WHERE pr.projeto_id = ?
    ORDER BY pr.data ASC
  `).all(projetoId) as RegistroPayback[]

  const capex = Number(v?.capex ?? 0)
  const opex = Number(v?.opex ?? 0)
  const economiaMensalEsperada = v?.economia_mensal_esperada !== null && v?.economia_mensal_esperada !== undefined
    ? Number(v.economia_mensal_esperada)
    : (v?.economia_estimada !== null && v?.economia_estimada !== undefined
        ? (v?.economia_periodicidade === 'ANUAL' ? Number(v.economia_estimada) / 12 : Number(v.economia_estimada))
        : null)

  const base: DadosBasePayback = {
    baselineValor: v?.baseline_valor !== undefined && v?.baseline_valor !== null ? Number(v.baseline_valor) : null,
    metaValor: v?.meta_valor !== undefined && v?.meta_valor !== null ? Number(v.meta_valor) : null,
    tipoIndicador: (v?.tipo_indicador as 'PERCENTUAL' | 'ABSOLUTO') ?? 'ABSOLUTO',
    economiaMensalEsperada,
    paybackPrevistoMeses: v?.payback_informado !== undefined && v?.payback_informado !== null
      ? (v?.payback_unidade === 'ANOS' ? Number(v.payback_informado) * 12 : Number(v.payback_informado))
      : null,
    investimentoTotal: (capex + opex) > 0 ? capex + opex : null,
    dataGolive: (projeto?.data_conclusao_real as string) ?? (projeto?.data_fim_prev as string) ?? null,
  }

  const resultado = calcularPayback(base, registros)

  return NextResponse.json({
    base,
    registros,
    resultado,
    viabilidade: v ?? null,
    projeto: projeto ?? null,
  })
}
