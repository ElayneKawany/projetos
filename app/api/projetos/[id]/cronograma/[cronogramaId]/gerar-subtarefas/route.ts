import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { CronogramaRepository } from '@/lib/repositories'
import Anthropic from '@anthropic-ai/sdk'
import { apiLogger } from '@/lib/logger'

const client = new Anthropic()

// ── Tipos internos ────────────────────────────────────────────────────────────

interface ProjetoCtx {
  nome: string
  objetivo: string | null
  tipo_projeto: string | null
  diretoria_nome: string | null
  area_nome: string | null
}

interface TarefaRow {
  id: number
  nivel: string
  nome: string
  descricao: string | null
  ordem: number
}

interface TapCtx {
  objetivo_detalhado: string | null
  situacao_atual: string | null
  escopo_fisico: string | null
  escopo_sistemico: string | null
  escopo_processo: string | null
}

interface ViabilidadeCtx {
  resumo_executivo: string | null
  sistemas_envolvidos: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sec(titulo: string, conteudo: string | null | undefined): string {
  if (!conteudo?.trim()) return ''
  return `\n### ${titulo}\n${conteudo.trim()}`
}

function buildPrompt(params: {
  projeto: ProjetoCtx
  fasePai: string | null
  tarefa: { nome: string; descricao: string | null }
  cronogramaResumo: string
  tap: TapCtx | null
  viabilidade: ViabilidadeCtx | null
}): string {
  const { projeto, fasePai, tarefa, cronogramaResumo, tap, viabilidade } = params

  const linhasContexto: string[] = []

  // Cabeçalho do projeto
  linhasContexto.push(`# Contexto do Projeto`)
  linhasContexto.push(`**Projeto:** ${projeto.nome}`)
  if (projeto.objetivo)       linhasContexto.push(`**Objetivo:** ${projeto.objetivo}`)
  if (projeto.tipo_projeto)   linhasContexto.push(`**Tipo:** ${projeto.tipo_projeto}`)
  if (projeto.diretoria_nome) linhasContexto.push(`**Diretoria:** ${projeto.diretoria_nome}`)
  if (projeto.area_nome)      linhasContexto.push(`**Área responsável:** ${projeto.area_nome}`)

  // Fase pai
  if (fasePai) linhasContexto.push(`**Fase (Macro):** ${fasePai}`)

  // Tarefa
  linhasContexto.push(`\n# Tarefa alvo`)
  linhasContexto.push(`**Nome:** ${tarefa.nome}`)
  if (tarefa.descricao) linhasContexto.push(`**Descrição:** ${tarefa.descricao}`)

  // Cronograma existente (estrutura resumida para contexto)
  if (cronogramaResumo) {
    linhasContexto.push(`\n# Estrutura do Cronograma`)
    linhasContexto.push(cronogramaResumo)
  }

  // TAP
  if (tap) {
    const tapSecs = [
      sec('Objetivo detalhado', tap.objetivo_detalhado),
      sec('Situação atual', tap.situacao_atual),
      sec('Escopo Físico', tap.escopo_fisico),
      sec('Escopo Sistêmico', tap.escopo_sistemico),
      sec('Escopo de Processo', tap.escopo_processo),
    ].filter(Boolean).join('')
    if (tapSecs) {
      linhasContexto.push(`\n# TAP (Termo de Abertura do Projeto)`)
      linhasContexto.push(tapSecs)
    }
  }

  // Viabilidade
  if (viabilidade) {
    const vSecs = [
      sec('Resumo executivo', viabilidade.resumo_executivo),
      sec('Sistemas envolvidos', viabilidade.sistemas_envolvidos),
    ].filter(Boolean).join('')
    if (vSecs) {
      linhasContexto.push(`\n# Estudo de Viabilidade`)
      linhasContexto.push(vSecs)
    }
  }

  return `Você é um especialista em gerenciamento de projetos corporativos (PMO), com profundo conhecimento em WBS e decomposição de atividades.

${linhasContexto.join('\n')}

---

# Instrução

Gere as **subtarefas específicas** para a tarefa acima, com base em todo o contexto fornecido.

Regras obrigatórias:
- As subtarefas devem representar **atividades reais de execução** desta tarefa específica, não um checklist genérico.
- A quantidade deve ser proporcional à complexidade da tarefa — pode ser 2, pode ser 8. Não existe número fixo.
- Cada subtarefa deve ter nome claro e acionável (ex.: "Mapear processos atuais de aprovação", não "Analisar processos").
- Considere o contexto completo: fase, objetivo, escopo, sistemas, área responsável.
- Nunca repita subtarefas de outras tarefas do mesmo cronograma.
- Se a tarefa for de implantação, as subtarefas devem ser de implantação.
- Se for treinamento, as subtarefas devem ser de treinamento.
- Se for Go Live, as subtarefas devem ser as atividades típicas de entrada em produção.

Responda **apenas** com JSON no formato abaixo, sem texto adicional, sem markdown, sem backticks:
{
  "subtarefas": [
    { "nome": "Nome objetivo da subtarefa", "descricao": "Detalhamento opcional, 1 frase" },
    ...
  ]
}`
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cronogramaId: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id, cronogramaId } = await params
  const projeto_id    = Number(id)
  const cronograma_id = Number(cronogramaId)

  const cronograma = await CronogramaRepository.findByIdAndProjetoId(cronograma_id, projeto_id) as Record<string, unknown> | undefined

  if (!cronograma) {
    return NextResponse.json({ error: 'Cronograma não encontrado.' }, { status: 404 })
  }

  const body = await request.json() as {
    tarefa_id: number
    tarefa_nome: string
    tarefa_descricao?: string
  }

  if (!body.tarefa_nome?.trim()) {
    return NextResponse.json({ error: 'Nome da tarefa é obrigatório.' }, { status: 400 })
  }

  // ── Coleta de contexto ────────────────────────────────────────────────────

  const projeto = CronogramaRepository.findProjetoComJoins(projeto_id) as ProjetoCtx | undefined

  if (!projeto) {
    return NextResponse.json({ error: 'Projeto não encontrado.' }, { status: 404 })
  }

  const tap        = CronogramaRepository.findTapRecente(projeto_id) as TapCtx | undefined | null
  const viabilidade = await CronogramaRepository.findViabilidadeRecente(projeto_id) as ViabilidadeCtx | undefined | null
  const tarefasExistentes = CronogramaRepository.findTarefasFasesTarefas(cronograma_id) as TarefaRow[]

  // Fase pai da tarefa informada
  let fasePai: string | null = null
  const tarefaIdx = tarefasExistentes.findIndex(t => t.id === body.tarefa_id)
  if (tarefaIdx > 0) {
    for (let i = tarefaIdx - 1; i >= 0; i--) {
      if (tarefasExistentes[i].nivel === 'FASE') {
        fasePai = tarefasExistentes[i].nome
        break
      }
    }
  }

  // Resumo textual do cronograma (máx. 40 itens para não explodir o contexto)
  const top40 = tarefasExistentes.slice(0, 40)
  let faseAtual = ''
  const linhasCron: string[] = []
  for (const t of top40) {
    if (t.nivel === 'FASE') {
      faseAtual = t.nome
      linhasCron.push(`FASE: ${t.nome}`)
    } else {
      const marcador = t.id === body.tarefa_id ? ' ◀ (esta tarefa)' : ''
      linhasCron.push(`  TAREFA: ${t.nome}${marcador}`)
    }
  }
  if (tarefasExistentes.length > 40) {
    linhasCron.push(`  ... e mais ${tarefasExistentes.length - 40} itens`)
  }
  const cronogramaResumo = linhasCron.join('\n')
  void faseAtual // evita warning de variável não usada

  // ── Construir e enviar prompt ─────────────────────────────────────────────

  const prompt = buildPrompt({
    projeto,
    fasePai,
    tarefa: { nome: body.tarefa_nome.trim(), descricao: body.tarefa_descricao ?? null },
    cronogramaResumo,
    tap: tap ?? null,
    viabilidade: viabilidade ?? null,
  })

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = response.content.find(b => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'Resposta inválida da IA.' }, { status: 500 })
    }

    // Extrai JSON mesmo se a resposta vier com backticks ou texto extra
    const raw = textBlock.text.trim()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Formato de resposta inválido.' }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0]) as { subtarefas: { nome: string; descricao: string }[] }

    if (!Array.isArray(parsed.subtarefas) || parsed.subtarefas.length === 0) {
      return NextResponse.json({ error: 'Nenhuma subtarefa gerada.' }, { status: 500 })
    }

    return NextResponse.json({ subtarefas: parsed.subtarefas })
  } catch (err: unknown) {
    apiLogger.error({ err, route: 'GERAR-SUBTAREFAS' }, 'Erro')
    return NextResponse.json(
      { error: 'Erro ao gerar subtarefas. Verifique a configuração da API.' },
      { status: 500 }
    )
  }
}
