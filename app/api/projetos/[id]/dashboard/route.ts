import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'
import { asyncDb } from '@/lib/database'
import { CronogramaRepository } from '@/lib/repositories/cronograma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id } = await params
  const projeto_id = Number(id)
  const db = getDb()

  // 1. Cronograma — ALL levels (FASE, TAREFA, SUBTAREFA)
  const cronRow = CronogramaRepository.findCronogramaVigente(projeto_id)

  let cronTotal = 0, cronConcluidas = 0, cronAtrasadas = 0
  if (cronRow) {
    const hoje = new Date().toISOString().slice(0, 10)
    const tarefas = db.prepare(`
      SELECT data_conclusao, data_fim, status
      FROM cronograma_tarefas
      WHERE cronograma_id = ? AND (ativo IS NULL OR ativo = 1)
    `).all(cronRow.id) as { data_conclusao: string | null; data_fim: string | null; status: string }[]
    cronTotal = tarefas.length
    cronConcluidas = tarefas.filter(t => t.data_conclusao || t.status === 'CONCLUIDA').length
    cronAtrasadas = tarefas.filter(t => !t.data_conclusao && t.status !== 'CONCLUIDA' && t.data_fim && t.data_fim < hoje).length
  }
  const cronPct = cronTotal > 0 ? Math.round((cronConcluidas / cronTotal) * 100) : 0

  // 2. Financeiro — planejado from viabilidade, realizado from financeiro_contratos
  const vib = await asyncDb.queryOne<{ capex: number | null; opex: number | null }>(
    `SELECT capex, opex FROM "AI"."TI_PMO_VIABILIDADE"
     WHERE projeto_id = ? ORDER BY versao DESC LIMIT 1`,
    [projeto_id]
  )

  const projeto = db.prepare(`SELECT capex_aprovado, opex_aprovado, status FROM projetos WHERE id = ?`).get(projeto_id) as { capex_aprovado: number; opex_aprovado: number; status: string }

  const capexPlanejado = (vib?.capex ?? 0) > 0 ? (vib!.capex ?? 0) : (projeto.capex_aprovado ?? 0)
  const opexPlanejado  = (vib?.opex  ?? 0) > 0 ? (vib!.opex  ?? 0) : (projeto.opex_aprovado  ?? 0)

  // Realizado: sum from new contratos system
  const pagRow = db.prepare(`
    SELECT COALESCE(SUM(fp.valor_pago), 0) AS total
    FROM financeiro_pagamentos fp
    JOIN financeiro_contratos fc ON fp.contrato_id = fc.id
    WHERE fc.projeto_id = ? AND (fc.ativo IS NULL OR fc.ativo = 1)
      AND (fp.ativo IS NULL OR fp.ativo = 1)
      AND fp.contrato_id IS NOT NULL
  `).get(projeto_id) as { total: number }

  // Fallback: old lancamentos system if contratos system has no data
  const lancRow = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN tipo='CAPEX' THEN valor ELSE 0 END), 0) AS capex,
      COALESCE(SUM(CASE WHEN tipo='OPEX'  THEN valor ELSE 0 END), 0) AS opex
    FROM financeiro_lancamentos WHERE projeto_id = ?
  `).get(projeto_id) as { capex: number; opex: number }

  const totalRealizadoContratos = pagRow?.total ?? 0
  const capexRealizadoLanc = lancRow?.capex ?? 0
  const opexRealizadoLanc  = lancRow?.opex  ?? 0

  // Use contratos if any data exists, otherwise fall back to lancamentos
  const totalPlanejado  = capexPlanejado + opexPlanejado
  const totalRealizado  = totalRealizadoContratos > 0
    ? totalRealizadoContratos
    : capexRealizadoLanc + opexRealizadoLanc
  const capexRealizado  = totalRealizadoContratos > 0 ? totalRealizadoContratos : capexRealizadoLanc
  const opexRealizado   = totalRealizadoContratos > 0 ? 0 : opexRealizadoLanc

  const financPct = totalPlanejado > 0 ? Math.min(100, Math.round((totalRealizado / totalPlanejado) * 100)) : 0

  // 3. Payback
  const status = projeto.status
  const isEncerrado = ['PAYBACK_ENCERRADO', 'PROJETO_ENCERRADO'].includes(status)
  const isConcluido = ['PROJETO_CONCLUIDO', 'PAYBACK_ACOMPANHAMENTO'].includes(status)
  const paybackPct   = isEncerrado ? 100 : 0
  const paybackLabel = isEncerrado
    ? 'Payback encerrado'
    : isConcluido
    ? 'Em acompanhamento'
    : 'Disponível após conclusão'

  return NextResponse.json({
    cronograma: { total: cronTotal, concluidas: cronConcluidas, atrasadas: cronAtrasadas, pct: cronPct },
    financeiro: {
      capex_planejado: capexPlanejado, capex_realizado: capexRealizado,
      capex_saldo: capexPlanejado - capexRealizado, capex_pct: capexPlanejado > 0 ? Math.min(100, Math.round((capexRealizado / capexPlanejado) * 100)) : 0,
      opex_planejado: opexPlanejado, opex_realizado: opexRealizado,
      opex_saldo: opexPlanejado - opexRealizado, opex_pct: opexPlanejado > 0 ? Math.min(100, Math.round((opexRealizado / opexPlanejado) * 100)) : 0,
      total_planejado: totalPlanejado, total_realizado: totalRealizado,
      total_saldo: totalPlanejado - totalRealizado, total_pct: financPct,
    },
    payback: { pct: paybackPct, label: paybackLabel, is_concluido: isConcluido || isEncerrado },
  })
}
