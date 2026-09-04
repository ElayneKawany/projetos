import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import * as XLSX from 'xlsx'
import { CronogramaRepository } from '@/lib/repositories'

// Cabeçalho oficial — ordem fixa, nomes exatos
const CABECALHO = [
  'WBS', 'Nível', 'Nome', 'Descrição', 'Tipo', 'Criticidade',
  'Responsável',
  'Data Início', 'Nova Data Início',
  'Data Fim', 'Nova Data',
  'Status', 'Observações', 'Tipo Macro',
]

const COL_WIDTHS = [
  { wch: 8  },  // WBS
  { wch: 8  },  // Nível
  { wch: 40 },  // Nome
  { wch: 30 },  // Descrição
  { wch: 14 },  // Tipo
  { wch: 12 },  // Criticidade
  { wch: 28 },  // Responsável
  { wch: 13 },  // Data Início   (linha de base / original)
  { wch: 15 },  // Nova Data Início (reprogramação, se houver)
  { wch: 13 },  // Data Fim      (linha de base / original)
  { wch: 13 },  // Nova Data     (data de reprogramação, se houver)
  { wch: 14 },  // Status
  { wch: 35 },  // Observações
  { wch: 16 },  // Tipo Macro
]

const TIPO_DISPLAY: Record<string, string> = {
  TAREFA: 'Tarefa', MARCO: 'Marco', ENTREGA: 'Entrega',
  REUNIAO: 'Reunião', HOMOLOGACAO: 'Homologação', IMPLANTACAO: 'Implantação',
  TREINAMENTO: 'Treinamento', GO_LIVE: 'Go Live', OUTRO: 'Outro',
}

const CRIT_DISPLAY: Record<string, string> = {
  CRITICA: 'Crítica', ALTA: 'Alta', NORMAL: 'Normal', BAIXA: 'Baixa',
}

/** Converte YYYY-MM-DD para objeto Date em UTC meio-dia (evita drift de fuso). */
function isoParaDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const s = iso.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(s + 'T12:00:00Z')
  return isNaN(d.getTime()) ? null : d
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id } = await params
  const projetoId = Number(id)

  const cronograma = await CronogramaRepository.findAtivoSimples(projetoId) as { id: number; versao: number; label: string } | undefined

  if (!cronograma) {
    return NextResponse.json({ error: 'Nenhum cronograma encontrado para este projeto.' }, { status: 404 })
  }

  const tarefas = await CronogramaRepository.findTarefasComNomes(cronograma.id) as {
      codigo: string | null
      nivel: string
      nome: string
      descricao: string | null
      tipo: string | null
      criticidade: string | null
      responsavel_nome: string | null
      data_inicio: string | null
      data_inicio_baseline: string | null
      data_fim: string | null
      data_fim_baseline: string | null
      status: string | null
      observacoes: string | null
      tipo_macro: string | null
    }[]

  // Montar AOA — datas como objetos Date para células nativas Excel
  // Quando há reprogramação:
  //   "Data Fim"  → data_fim_baseline (linha de base / original)
  //   "Nova Data" → data_fim (nova data vigente)
  // Sem reprogramação:
  //   "Data Fim"  → data_fim
  //   "Nova Data" → vazio
  const aoa: unknown[][] = [CABECALHO]

  for (const t of tarefas) {
    const reprogramadaInicio = !!t.data_inicio_baseline
    const reprogramadaFim    = !!t.data_fim_baseline
    const dInicioBase  = isoParaDate(reprogramadaInicio ? t.data_inicio_baseline : t.data_inicio)
    const dInicioNova  = reprogramadaInicio ? isoParaDate(t.data_inicio) : null
    const dFimBase     = isoParaDate(reprogramadaFim ? t.data_fim_baseline : t.data_fim)
    const dFimNova     = reprogramadaFim ? isoParaDate(t.data_fim) : null
    aoa.push([
      t.codigo ?? '',
      t.nivel ?? 'TAREFA',
      t.nome,
      t.descricao ?? '',
      TIPO_DISPLAY[t.tipo ?? ''] ?? (t.tipo ?? 'Tarefa'),
      CRIT_DISPLAY[t.criticidade ?? ''] ?? (t.criticidade ?? 'Normal'),
      t.responsavel_nome ?? '',
      dInicioBase,   // Data Início (original/linha de base)
      dInicioNova,   // Nova Data Início (só preenchida quando reprogramada)
      dFimBase,      // Data Fim (original/linha de base)
      dFimNova,      // Nova Data (só preenchida quando reprogramada)
      t.status ?? 'PENDENTE',
      t.observacoes ?? '',
      t.nivel === 'FASE' ? (t.tipo_macro ?? 'OUTRO') : '',
    ])
  }

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true })
  ws['!cols'] = COL_WIDTHS

  // Formatar colunas de data (H=7, I=8, J=9, K=10) como DD/MM/YYYY
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  for (let R = 1; R <= range.e.r; R++) {
    for (const C of [7, 8, 9, 10]) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C })
      const cell = ws[addr]
      if (cell) ws[addr] = { ...cell, z: 'DD/MM/YYYY' }
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, 'CRONOGRAMA')

  const label   = cronograma.label ? `_${cronograma.label.replace(/[^a-z0-9]/gi, '_')}` : ''
  const fileName = `Cronograma_Projeto_${projetoId}_V${cronograma.versao}${label}.xlsx`

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellDates: true }) as ArrayBuffer
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  return new NextResponse(blob, {
    status: 200,
    headers: {
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}
