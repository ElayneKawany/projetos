// Fonte: DEV2026.xlsx — exportado em 24/04/2026
// Dados estáticos para a visão BETA de TI.
// Não alterar manualmente — reflite a planilha original sem modificações.

export interface Dev2026Atividade {
  id: number
  nome: string
  progresso: 'Concluído' | 'Em andamento' | 'Não iniciado'
  requisito: string
  responsavel: string   // responsável conforme planilha (pode ser vazio)
  status: string        // campo "Status" da planilha (texto livre)
  concluido_em: string  // 'YYYY-MM-DD' ou ''
  inicio_dev: string    // 'YYYY-MM-DD' ou ''
  fim_dev: string       // 'YYYY-MM-DD' ou ''
  prioridade: number | ''
  projeto_codigo?: string // preenchido quando há correspondência clara com projeto existente
  projeto_nome?: string
}

export const DEV2026_ATIVIDADES: Dev2026Atividade[] = [
  {
    id: 1, nome: 'Automação Desconto da Inadimplência',
    progresso: 'Concluído', requisito: 'NÃO', responsavel: '',
    status: 'Testes ok - Este mês vamos deixar rodar sozinho',
    concluido_em: '2026-05-01', inicio_dev: '2026-02-16', fim_dev: '2026-04-01', prioridade: '',
  },
  {
    id: 2, nome: 'Logística - Anomalias Ravex',
    progresso: 'Concluído', requisito: 'SIM', responsavel: '',
    status: 'Finalização dos testes',
    concluido_em: '2026-04-01', inicio_dev: '2026-04-09', fim_dev: '2026-04-27', prioridade: '',
  },
  {
    id: 3, nome: 'Painel Sorter',
    progresso: 'Concluído', requisito: 'NÃO', responsavel: '',
    status: 'Concluido',
    concluido_em: '2026-04-01', inicio_dev: '2026-04-01', fim_dev: '2026-04-23', prioridade: '',
  },
  {
    id: 20, nome: 'Painel Sorter Fase 2 - Melhorias',
    progresso: 'Concluído', requisito: 'NÃO', responsavel: 'Leandro',
    status: '',
    concluido_em: '', inicio_dev: '2026-02-09', fim_dev: '2026-02-13', prioridade: 3,
  },
  {
    id: 5, nome: 'ADM - Painel Importação de Metas',
    progresso: 'Concluído', requisito: 'NÃO', responsavel: '',
    status: 'Entregue / Validação',
    concluido_em: '2026-03-01', inicio_dev: '2026-03-01', fim_dev: '2026-03-30', prioridade: '',
  },
  {
    id: 4, nome: 'Logística - APP Reentrega',
    progresso: 'Em andamento', requisito: 'SIM', responsavel: '',
    status: '',
    concluido_em: '', inicio_dev: '2026-06-15', fim_dev: '', prioridade: 0,
  },
  {
    id: 9, nome: 'Aplicativo - Inventário Cíclico',
    progresso: 'Em andamento', requisito: 'SIM', responsavel: '',
    status: 'Entregue / Validação',
    concluido_em: '', inicio_dev: '2026-04-27', fim_dev: '2026-06-23', prioridade: 0,
    projeto_codigo: 'PRJ-2026-0028', projeto_nome: 'Aplicativo - Inventário Cíclico',
  },
  {
    id: 8, nome: 'Logística - Integração Ravex – Coletas',
    progresso: 'Concluído', requisito: 'NÃO', responsavel: '',
    status: 'Concluido',
    concluido_em: '2026-03-01', inicio_dev: '2026-03-01', fim_dev: '2026-03-20', prioridade: '',
  },
  {
    id: 10, nome: 'Logística - GS1 128 - Expedição',
    progresso: 'Em andamento', requisito: 'SIM', responsavel: '',
    status: 'Entregue / Validação',
    concluido_em: '', inicio_dev: '2026-03-09', fim_dev: '2026-06-08', prioridade: '',
    projeto_codigo: 'PRJ-2026-0011', projeto_nome: 'Produtos Pesados de Fornecedores - GS1-128',
  },
  {
    id: 12, nome: 'ADM - Painel Mega Flash - Fase 1',
    progresso: 'Em andamento', requisito: 'SIM', responsavel: '',
    status: 'Inicio dos testes - Alinhar data da virada com Controladoria',
    concluido_em: '', inicio_dev: '2026-04-16', fim_dev: '', prioridade: '',
    projeto_codigo: 'PRJ-2026-0031', projeto_nome: 'ADM - Painel Mega Flash - Fase 1',
  },
  {
    id: 15, nome: 'Baixa automática de cartão e cargas na consinco',
    progresso: 'Em andamento', requisito: 'SIM', responsavel: 'Marcio',
    status: 'Finalizamos a fase 1 - Aguardando desenvolvimento da Rede - Minha opinião é que neste momento é impeditivo',
    concluido_em: '', inicio_dev: '2026-05-25', fim_dev: '2026-06-22', prioridade: 0,
    projeto_codigo: 'PRJ-2026-0032', projeto_nome: 'Baixa automática de cartão e cargas na consinco',
  },
  {
    id: 18, nome: 'Matriz Retira em 24h',
    progresso: 'Em andamento', requisito: 'SIM', responsavel: '',
    status: 'Envolve Target e MegaG - Fase do Target finalizada',
    concluido_em: '', inicio_dev: '2026-05-04', fim_dev: '', prioridade: 1,
    projeto_codigo: 'PRJ-2026-0014', projeto_nome: 'Matriz Retira em 24h',
  },
  {
    id: 6, nome: 'Comercial - Marketplace HUBs para Mercado Livre',
    progresso: 'Em andamento', requisito: 'NÃO', responsavel: 'Mello',
    status: '',
    concluido_em: '', inicio_dev: '', fim_dev: '', prioridade: 1,
  },
  {
    id: 7, nome: 'Produtos Pesados de Fornecedores - GS1-128',
    progresso: 'Não iniciado', requisito: 'SIM', responsavel: '',
    status: '',
    concluido_em: '', inicio_dev: '', fim_dev: '', prioridade: 2,
    projeto_codigo: 'PRJ-2026-0011', projeto_nome: 'Produtos Pesados de Fornecedores - GS1-128',
  },
  {
    id: 11, nome: 'Comercial - Integração VMarket',
    progresso: 'Não iniciado', requisito: 'NÃO', responsavel: 'Mello',
    status: '',
    concluido_em: '', inicio_dev: '', fim_dev: '', prioridade: 3,
  },
  {
    id: 13, nome: 'TMS Ravex Fase 2',
    progresso: 'Não iniciado', requisito: 'SIM', responsavel: '',
    status: '',
    concluido_em: '', inicio_dev: '2026-05-04', fim_dev: '2026-05-15', prioridade: 0,
    projeto_codigo: 'PRJ-2026-0020', projeto_nome: 'TMS Ravex Fase 2',
  },
  {
    id: 14, nome: 'Antecipação de Comissão - RCA & MGPay',
    progresso: 'Não iniciado', requisito: 'NÃO', responsavel: 'Kleber',
    status: 'Envolve Target e MegaG',
    concluido_em: '', inicio_dev: '', fim_dev: '', prioridade: 3,
    projeto_codigo: 'PRJ-2026-0022', projeto_nome: 'Antecipação de Comissão - RCA & MGPay',
  },
  {
    id: 16, nome: 'Logística - Automação do Frete - Fase 2 Frete',
    progresso: 'Não iniciado', requisito: 'NÃO', responsavel: 'Leandro',
    status: '',
    concluido_em: '', inicio_dev: '', fim_dev: '', prioridade: 3,
  },
  {
    id: 19, nome: 'Cadastro de Campanha de Fornecedor',
    progresso: 'Concluído', requisito: 'NÃO', responsavel: '',
    status: 'Entregue / Validação',
    concluido_em: '2026-03-01', inicio_dev: '2026-04-05', fim_dev: '2026-04-24', prioridade: '',
  },
  {
    id: 17, nome: 'ADM - Almoxarifado Solicitação de Material',
    progresso: 'Não iniciado', requisito: 'SIM', responsavel: '',
    status: '',
    concluido_em: '', inicio_dev: '', fim_dev: '', prioridade: 4,
  },
  {
    id: 21, nome: 'Refazer o APP de Transbordo',
    progresso: 'Não iniciado', requisito: 'NÃO', responsavel: 'Leandro',
    status: '',
    concluido_em: '', inicio_dev: '', fim_dev: '', prioridade: 2,
  },
  {
    id: 22, nome: 'Data Lake',
    progresso: 'Concluído', requisito: 'NÃO', responsavel: 'Michel',
    status: '',
    concluido_em: '2026-05-01', inicio_dev: '2026-05-25', fim_dev: '2026-05-30', prioridade: '',
  },
  {
    id: 23, nome: 'Financeiro - Import Pix',
    progresso: 'Concluído', requisito: 'NÃO', responsavel: 'Márcio',
    status: '',
    concluido_em: '2026-06-01', inicio_dev: '2026-06-22', fim_dev: '2026-06-24', prioridade: '',
  },
  {
    id: 24, nome: 'Boleto Hibrido - Pontos no Clube (Integração)',
    progresso: 'Concluído', requisito: 'NÃO', responsavel: 'MKT',
    status: '',
    concluido_em: '2026-05-01', inicio_dev: '2026-05-25', fim_dev: '2026-05-30', prioridade: '',
  },
  {
    id: 25, nome: 'Automação Pagamento de Descarga',
    progresso: 'Não iniciado', requisito: 'SIM', responsavel: 'Márcio',
    status: '',
    concluido_em: '', inicio_dev: '', fim_dev: '', prioridade: '',
  },
  {
    id: 26, nome: 'Meqso',
    progresso: 'Em andamento', requisito: 'NÃO', responsavel: 'Mello',
    status: '',
    concluido_em: '', inicio_dev: '', fim_dev: '', prioridade: 1,
  },
]
