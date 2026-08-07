// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface ErroValidacao {
  campo: string
  label: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseArr(val?: string | null): string[] {
  if (!val) return []
  try {
    const p = JSON.parse(val)
    return Array.isArray(p) ? p.filter((s: string) => String(s).trim()) : []
  } catch { return [] }
}

function req(erros: ErroValidacao[], campo: string, label: string, valor?: string | null) {
  if (!valor?.trim()) erros.push({ campo, label })
}

function reqNum(erros: ErroValidacao[], campo: string, label: string, valor?: number | null) {
  if (valor === null || valor === undefined) erros.push({ campo, label })
}

function reqArr(erros: ErroValidacao[], campo: string, label: string, rawJson?: string | null) {
  if (!parseArr(rawJson).length) erros.push({ campo, label })
}

// ─── TAP ─────────────────────────────────────────────────────────────────────

export interface TapParaValidar {
  objetivo_detalhado?: string | null
  situacao_atual?: string | null
  escopo_fisico?: string | null
  escopo_sistemico?: string | null
  escopo_processo?: string | null
  setores_envolvidos?: string | null
  etapas_projeto?: string | null
  entregaveis?: string | null
  pontos_atencao?: string | null
  beneficios_tap?: string | null
  pontos_definir?: string | null
}

export function validarTap(tap: TapParaValidar): ErroValidacao[] {
  const erros: ErroValidacao[] = []
  req(erros, 'objetivo_detalhado',  '1. Objetivo do Projeto',          tap.objetivo_detalhado)
  req(erros, 'situacao_atual',      '2. Situação Atual',               tap.situacao_atual)
  req(erros, 'escopo_fisico',       '3.1 Escopo Físico',               tap.escopo_fisico)
  req(erros, 'escopo_sistemico',    '3.2 Escopo Sistêmico',            tap.escopo_sistemico)
  req(erros, 'escopo_processo',     '3.3 Escopo de Processo',          tap.escopo_processo)
  reqArr(erros, 'setores_envolvidos', '4. Setores Envolvidos',         tap.setores_envolvidos)
  reqArr(erros, 'etapas_projeto',    '5. Etapas do Projeto',           tap.etapas_projeto)
  reqArr(erros, 'entregaveis',       '6. Entregáveis',                 tap.entregaveis)
  reqArr(erros, 'pontos_atencao',    '7. Pontos de Atenção',           tap.pontos_atencao)
  req(erros, 'beneficios_tap',       '8. Benefícios Esperados',        tap.beneficios_tap)
  reqArr(erros, 'pontos_definir',    '9. Pontos a serem Definidos',    tap.pontos_definir)
  return erros
}

// ─── Viabilidade ─────────────────────────────────────────────────────────────

/**
 * Objeto de entrada para a validação do Estudo de Viabilidade.
 *
 * Esta interface é totalmente desacoplada de React e do banco de dados.
 * Pode ser construída a partir de qualquer fonte: formulário, API, planilha,
 * automação ou teste unitário.
 *
 * O componente `ViabilidadeEditor` é responsável por montar este objeto
 * a partir do estado do formulário antes de chamar `validarViabilidade()`.
 *
 * @see validarViabilidade
 */
export interface ViabilidadeParaValidar {
  // Resumo
  resumo_executivo?: string | null

  // Premissas financeiras
  capex?: number | null
  opex?: number | null
  economia_estimada?: number | null
  tipo_payback?: string | null
  tipo_payback_quantitativo?: boolean | null
  tipo_payback_qualitativo?: boolean | null
  beneficios_esperados?: string | null
  payback_informado?: number | null

  // Análise técnica
  sistemas_envolvidos?: string | null
  complexidade_tecnica?: string | null
  dependencia_fornecedores?: string | null
  infraestrutura?: string | null

  // Análise operacional
  impacto_operacional?: string | null
  mudanca_processo?: string | null
  recursos_necessarios?: string | null
  impactos?: string | null
  riscos?: string | null

  // Cronograma preliminar
  data_inicio_prev?: string | null
  data_fim_prev?: string | null
  marcos?: string | null

  // Recomendação e decisão
  recomendacao?: string | null
  justificativa_recomendacao?: string | null
  /**
   * Obrigatório quando `recomendacao === 'VIAVEL_AJUSTES'`.
   * Descreve as condições que devem ser atendidas para aprovação.
   */
  condicoes_aprovacao?: string | null
}

/**
 * Valida um Estudo de Viabilidade antes do envio para aprovação.
 *
 * Esta função contém TODAS as regras de negócio da Viabilidade.
 * Nenhuma regra de negócio deve ser implementada diretamente em componentes React.
 *
 * É totalmente desacoplada de React, do banco de dados e de qualquer
 * framework. Pode ser reutilizada em:
 * - Formulário React (ViabilidadeEditor)
 * - Rota de API (antes de alterar status)
 * - Importação de planilha
 * - Testes unitários
 * - Automações e integrações com IA
 *
 * @param v - Objeto `ViabilidadeParaValidar` montado a partir da fonte de dados atual
 * @returns Array de erros; array vazio significa validação aprovada
 *
 * @example
 * ```ts
 * // Em componente React — montar a partir do form state:
 * const obj: ViabilidadeParaValidar = {
 *   resumo_executivo: form.resumo_executivo,
 *   capex: form.capex,
 *   // ... demais campos
 * }
 * const erros = validarViabilidade(obj)
 * if (erros.length) setValidacaoErros(erros)
 * else abrirModalAprovacao()
 *
 * // Em teste unitário:
 * expect(validarViabilidade({ recomendacao: 'VIAVEL_AJUSTES', condicoes_aprovacao: '' }))
 *   .toContainEqual({ campo: 'condicoes_aprovacao', label: expect.any(String) })
 * ```
 *
 * @usedBy ViabilidadeEditor — submissão para aprovação
 * @usedBy API de status (futura) — validação server-side antes de transição
 * @usedBy Importação de planilha (futuro) — validação em lote
 */
export function validarViabilidade(v: ViabilidadeParaValidar): ErroValidacao[] {
  const erros: ErroValidacao[] = []

  // Bloco 1 — Premissas Financeiras
  // Determina modo: usa novos flags se disponíveis, senão deriva do campo legado tipo_payback
  const isQuant = v.tipo_payback_quantitativo != null
    ? v.tipo_payback_quantitativo
    : v.tipo_payback === 'QUANTITATIVO'
  const isQual = v.tipo_payback_qualitativo != null
    ? v.tipo_payback_qualitativo
    : v.tipo_payback !== 'QUANTITATIVO'

  if (isQuant) {
    reqNum(erros, 'capex',             'CAPEX',                        v.capex)
    reqNum(erros, 'opex',              'OPEX',                         v.opex)
    reqNum(erros, 'economia_estimada', 'Economia Estimada',            v.economia_estimada)
    reqNum(erros, 'payback_informado', 'Payback Informado',            v.payback_informado)
  }
  if (isQual) {
    req(erros, 'beneficios_esperados', 'Benefícios Esperados',         v.beneficios_esperados)
  }

  // Bloco 2 — Resumo
  req(erros, 'resumo_executivo',     'Resumo Executivo',             v.resumo_executivo)

  // Bloco 3 — Análise Técnica
  req(erros, 'sistemas_envolvidos',       'Sistemas Envolvidos',           v.sistemas_envolvidos)
  req(erros, 'complexidade_tecnica',      'Complexidade Técnica',          v.complexidade_tecnica)
  req(erros, 'dependencia_fornecedores',  'Dependência de Fornecedores',   v.dependencia_fornecedores)
  req(erros, 'infraestrutura',            'Infraestrutura',                v.infraestrutura)

  // Bloco 4 — Análise Operacional
  req(erros, 'impacto_operacional',  'Impacto Operacional',          v.impacto_operacional)
  req(erros, 'mudanca_processo',     'Mudança de Processo',          v.mudanca_processo)
  req(erros, 'recursos_necessarios', 'Recursos Necessários',         v.recursos_necessarios)
  req(erros, 'impactos',             'Impactos no Negócio',          v.impactos)
  req(erros, 'riscos',               'Riscos Principais',            v.riscos)

  // Bloco 5 — Cronograma Preliminar
  // data_fim_prev e marcos não são obrigatórios: a data de conclusão vem do cronograma real
  req(erros, 'data_inicio_prev', 'Data de Início Prevista',          v.data_inicio_prev)

  // Bloco 6 — Recomendação (regras condicionais centralizadas)
  req(erros, 'recomendacao',               'Recomendação',                    v.recomendacao)
  req(erros, 'justificativa_recomendacao', 'Justificativa da Recomendação',   v.justificativa_recomendacao)

  // Regra condicional: Condições para Aprovação obrigatórias quando "Viável com ajustes"
  if (v.recomendacao === 'VIAVEL_AJUSTES' && !v.condicoes_aprovacao?.trim()) {
    erros.push({
      campo: 'condicoes_aprovacao',
      label: 'Condições para Aprovação são obrigatórias quando a recomendação é "Viável com ajustes"',
    })
  }

  return erros
}

// ─── Cronograma ──────────────────────────────────────────────────────────────

export interface TarefaParaValidar {
  nome?: string
  data_inicio?: string
  data_fim?: string
}

export function validarCronograma(tarefas: TarefaParaValidar[]): ErroValidacao[] {
  const erros: ErroValidacao[] = []

  if (!tarefas.length) {
    erros.push({ campo: 'tarefas', label: 'O cronograma deve ter pelo menos uma tarefa' })
    return erros
  }

  const semInicio = tarefas.filter(t => t.nome?.trim() && !t.data_inicio?.trim())
  const semFim    = tarefas.filter(t => t.nome?.trim() && !t.data_fim?.trim())

  if (semInicio.length) {
    erros.push({
      campo: 'data_inicio',
      label: `${semInicio.length} tarefa(s) sem data de início`,
    })
  }
  if (semFim.length) {
    erros.push({
      campo: 'data_fim',
      label: `${semFim.length} tarefa(s) sem data de fim`,
    })
  }

  return erros
}
