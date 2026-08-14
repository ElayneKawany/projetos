import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { ViabilidadeRepository } from '@/lib/repositories'
import { registrarAuditoria } from '@/lib/db/auditoria'
import { registrarHistoricoAlteracao } from '@/lib/projetos'
import { verificarBloqueioEdicao } from '@/lib/artefatos'

const CAMPOS_FINANCEIROS = [
  'capex', 'opex', 'opex_periodicidade',
  'economia_estimada', 'economia_periodicidade',
  'tipo_payback', 'payback_informado', 'payback_unidade',
  'baseline_valor', 'meta_valor', 'tipo_indicador', 'economia_mensal_esperada',
  'ganho_tarefa_ativo', 'ganho_tarefa_salario', 'ganho_tarefa_horas_antes',
  'ganho_tarefa_horas_depois', 'ganho_tarefa_freq_mensal',
  'hc_ativo', 'hc_quantidade', 'hc_salario_mensal', 'hc_encargos_pct',
  'hc_beneficios_mensais', 'hc_outros_mensais',
]

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; vid: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { id, vid } = await params

  const viabilidade = ViabilidadeRepository.findByIdAndProjetoId(Number(vid), Number(id))
  if (!viabilidade) return NextResponse.json({ error: 'Viabilidade não encontrada.' }, { status: 404 })

  const isV1Aprovada = viabilidade.status === 'APROVADO' && viabilidade.versao === 1
  if (verificarBloqueioEdicao(viabilidade.status) && !isV1Aprovada) {
    return NextResponse.json({ error: 'Este documento não pode ser editado no status atual.' }, { status: 403 })
  }

  const body = await request.json()

  const fields = [
    'resumo_executivo', 'investimento_total', 'roi', 'tir', 'payback_meses',
    'sistemas_envolvidos', 'complexidade_tecnica', 'dependencia_fornecedores', 'infraestrutura', 'impacto_operacional',
    'mudanca_processo', 'recursos_necessarios', 'impactos', 'riscos',
    'data_inicio_prev', 'data_fim_prev', 'marcos', 'recomendacao',
    'justificativa_recomendacao', 'condicoes_aprovacao', 'status',
    'capex', 'opex', 'opex_periodicidade',
    'economia_estimada', 'economia_periodicidade',
    'tipo_payback', 'payback_informado', 'payback_unidade',
    'tipo_payback_quantitativo', 'tipo_payback_qualitativo', 'beneficios_esperados',
    'baseline_valor', 'meta_valor', 'tipo_indicador', 'economia_mensal_esperada',
    'ganho_tarefa_ativo', 'ganho_tarefa_salario', 'ganho_tarefa_horas_antes',
    'ganho_tarefa_horas_depois', 'ganho_tarefa_freq_mensal',
    'hc_ativo', 'hc_quantidade', 'hc_salario_mensal', 'hc_encargos_pct',
    'hc_beneficios_mensais', 'hc_outros_mensais',
    'horas_analistas_ativo', 'horas_analistas_json', 'horas_analistas_total',
  ]

  const dados: Record<string, unknown> = {}
  for (const f of fields) {
    if (body[f] !== undefined) dados[f] = body[f]
  }
  if (!Object.keys(dados).length) return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 })

  ViabilidadeRepository.update(Number(vid), dados)

  for (const campo of Object.keys(dados)) {
    if (CAMPOS_FINANCEIROS.includes(campo)) {
      const anterior = (viabilidade as unknown as Record<string, unknown>)[campo]
      const novo = dados[campo]
      if (String(anterior ?? '') !== String(novo ?? '')) {
        registrarHistoricoAlteracao({
          projeto_id: Number(id),
          usuario_id: session.id,
          usuario_nome: session.nome,
          campo: `viabilidade_${campo}`,
          valor_anterior: anterior !== null && anterior !== undefined ? String(anterior) : undefined,
          valor_novo: novo !== null && novo !== undefined ? String(novo) : undefined,
          acao: 'UPDATE',
        })
      }
    }
  }

  registrarAuditoria({
    usuario_id: session.id,
    usuario_nome: session.nome,
    acao: 'UPDATE',
    entidade: 'viabilidade',
    entidade_id: Number(vid),
    projeto_id: Number(id),
    descricao: 'Estudo de Viabilidade atualizado',
    dados_depois: body,
  })

  return NextResponse.json({ ok: true })
}
