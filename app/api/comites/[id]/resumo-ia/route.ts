import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import { ComitesRepository } from '@/lib/repositories'
import Anthropic from '@anthropic-ai/sdk'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'PMO')) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  const { id } = await params
  const comiteId = parseInt(id)

  const comite = ComitesRepository.findRaw(comiteId) as Record<string, unknown> | undefined
  if (!comite) return NextResponse.json({ error: 'Comitê não encontrado.' }, { status: 404 })

  const hoje = new Date().toISOString().substring(0, 10)

  const projetos = await ComitesRepository.findPortfolioAtivoParaIA()
  const totalFinPago = ComitesRepository.findTotalFinanceiroPago()
  const totalBeneficio = ComitesRepository.findTotalBeneficioPayback()
  const decisoesPendentes = ComitesRepository.findDecisoesPendentes(comiteId) as Record<string, unknown>[]
  const comiteAnterior = ComitesRepository.findComiteAnterior(comiteId)

  let projetosAvancaram: Record<string, unknown>[] = []
  if (comiteAnterior) {
    projetosAvancaram = ComitesRepository.findMovimentosRecentes(comiteAnterior.data_realizacao) as Record<string, unknown>[]
  }

  const totalAprovado = projetos.reduce((s, p) => s + ((p.capex_aprovado as number) || 0), 0)

  const statusAtivos = ['EXECUCAO', 'GOLIVE', 'ROI', 'ESTRUTURACAO', 'CRONOGRAMA']
  const projetosAtivos = projetos.filter(p => statusAtivos.includes(p.status as string))
  const atrasados = projetosAtivos.filter(p => p.data_fim_prev && String(p.data_fim_prev) < hoje)
  const emAtencao = projetosAtivos.filter(p => {
    if (!p.data_fim_prev) return false
    const diff = (new Date(p.data_fim_prev as string).getTime() - new Date(hoje).getTime()) / (1000 * 60 * 60 * 24)
    return diff >= 0 && diff <= 30 && diff > 0
  })
  const semCronograma = projetos.filter(p => statusAtivos.includes(p.status as string) && !p.data_fim_prev)

  const contexto = {
    comite: { titulo: comite.titulo, data: comite.data_realizacao, tipo: comite.tipo },
    comite_anterior: comiteAnterior || null,
    hoje,
    resumo_portfolio: {
      total: projetos.length,
      por_status: projetos.reduce<Record<string, number>>((acc, p) => {
        const s = p.status as string
        acc[s] = (acc[s] || 0) + 1
        return acc
      }, {}),
      investimento_aprovado: totalAprovado,
      investimento_executado: totalFinPago,
      beneficio_realizado: totalBeneficio,
    },
    saude: {
      atrasados: atrasados.map(p => ({ codigo: p.codigo, nome: p.nome, prazo: p.data_fim_prev, diretoria: p.diretoria })),
      em_atencao: emAtencao.map(p => ({ codigo: p.codigo, nome: p.nome, prazo: p.data_fim_prev, diretoria: p.diretoria })),
      sem_cronograma: semCronograma.map(p => ({ codigo: p.codigo, nome: p.nome, status: p.status, diretoria: p.diretoria })),
    },
    decisoes_pendentes: decisoesPendentes,
    movimentos_recentes: projetosAvancaram.slice(0, 15),
    projetos_por_diretoria: projetos.reduce<Record<string, { count: number; investimento: number }>>((acc, p) => {
      const d = (p.diretoria as string) || 'Sem Diretoria'
      if (!acc[d]) acc[d] = { count: 0, investimento: 0 }
      acc[d].count++
      acc[d].investimento += (p.capex_aprovado as number) || 0
      return acc
    }, {}),
  }

  ComitesRepository.updateResumoIaGeradoEm(comiteId, new Date().toISOString())

  const client = new Anthropic()

  const promptSistema = `Você é um consultor sênior de PMO especializado em governança corporativa.
Sua tarefa é gerar uma Análise Executiva da Carteira de Projetos para ser apresentada à Diretoria em um Comitê Executivo.

Retorne EXCLUSIVAMENTE um objeto JSON válido, sem texto adicional, no seguinte formato:
{
  "situacao_geral": "Parágrafo objetivo sobre o estado atual da carteira (3-5 linhas)",
  "indicador_geral": "BOA" | "ATENCAO" | "CRITICA",
  "justificativa_indicador": "Frase explicando o indicador",
  "principais_avancos": ["Avanço 1", "Avanço 2", "..."],
  "principais_riscos": ["Risco 1", "Risco 2", "..."],
  "diretorias_atencao": [
    { "diretoria": "Nome", "motivo": "Motivo de atenção" }
  ],
  "impactos_financeiros": "Parágrafo sobre situação financeira da carteira",
  "decisoes_prioritarias": ["Decisão 1", "Decisão 2", "..."],
  "recomendacoes": ["Recomendação 1", "Recomendação 2", "..."]
}

Instruções:
- Seja objetivo e executivo — foque em impacto para o negócio, não detalhes técnicos
- Use linguagem formal adequada para Diretoria
- Baseie-se nos dados fornecidos, não invente informações
- Identifique padrões e tendências nos dados
- Priorize o que exige decisão ou atenção imediata`

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: 'claude-opus-4-8',
          max_tokens: 4096,
          thinking: { type: 'adaptive' },
          system: promptSistema,
          messages: [{
            role: 'user',
            content: `Analise os dados da carteira e gere o Resumo Executivo para o Comitê "${comite.titulo}":\n\n${JSON.stringify(contexto, null, 2)}`,
          }],
        })

        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
        controller.close()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao gerar análise'
        controller.enqueue(encoder.encode(`{"error":"${msg}"}`))
        controller.close()
      }
    },
  })

  return new NextResponse(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    },
  })
}
