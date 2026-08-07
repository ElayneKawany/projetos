import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { ComitesRepository } from '@/lib/repositories'
import * as XLSX from 'xlsx'
import pptxgen from 'pptxgenjs'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id } = await params
  const comiteId = parseInt(id)

  const comite = ComitesRepository.findRaw(comiteId) as Record<string, unknown> | undefined
  if (!comite) return NextResponse.json({ error: 'Comitê não encontrado.' }, { status: 404 })

  const projetos = ComitesRepository.findProjetosParaExportacao(comiteId) as Record<string, unknown>[]
  const decisoes = ComitesRepository.findDecisoesParaExportacao(comiteId) as Record<string, unknown>[]
  const pendencias = ComitesRepository.findPendenciasParaExportacao(comiteId) as Record<string, unknown>[]

  const wb = XLSX.utils.book_new()

  // Aba: Capa
  const capaData = [
    ['Comitê Executivo — Exportação'],
    [],
    ['Título', comite.titulo],
    ['Data', comite.data_realizacao],
    ['Tipo', comite.tipo],
    ['Local', comite.local || ''],
    ['Status', comite.status],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(capaData), 'Capa')

  // Aba: Projetos
  const projCols = ['Código','Nome','Diretoria','Status','Decisão','Observações','Prioridade','Complexidade','Investimento (R$)','ROI Previsto (%)']
  const projRows = projetos.map(p => [
    p.codigo, p.nome, p.diretoria, p.status,
    p.decisao || '', p.observacoes || '',
    p.snap_prioridade || '', p.snap_complexidade || '',
    p.snap_investimento || '', p.snap_roi || '',
  ])
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([projCols, ...projRows]), 'Projetos')

  // Aba: Decisões
  const decCols = ['Tipo','Descrição','Projeto','Responsável','Prazo','Status']
  const decRows = decisoes.map(d => [d.tipo, d.descricao, d.projeto || '', d.responsavel_nome || '', d.prazo || '', d.status])
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([decCols, ...decRows]), 'Decisões')

  // Aba: Pendências
  const pedCols = ['Descrição','Projeto','Responsável','Prazo','Status']
  const pedRows = pendencias.map(p => [p.descricao, p.projeto || '', p.responsavel_nome || '', p.prazo || '', p.status])
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([pedCols, ...pedRows]), 'Pendências')

  const nomeTitulo = String(comite.titulo).replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-')
  const url = new URL(request.url)
  const formato = url.searchParams.get('formato') || 'xlsx'

  if (formato === 'pptx') {
    const prs = new pptxgen()
    prs.layout = 'LAYOUT_WIDE'
    prs.author = 'MegaG PMO'

    const azul = '003087'
    const dourado = 'D4AF37'

    // Slide 1: Capa
    const sl1 = prs.addSlide()
    sl1.background = { color: azul }
    sl1.addText(String(comite.titulo), { x: 1, y: 1.8, w: '80%', h: 1.2, fontSize: 32, bold: true, color: 'FFFFFF', align: 'center' })
    sl1.addText(`${String(comite.data_realizacao).substring(0, 10)} · ${String(comite.tipo)} · ${String(comite.local || '')}`, { x: 1, y: 3.2, w: '80%', fontSize: 14, color: dourado, align: 'center' })
    sl1.addText('MegaG PMO', { x: 1, y: 4.5, w: '80%', fontSize: 11, color: 'AAAAAA', align: 'center' })

    // Slide 2: Projetos pautados
    if (projetos.length > 0) {
      const sl2 = prs.addSlide()
      sl2.addText('Projetos Pautados', { x: 0.5, y: 0.3, w: '90%', fontSize: 22, bold: true, color: azul })
      const rows: pptxgen.TableRow[] = [
        [
          { text: 'Código', options: { bold: true, fill: { color: 'E8EEF7' } } },
          { text: 'Projeto', options: { bold: true, fill: { color: 'E8EEF7' } } },
          { text: 'Diretoria', options: { bold: true, fill: { color: 'E8EEF7' } } },
          { text: 'Status', options: { bold: true, fill: { color: 'E8EEF7' } } },
          { text: 'Decisão', options: { bold: true, fill: { color: 'E8EEF7' } } },
        ],
        ...projetos.map(p => ([
          { text: String(p.codigo || '') },
          { text: String(p.nome || '') },
          { text: String(p.diretoria || '') },
          { text: String(p.status || '') },
          { text: String(p.decisao || 'Pendente') },
        ] as pptxgen.TableRow)),
      ]
      sl2.addTable(rows, { x: 0.5, y: 1, w: 12, fontSize: 9, border: { type: 'solid', color: 'DDDDDD', pt: 0.5 } })
    }

    // Slide 3: Decisões
    if (decisoes.length > 0) {
      const sl3 = prs.addSlide()
      sl3.addText('Decisões e Encaminhamentos', { x: 0.5, y: 0.3, w: '90%', fontSize: 22, bold: true, color: azul })
      decisoes.forEach((d, i) => {
        sl3.addText(`[${String(d.tipo)}] ${String(d.descricao)}${d.responsavel_nome ? ` — ${d.responsavel_nome}` : ''}`, {
          x: 0.5, y: 1.2 + i * 0.6, w: '90%', fontSize: 11,
        })
      })
    }

    // Slide 4: Pendências
    if (pendencias.length > 0) {
      const sl4 = prs.addSlide()
      sl4.addText('Pendências', { x: 0.5, y: 0.3, w: '90%', fontSize: 22, bold: true, color: azul })
      pendencias.forEach((p, i) => {
        sl4.addText(`• ${String(p.descricao)}${p.responsavel_nome ? ` (${p.responsavel_nome})` : ''}${p.prazo ? ` — ${p.prazo}` : ''}`, {
          x: 0.5, y: 1.2 + i * 0.6, w: '90%', fontSize: 11,
        })
      })
    }

    const pptxBuf = await prs.write({ outputType: 'arraybuffer' }) as ArrayBuffer
    return new NextResponse(pptxBuf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="comite-${nomeTitulo}.pptx"`,
      },
    })
  }

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="comite-${nomeTitulo}.xlsx"`,
    },
  })
}
