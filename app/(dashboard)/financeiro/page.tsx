import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'
import { UsuariosRepository } from '@/lib/repositories'
import FinanceiroClient from './FinanceiroClient'

export default async function FinanceiroPage() {
  const session = await getSession()
  if (!session) return null

  const db = getDb()

  // Resumo geral
  const projetos = db.prepare(`
    SELECT p.id, p.codigo, p.nome, p.status, p.capex_aprovado, p.opex_aprovado,
           d.nome as diretoria_nome,
           COALESCE(cap.total,0) as capex_realizado,
           COALESCE(opx.total,0) as opex_realizado
    FROM projetos p
    LEFT JOIN diretorias d ON p.diretoria_id = d.id
    LEFT JOIN (
      SELECT projeto_id, SUM(valor) as total FROM financeiro_lancamentos WHERE tipo='CAPEX' AND status='APROVADO' GROUP BY projeto_id
    ) cap ON cap.projeto_id = p.id
    LEFT JOIN (
      SELECT projeto_id, SUM(valor) as total FROM financeiro_lancamentos WHERE tipo='OPEX' AND status='APROVADO' GROUP BY projeto_id
    ) opx ON opx.projeto_id = p.id
    WHERE p.ativo = 1
    ORDER BY p.capex_aprovado + p.opex_aprovado DESC
  `).all()

  const configFinanceira = db.prepare(
    "SELECT chave, valor FROM config_global WHERE chave IN ('selic','taxa_desconto','inflacao')"
  ).all() as { chave: string; valor: string }[]

  const ultimosLancamentosRaw = db.prepare(`
    SELECT fl.*, p.nome as projeto_nome, p.codigo as projeto_codigo
    FROM financeiro_lancamentos fl
    LEFT JOIN projetos p ON fl.projeto_id = p.id
    ORDER BY fl.created_at DESC
    LIMIT 20
  `).all() as (Record<string, unknown> & { criado_por: number | null })[]
  const criadorIds = [...new Set(ultimosLancamentosRaw.map(l => l.criado_por).filter((v): v is number => v != null))]
  const criadorNomes = await UsuariosRepository.findNomesPorIds(criadorIds)
  const ultimosLancamentos = ultimosLancamentosRaw.map(l => ({
    ...l,
    criador_nome: l.criado_por != null ? criadorNomes.get(l.criado_por)?.nome ?? null : null,
  }))

  return (
    <FinanceiroClient
      projetos={projetos as never[]}
      configFinanceira={Object.fromEntries(configFinanceira.map(c => [c.chave, parseFloat(c.valor)]))}
      ultimosLancamentos={ultimosLancamentos as never[]}
      session={session}
    />
  )
}
