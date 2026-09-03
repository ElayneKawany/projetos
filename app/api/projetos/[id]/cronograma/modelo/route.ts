import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import * as XLSX from 'xlsx'
import { CronogramaRepository } from '@/lib/repositories'

// Colunas do modelo oficial — ordem fixa
const CABECALHO = [
  'WBS', 'Nível', 'Nome', 'Descrição', 'Tipo', 'Criticidade',
  'Responsável', 'Executor', 'Data Início', 'Data Fim',
  'Percentual', 'Status', 'Observações',
]

// Exemplos de dados para preencher 2 linhas demonstrativas
const EXEMPLOS = [
  [
    '1', 'FASE', 'Fase 1 - Planejamento', 'Atividades de planejamento do projeto', '', 'Normal',
    '', '', '01/08/2025', '30/08/2025', '0', 'PENDENTE', '',
  ],
  [
    '1.1', 'TAREFA', 'Definir escopo do projeto', '', 'Tarefa', 'Normal',
    '', '', '01/08/2025', '15/08/2025', '0', 'PENDENTE', '',
  ],
  [
    '1.2', 'TAREFA', 'Levantar requisitos', '', 'Reunião', 'Alta',
    '', '', '16/08/2025', '30/08/2025', '0', 'PENDENTE', '',
  ],
  [
    '2', 'FASE', 'Fase 2 - Execução', '', '', 'Normal',
    '', '', '01/09/2025', '31/10/2025', '0', 'PENDENTE', '',
  ],
  [
    '2.1', 'TAREFA', 'Desenvolver solução', '', 'Tarefa', 'Crítica',
    '', '', '01/09/2025', '31/10/2025', '0', 'PENDENTE', '',
  ],
]

const INSTRUCOES = [
  ['INSTRUÇÕES DE PREENCHIMENTO — MODELO OFICIAL MEGA G'],
  [],
  ['COLUNA', 'OBRIGATÓRIO', 'VALORES ACEITOS / OBSERVAÇÕES'],
  ['WBS', 'Não', 'Código hierárquico (1, 1.1, 1.2, 2…). Se vazio, o sistema gera automaticamente.'],
  ['Nível', 'Sim', 'FASE (macroatividade) ou TAREFA (atividade)'],
  ['Nome', 'Sim', 'Nome da fase ou tarefa'],
  ['Descrição', 'Não', 'Texto livre'],
  ['Tipo', 'Não', 'Tarefa | Marco | Entrega | Reunião | Homologação | Implantação | Treinamento | Go Live | Outro'],
  ['Criticidade', 'Não', 'Baixa | Normal | Alta | Crítica  (padrão: Normal)'],
  ['Responsável', 'Sim', 'Nome exato do usuário cadastrado no sistema'],
  ['Executor', 'Não', 'Nome exato do usuário. Se vazio, usa o Responsável'],
  ['Data Início', 'Sim', 'Formato dd/mm/aaaa'],
  ['Data Fim', 'Sim', 'Formato dd/mm/aaaa'],
  ['Percentual', 'Não', 'Número de 0 a 100 (sem %)'],
  ['Status', 'Não', 'PENDENTE | EM_ANDAMENTO | CONCLUIDA  (padrão: PENDENTE)'],
  ['Observações', 'Não', 'Texto livre'],
  [],
  ['REGRAS GERAIS'],
  ['• Não renomeie nem exclua colunas.'],
  ['• Não altere o nome da aba "CRONOGRAMA".'],
  ['• As linhas de exemplo podem ser apagadas.'],
  ['• Linhas inválidas são ignoradas e reportadas — as demais são importadas normalmente.'],
  ['• Responsável deve existir exatamente como cadastrado no sistema.'],
  ['• Executor é opcional. Se não informado, o sistema usa o Responsável.'],
  ['• WBS é opcional. Se não informado, o sistema calcula automaticamente.'],
]

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id } = await params

  const usuarios = await CronogramaRepository.findNomesUsuariosAtivos()

  const wb = XLSX.utils.book_new()

  // ── Aba CRONOGRAMA ──────────────────────────────────────────────────────────
  const aoa: unknown[][] = [CABECALHO, ...EXEMPLOS]
  const ws = XLSX.utils.aoa_to_sheet(aoa)

  // Larguras de coluna (caracteres)
  ws['!cols'] = [
    { wch: 8  },  // WBS
    { wch: 8  },  // Nível
    { wch: 40 },  // Nome
    { wch: 30 },  // Descrição
    { wch: 14 },  // Tipo
    { wch: 12 },  // Criticidade
    { wch: 28 },  // Responsável
    { wch: 28 },  // Executor
    { wch: 13 },  // Data Início
    { wch: 13 },  // Data Fim
    { wch: 10 },  // Percentual
    { wch: 14 },  // Status
    { wch: 25 },  // Observações
  ]

  // Data validations (dropdowns)
  const MAX_ROW = 10001  // linhas cobertas pela validação

  ws['!dataValidations'] = [
    // Nível — col B (índice 1)
    {
      type: 'list',
      sqref: `B2:B${MAX_ROW}`,
      formula1: '"FASE,TAREFA"',
      showDropDown: false,
      showErrorMessage: true,
      errorTitle: 'Valor inválido',
      error: 'Use FASE ou TAREFA.',
    },
    // Tipo — col E (índice 4)
    {
      type: 'list',
      sqref: `E2:E${MAX_ROW}`,
      formula1: '"Tarefa,Marco,Entrega,Reunião,Homologação,Implantação,Treinamento,Go Live,Outro"',
      showDropDown: false,
    },
    // Criticidade — col F (índice 5)
    {
      type: 'list',
      sqref: `F2:F${MAX_ROW}`,
      formula1: '"Baixa,Normal,Alta,Crítica"',
      showDropDown: false,
    },
    // Percentual — col K (índice 10)
    {
      type: 'whole',
      sqref: `K2:K${MAX_ROW}`,
      operator: 'between',
      formula1: '0',
      formula2: '100',
      showErrorMessage: true,
      errorTitle: 'Valor inválido',
      error: 'Percentual deve ser entre 0 e 100.',
    },
    // Status — col L (índice 11)
    {
      type: 'list',
      sqref: `L2:L${MAX_ROW}`,
      formula1: '"PENDENTE,EM_ANDAMENTO,CONCLUIDA"',
      showDropDown: false,
    },
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'CRONOGRAMA')

  // ── Aba INSTRUÇÕES ──────────────────────────────────────────────────────────
  const wsInst = XLSX.utils.aoa_to_sheet(INSTRUCOES)
  wsInst['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 80 }]
  XLSX.utils.book_append_sheet(wb, wsInst, 'INSTRUÇÕES')

  // ── Aba USUÁRIOS (referência, não editável pelo usuário) ────────────────────
  if (usuarios.length > 0) {
    const wsUsers = XLSX.utils.aoa_to_sheet([
      ['Usuários cadastrados no sistema (use estes nomes exatos nas colunas Responsável e Executor)'],
      ['Nome'],
      ...usuarios.map(u => [u.nome]),
    ])
    wsUsers['!cols'] = [{ wch: 40 }]
    XLSX.utils.book_append_sheet(wb, wsUsers, 'USUÁRIOS')
  }

  // ── Gerar buffer ────────────────────────────────────────────────────────────
  const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as unknown as ArrayBuffer
  const blob = new Blob([xlsxBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const projetoId = id
  const fileName = `Modelo_Cronograma_Projeto_${projetoId}.xlsx`

  return new NextResponse(blob, {
    status: 200,
    headers: {
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}
