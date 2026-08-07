import { registrarAuditoria } from './db/auditoria'
import { registrarEvento, type EventoTimeline } from './timeline'
import { getProjetoVisibility } from './permissoes'
import { ProjetosRepository, ConfiguracoesRepository, UsuariosRepository, ViabilidadeRepository } from '@/lib/repositories'
import type { Projeto, StatusProjeto, Prioridade } from '@/types'

export function gerarCodigoProjeto(): string {
  return ProjetosRepository.nextCodigo()
}

export function buscarProjetos(filtros: {
  status?: string
  diretoria_id?: number
  prioridade?: string
  busca?: string
  usuario_id?: number
  perfil?: string
  limit?: number
  offset?: number
}): Projeto[] {
  const conditions: string[] = ['p.ativo = 1']
  const params: Record<string, unknown> = {}

  if (filtros.status) {
    conditions.push('p.status = @status')
    params.status = filtros.status
  }
  if (filtros.diretoria_id) {
    conditions.push('p.diretoria_id = @diretoria_id')
    params.diretoria_id = filtros.diretoria_id
  }
  if (filtros.prioridade) {
    conditions.push('p.prioridade = @prioridade')
    params.prioridade = filtros.prioridade
  }
  if (filtros.busca) {
    conditions.push('(p.nome LIKE @busca OR p.codigo LIKE @busca OR p.objetivo LIKE @busca)')
    params.busca = `%${filtros.busca}%`
  }

  if (filtros.perfil && filtros.usuario_id) {
    const vis = getProjetoVisibility({ id: filtros.usuario_id, perfil: filtros.perfil })
    if (vis.where !== '1=1') {
      conditions.push(`(${vis.where})`)
      Object.assign(params, vis.params)
    }
  }

  const limit = filtros.limit ?? 100
  const offset = filtros.offset ?? 0

  return ProjetosRepository.findAllComplexo(conditions, params, limit, offset)
}

export function buscarProjetoPorId(id: number): Projeto | null {
  return ProjetosRepository.findByIdComplexo(id)
}

export function registrarHistoricoAlteracao(params: {
  projeto_id: number
  usuario_id: number
  usuario_nome?: string | null
  campo: string
  valor_anterior?: string | null
  valor_novo?: string | null
  acao?: string
}): void {
  ProjetosRepository.insertHistoricoAlteracao(params)
}

export function buscarHistoricoAlteracoes(projeto_id: number) {
  return ProjetosRepository.findHistoricoAlteracoes(projeto_id)
}

export function buscarConfigStatus() {
  return ConfiguracoesRepository.findConfigStatusAll()
}

export function criarProjeto(dados: {
  nome: string
  solicitante_id: number
  diretoria_id: number
  area_id: number
  ponto_focal?: string
  contato?: string
  objetivo: string
  justificativa?: string
  descricao?: string
  beneficios?: string
  gerente_id?: number
  classificacao?: string
  prioridade?: string
  created_by: number
}): Projeto {
  const codigo = gerarCodigoProjeto()
  const statusInicial = ConfiguracoesRepository.findStatusInicial()
  const prioridade = dados.prioridade ?? 'MEDIA'
  const classificacao = dados.classificacao ?? null

  const projetoId = ProjetosRepository.insertProjeto({
    codigo,
    nome: dados.nome,
    solicitante_id: dados.solicitante_id,
    diretoria_id: dados.diretoria_id,
    area_id: dados.area_id,
    ponto_focal: dados.ponto_focal ?? null,
    contato: dados.contato ?? null,
    objetivo: dados.objetivo,
    justificativa: dados.justificativa ?? null,
    descricao: dados.descricao ?? null,
    beneficios: dados.beneficios ?? null,
    status: statusInicial,
    classificacao,
    prioridade,
    gerente_id: dados.gerente_id ?? null,
    created_by: dados.created_by,
  })

  const projeto = buscarProjetoPorId(Number(projetoId))!

  registrarAuditoria({
    usuario_id: dados.created_by,
    acao: 'CREATE',
    entidade: 'projetos',
    entidade_id: projeto.id,
    projeto_id: projeto.id,
    descricao: `Projeto ${codigo} criado: "${dados.nome}"`,
    dados_depois: projeto,
  })

  registrarHistoricoAlteracao({
    projeto_id: projeto.id,
    usuario_id: dados.created_by,
    campo: 'status',
    valor_anterior: null,
    valor_novo: statusInicial,
    acao: 'CREATE',
  })

  ProjetosRepository.insertTapV1({
    projeto_id: projeto.id,
    criado_por: dados.created_by,
    objetivo_detalhado: dados.objetivo,
    nome_projeto: dados.nome,
  })

  return projeto
}

export function atualizarStatusProjeto(
  projeto_id: number,
  status_para: StatusProjeto,
  usuario_id: number,
  motivo?: string
): void {
  const projeto = buscarProjetoPorId(projeto_id)
  if (!projeto) throw new Error('Projeto não encontrado.')

  ProjetosRepository.updateStatus(projeto_id, status_para)
  ProjetosRepository.insertStatusHistorico(projeto_id, projeto.status, status_para, motivo ?? null, usuario_id)

  const usuario_nome = ProjetosRepository.findNomeUsuario(usuario_id) ?? 'Sistema'

  registrarAuditoria({
    usuario_id,
    usuario_nome,
    acao: 'STATUS_CHANGE',
    entidade: 'projetos',
    entidade_id: projeto_id,
    projeto_id,
    descricao: `Status alterado de "${projeto.status}" para "${status_para}"`,
    dados_antes: { status: projeto.status },
    dados_depois: { status: status_para, motivo },
  })

  const statusEventoMap: Partial<Record<StatusProjeto, { evento: EventoTimeline; titulo: string }>> = {
    PAUSADO:           { evento: 'SUSPENSO',  titulo: 'Projeto pausado' },
    EXECUCAO:          { evento: 'ALTERADO',  titulo: 'Projeto em execução' },
    PROJETO_CONCLUIDO: { evento: 'CONCLUIDO', titulo: 'Projeto concluído' },
    CANCELADO:         { evento: 'CANCELADO', titulo: 'Projeto cancelado' },
    PROJETO_ENCERRADO: { evento: 'ENCERRADO', titulo: 'Projeto encerrado' },
  }
  if (projeto.status === 'PAUSADO' && status_para !== 'PAUSADO') {
    registrarEvento({
      projeto_id,
      modulo: 'PROJETO',
      artefato: 'PROJETO',
      evento: 'ALTERADO',
      titulo: 'Projeto retomado',
      descricao: motivo ? `Retomado: ${motivo}` : 'Projeto retomado após pausa',
      usuario_id,
      usuario_nome,
      referencia_id: projeto_id,
      referencia_tipo: 'projetos',
    })
  } else {
    const ev = statusEventoMap[status_para]
    if (ev) {
      registrarEvento({
        projeto_id,
        modulo: 'PROJETO',
        artefato: 'PROJETO',
        evento: ev.evento,
        titulo: ev.titulo,
        descricao: motivo ? `${ev.titulo}: ${motivo}` : ev.titulo,
        usuario_id,
        usuario_nome,
        referencia_id: projeto_id,
        referencia_tipo: 'projetos',
      })
    }
  }

  if (status_para === 'VIABILIDADE') {
    const existingVib = ViabilidadeRepository.findV1ByProjetoId(projeto_id)

    if (!existingVib) {
      const vibId = ProjetosRepository.insertViabilidadeRascunho(projeto_id, usuario_id)

      ProjetosRepository.insertAprovacao({
        projeto_id,
        tipo: 'VIABILIDADE',
        referencia_id: vibId,
        referencia_tipo: 'viabilidade',
        status: 'PENDENTE',
        solicitante_id: usuario_id,
        observacao_req: 'Estudo de Viabilidade gerado automaticamente ao avançar para fase VIABILIDADE',
      })

      ProjetosRepository.insertDocumento({
        projeto_id,
        tipo: 'ESTUDO',
        titulo: `Estudo de Viabilidade – ${projeto.nome}`,
        versao: 1,
        status: 'EM_APROVACAO',
        gerado_auto: 1,
        criado_por: usuario_id,
      })
    }
  }
}

export function atualizarPrioridadeProjeto(
  projeto_id: number,
  prioridade_para: Prioridade,
  usuario_id: number,
  motivo?: string
): void {
  const projeto = buscarProjetoPorId(projeto_id)
  if (!projeto) throw new Error('Projeto não encontrado.')

  ProjetosRepository.updatePrioridade(projeto_id, prioridade_para)
  ProjetosRepository.insertPrioridadeHistorico({
    projeto_id,
    prioridade_de: projeto.prioridade,
    prioridade_para,
    motivo: motivo ?? null,
    usuario_id,
  })

  registrarAuditoria({
    usuario_id,
    acao: 'PRIORITY_CHANGE',
    entidade: 'projetos',
    entidade_id: projeto_id,
    projeto_id,
    descricao: `Prioridade alterada de "${projeto.prioridade}" para "${prioridade_para}"`,
    dados_antes: { prioridade: projeto.prioridade },
    dados_depois: { prioridade: prioridade_para, motivo },
  })
}

export function buscarHistoricoStatus(projeto_id: number) {
  return ProjetosRepository.findStatusHistoricoComplexo(projeto_id)
}

export function buscarHistoricoPrioridade(projeto_id: number) {
  return ProjetosRepository.findHistoricoPrioridade(projeto_id)
}

export function buscarDashboardPMO() {
  const hoje = new Date().toISOString().split('T')[0]
  return ProjetosRepository.fetchDashboard(hoje)
}

export interface ConcluirProjetoInput {
  data_conclusao_real: string
  hora_conclusao: string
  responsavel_conclusao: string
  motivo_conclusao: string
  checklist_conclusao: string
}

export function concluirProjeto(
  projeto_id: number,
  dados: ConcluirProjetoInput,
  usuario_id: number,
  usuario_nome: string,
): void {
  const projeto = buscarProjetoPorId(projeto_id)
  if (!projeto) throw new Error('Projeto não encontrado.')
  if (projeto.status !== 'EXECUCAO') throw new Error('Projeto deve estar em Execução para ser concluído.')

  const cronograma = ProjetosRepository.findCronogramaLatest(projeto_id)

  const CRONOGRAMA_STATUS_VALIDOS = ['APROVADO', 'EM_EXECUCAO', 'PRONTO_PARA_ENCERRAMENTO']
  if (!cronograma || !CRONOGRAMA_STATUS_VALIDOS.includes(cronograma.status)) {
    throw new Error('O Cronograma precisa estar Aprovado ou em Execução para concluir o projeto.')
  }

  ProjetosRepository.updateParaConcluido(projeto_id, dados)

  ProjetosRepository.insertStatusHistorico(
    projeto_id, projeto.status, 'PROJETO_CONCLUIDO', dados.motivo_conclusao, usuario_id
  )

  registrarEvento({
    projeto_id,
    modulo: 'PROJETO',
    artefato: 'PROJETO',
    evento: 'CONCLUIDO',
    titulo: 'Projeto Concluído',
    descricao: `Conclusão registrada por ${dados.responsavel_conclusao}. Data real: ${dados.data_conclusao_real}. ${dados.motivo_conclusao}`,
    usuario_id,
    usuario_nome,
    referencia_id: projeto_id,
    referencia_tipo: 'projetos',
  })

  const totalTarefas = ProjetosRepository.countTarefasNivel(cronograma.id, 'TAREFA')
  const concluidasTarefas = ProjetosRepository.countTarefasConcluidasNivel(cronograma.id, 'TAREFA')
  const pendenteTarefas = totalTarefas - concluidasTarefas

  registrarAuditoria({
    usuario_id,
    usuario_nome,
    acao: 'STATUS_CHANGE',
    entidade: 'projetos',
    entidade_id: projeto_id,
    projeto_id,
    descricao: pendenteTarefas > 0
      ? `Projeto concluído com ${pendenteTarefas} tarefa(s) pendente(s) — encerramento antecipado`
      : 'Projeto concluído oficialmente',
    dados_antes: { status: projeto.status },
    dados_depois: {
      status: 'PROJETO_CONCLUIDO',
      data_conclusao_real: dados.data_conclusao_real,
      hora_conclusao: dados.hora_conclusao,
      responsavel_conclusao: dados.responsavel_conclusao,
      motivo_conclusao: dados.motivo_conclusao,
      tarefas_total: totalTarefas,
      tarefas_concluidas: concluidasTarefas,
      tarefas_pendentes: pendenteTarefas,
    },
  })

  const tap = ProjetosRepository.findTapAprovado(projeto_id)
  const viab = ViabilidadeRepository.findLatestByProjectId(projeto_id)

  const capexExec = ProjetosRepository.calcCapexExecutado(projeto_id)
  const opexExec = ProjetosRepository.calcOpexExecutado(projeto_id)

  const cronAprov = ProjetosRepository.findCronogramaAprovado(projeto_id)
  let dataFimPrevCron: string | null = null
  if (cronAprov) {
    dataFimPrevCron = ProjetosRepository.findDataFimCronograma(cronAprov.id)
  }

  let diasDesvio: number | null = null
  if (dataFimPrevCron && dados.data_conclusao_real) {
    diasDesvio = Math.round(
      (new Date(dados.data_conclusao_real).getTime() - new Date(dataFimPrevCron).getTime()) / 86400000
    )
  }

  ProjetosRepository.insertSnapshotFinal({
    projeto_id,
    roi_previsto: tap?.roi_previsto ?? null,
    capex_previsto: viab?.capex ?? null,
    capex_executado: capexExec,
    opex_previsto: viab?.opex ?? null,
    opex_executado: opexExec,
    economia_prevista: viab?.economia_estimada ?? null,
    data_fim_prev: dataFimPrevCron,
    data_conclusao_real: dados.data_conclusao_real,
    dias_desvio: diasDesvio,
    responsavel: dados.responsavel_conclusao,
  })

  registrarEvento({
    projeto_id,
    modulo: 'PROJETO',
    artefato: 'PROJETO',
    evento: 'CRIADO',
    titulo: 'Snapshot Final criado',
    descricao: `Instantâneo imutável gerado na conclusão do projeto por ${dados.responsavel_conclusao}`,
    usuario_id,
    usuario_nome,
    referencia_id: projeto_id,
    referencia_tipo: 'projeto_snapshot_final',
  })

  const cronAtivo = ProjetosRepository.findCronogramaAtivo(projeto_id)
  if (cronAtivo) {
    ProjetosRepository.updateCronogramaStatus(cronAtivo.id, 'ENCERRADO')

    registrarEvento({
      projeto_id,
      modulo:          'CRONOGRAMA',
      artefato:        'CRONOGRAMA',
      evento:          'ENCERRADO',
      titulo:          `Cronograma V${cronAtivo.versao} encerrado`,
      descricao:       `Cronograma encerrado junto com a conclusão do projeto por ${dados.responsavel_conclusao}.`,
      usuario_id,
      usuario_nome,
      referencia_id:   cronAtivo.id,
      referencia_tipo: 'cronograma',
    })

    registrarAuditoria({
      usuario_id,
      usuario_nome,
      acao:         'UPDATE',
      entidade:     'cronogramas',
      entidade_id:  cronAtivo.id,
      projeto_id,
      descricao:    `Cronograma V${cronAtivo.versao} encerrado junto com o projeto`,
      dados_antes:  { status: cronograma.status },
      dados_depois: { status: 'ENCERRADO' },
    })
  }
}

export function iniciarPayback(
  projeto_id: number,
  usuario_id: number,
  usuario_nome: string,
): void {
  const projeto = buscarProjetoPorId(projeto_id)
  if (!projeto) throw new Error('Projeto não encontrado.')
  if (projeto.status !== 'PROJETO_CONCLUIDO') {
    throw new Error('O projeto deve estar em "Projeto Concluído" para iniciar o Payback.')
  }

  ProjetosRepository.updateStatus(projeto_id, 'PAYBACK_ACOMPANHAMENTO')
  ProjetosRepository.insertStatusHistorico(
    projeto_id, 'PROJETO_CONCLUIDO', 'PAYBACK_ACOMPANHAMENTO',
    'Acompanhamento de Payback iniciado manualmente', usuario_id
  )

  registrarEvento({
    projeto_id,
    modulo: 'PROJETO',
    artefato: 'PROJETO',
    evento: 'CONCLUIDO',
    titulo: 'Payback iniciado',
    descricao: `Acompanhamento de Payback iniciado por ${usuario_nome}`,
    usuario_id,
    usuario_nome,
    referencia_id: projeto_id,
    referencia_tipo: 'projetos',
  })

  registrarAuditoria({
    usuario_id,
    usuario_nome,
    acao: 'STATUS_CHANGE',
    entidade: 'projetos',
    entidade_id: projeto_id,
    projeto_id,
    descricao: 'Payback em acompanhamento iniciado',
    dados_antes: { status: 'PROJETO_CONCLUIDO' },
    dados_depois: { status: 'PAYBACK_ACOMPANHAMENTO' },
  })
}

export function encerrarProjeto(
  projeto_id: number,
  motivo: string,
  usuario_id: number,
  usuario_nome: string,
): void {
  const projeto = buscarProjetoPorId(projeto_id)
  if (!projeto) throw new Error('Projeto não encontrado.')
  if (projeto.status !== 'PAYBACK_ENCERRADO') {
    throw new Error('O projeto deve estar em "Payback Encerrado" para ser encerrado oficialmente.')
  }

  ProjetosRepository.updateStatus(projeto_id, 'PROJETO_ENCERRADO')
  ProjetosRepository.insertStatusHistorico(
    projeto_id, 'PAYBACK_ENCERRADO', 'PROJETO_ENCERRADO', motivo, usuario_id
  )

  registrarEvento({
    projeto_id,
    modulo: 'PROJETO',
    artefato: 'PROJETO',
    evento: 'ENCERRADO',
    titulo: 'Projeto Encerrado',
    descricao: `Projeto encerrado oficialmente por ${usuario_nome}. ${motivo}`,
    usuario_id,
    usuario_nome,
    referencia_id: projeto_id,
    referencia_tipo: 'projetos',
  })

  registrarAuditoria({
    usuario_id,
    usuario_nome,
    acao: 'STATUS_CHANGE',
    entidade: 'projetos',
    entidade_id: projeto_id,
    projeto_id,
    descricao: 'Projeto encerrado oficialmente',
    dados_antes: { status: 'PAYBACK_ENCERRADO' },
    dados_depois: { status: 'PROJETO_ENCERRADO', motivo },
  })
}
