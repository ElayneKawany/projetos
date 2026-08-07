import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { ComitesRepository } from '@/lib/repositories'
import {
  Document, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, Packer,
} from 'docx'
import type { AtaConteudoJson } from '@/types'

type Params = { params: Promise<{ id: string }> }

function cell(text: string, bold = false) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold, size: 20 })] })],
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
  })
}

export async function GET(request: NextRequest, { params }: Params) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { id } = await params
  const comiteId = parseInt(id)

  const comite = ComitesRepository.findRaw(comiteId) as Record<string, unknown> | undefined
  if (!comite) return NextResponse.json({ error: 'Comitê não encontrado.' }, { status: 404 })

  const ata = ComitesRepository.findAta(comiteId) as Record<string, unknown> | undefined
  if (!ata) return NextResponse.json({ error: 'Ata não encontrada.' }, { status: 404 })

  const participantes = ComitesRepository.findParticipantesNomeados(comiteId)

  let jsonData: AtaConteudoJson = {}
  if (ata.conteudo_json) {
    try { jsonData = JSON.parse(ata.conteudo_json as string) } catch { /* usa conteúdo texto */ }
  }

  const fmtDate = (s: unknown) => s ? new Date(String(s).substring(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR') : ''
  const titulo = String(comite.titulo)
  const data = fmtDate(comite.data_realizacao)
  const presentes = participantes.filter(p => p.presente).map(p => `${p.nome}${p.cargo ? ` (${p.cargo})` : ''}`)
  const ausentes = participantes.filter(p => !p.presente).map(p => p.nome)

  const separador = new Paragraph({ children: [new TextRun({ text: '', size: 12 })], spacing: { before: 120, after: 120 } })

  const children: Paragraph[] = []

  // ── Cabeçalho ────────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      text: 'ATA DE REUNIÃO — COMITÊ EXECUTIVO',
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: titulo, bold: true, size: 32 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
  )

  // Informações básicas
  const infos: [string, string][] = [
    ['Data', data],
    ['Local / Plataforma', String(comite.local || 'Não informado')],
    ['Tipo de Comitê', String(comite.tipo)],
    ['Hora de Início', String(ata.hora_inicio || comite.hora || 'Não informado')],
    ['Hora de Término', String(ata.hora_fim || 'Não informado')],
    ['Duração', ata.duracao_min ? `${ata.duracao_min} minutos` : 'Não informado'],
    ['Status da Ata', String(ata.status)],
    ['Versão', `v${ata.versao}`],
  ]

  for (const [label, valor] of infos) {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: `${label}: `, bold: true, size: 22 }),
        new TextRun({ text: valor, size: 22 }),
      ],
      spacing: { after: 80 },
    }))
  }

  children.push(separador)

  // ── Participantes ────────────────────────────────────────────────────────────
  children.push(new Paragraph({ text: 'Participantes Presentes', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 120 } }))
  if (presentes.length > 0) {
    for (const p of presentes) {
      children.push(new Paragraph({ children: [new TextRun({ text: `• ${p}`, size: 22 })], spacing: { after: 60 } }))
    }
  } else {
    children.push(new Paragraph({ children: [new TextRun({ text: 'Nenhum participante registrado.', italics: true, size: 22 })] }))
  }

  if (ausentes.length > 0) {
    children.push(new Paragraph({ text: 'Ausentes', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 120 } }))
    for (const a of ausentes) {
      children.push(new Paragraph({ children: [new TextRun({ text: `• ${a}`, size: 22 })], spacing: { after: 60 } }))
    }
  }

  if (jsonData.ausentes?.length) {
    for (const a of jsonData.ausentes) {
      children.push(new Paragraph({ children: [new TextRun({ text: `• ${a}`, size: 22 })], spacing: { after: 60 } }))
    }
  }

  children.push(separador)

  // ── Resumo Executivo ─────────────────────────────────────────────────────────
  if (jsonData.resumo) {
    children.push(new Paragraph({ text: 'Resumo Executivo', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 120 } }))
    for (const linha of jsonData.resumo.split('\n').filter(Boolean)) {
      children.push(new Paragraph({ children: [new TextRun({ text: linha, size: 22 })], spacing: { after: 80 } }))
    }
    children.push(separador)
  }

  // ── Projetos Discutidos ──────────────────────────────────────────────────────
  if (jsonData.projetos_discutidos?.length) {
    children.push(new Paragraph({ text: 'Projetos Discutidos', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 120 } }))
    for (const proj of jsonData.projetos_discutidos) {
      children.push(new Paragraph({ children: [new TextRun({ text: proj.nome, bold: true, size: 24 })], spacing: { before: 160, after: 80 } }))
      if (proj.status) children.push(new Paragraph({ children: [new TextRun({ text: `Status: ${proj.status}`, size: 22 })], spacing: { after: 60 } }))
      if (proj.pontos) children.push(new Paragraph({ children: [new TextRun({ text: `Pontos: ${proj.pontos}`, size: 22 })], spacing: { after: 60 } }))
      if (proj.problemas) children.push(new Paragraph({ children: [new TextRun({ text: `Problemas: ${proj.problemas}`, size: 22 })], spacing: { after: 60 } }))
      if (proj.decisoes) children.push(new Paragraph({ children: [new TextRun({ text: `Decisões: ${proj.decisoes}`, size: 22 })], spacing: { after: 60 } }))
    }
    children.push(separador)
  }

  // ── Decisões ─────────────────────────────────────────────────────────────────
  if (jsonData.decisoes?.length) {
    children.push(new Paragraph({ text: 'Decisões', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 120 } }))
    for (const d of jsonData.decisoes) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `• ${d.descricao}`, size: 22 }),
          ...(d.responsavel ? [new TextRun({ text: ` — Responsável: ${d.responsavel}`, size: 22, italics: true })] : []),
          ...(d.prazo ? [new TextRun({ text: ` · Prazo: ${d.prazo}`, size: 22, italics: true })] : []),
        ],
        spacing: { after: 80 },
      }))
    }
    children.push(separador)
  }

  // ── Pendências ───────────────────────────────────────────────────────────────
  if (jsonData.pendencias?.length) {
    children.push(new Paragraph({ text: 'Pendências', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 120 } }))
    for (const p of jsonData.pendencias) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `• ${p.descricao}`, size: 22 }),
          ...(p.responsavel ? [new TextRun({ text: ` — ${p.responsavel}`, size: 22, italics: true })] : []),
          ...(p.prazo ? [new TextRun({ text: ` · ${p.prazo}`, size: 22, italics: true })] : []),
        ],
        spacing: { after: 80 },
      }))
    }
    children.push(separador)
  }

  // ── Plano de Ação ─────────────────────────────────────────────────────────────
  if (jsonData.plano_acao?.length) {
    children.push(new Paragraph({ text: 'Plano de Ação', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 120 } }))
    const tabelaHeader = new TableRow({
      children: [cell('Ação', true), cell('Responsável', true), cell('Prazo', true), cell('Status', true)],
      tableHeader: true,
    })
    const tabelaRows = jsonData.plano_acao.map(a => new TableRow({
      children: [cell(a.acao), cell(a.responsavel), cell(a.prazo), cell(a.status)],
    }))
    children.push(new Paragraph({ children: [] }))
    const tabelaDoc = new Table({
      rows: [tabelaHeader, ...tabelaRows],
      width: { size: 100, type: WidthType.PERCENTAGE },
    }) as unknown as Paragraph
    children.push(tabelaDoc)
    children.push(separador)
  }

  // ── Riscos ────────────────────────────────────────────────────────────────────
  if (jsonData.riscos?.length) {
    children.push(new Paragraph({ text: 'Riscos Identificados', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 120 } }))
    for (const r of jsonData.riscos) {
      children.push(new Paragraph({ children: [new TextRun({ text: `⚠ ${r}`, size: 22 })], spacing: { after: 80 } }))
    }
    children.push(separador)
  }

  // ── Observações ───────────────────────────────────────────────────────────────
  if (jsonData.observacoes) {
    children.push(new Paragraph({ text: 'Observações', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 120 } }))
    for (const linha of jsonData.observacoes.split('\n').filter(Boolean)) {
      children.push(new Paragraph({ children: [new TextRun({ text: linha, size: 22 })], spacing: { after: 80 } }))
    }
    children.push(separador)
  }

  // Conteúdo texto quando não há JSON estruturado
  if (!jsonData.resumo && ata.conteudo) {
    children.push(new Paragraph({ text: 'Ata', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 120 } }))
    for (const linha of String(ata.conteudo).split('\n')) {
      children.push(new Paragraph({ children: [new TextRun({ text: linha, size: 22 })], spacing: { after: 80 } }))
    }
  }

  // ── Assinatura / Rodapé ───────────────────────────────────────────────────────
  children.push(
    separador,
    new Paragraph({
      children: [new TextRun({ text: 'Documento gerado automaticamente pelo sistema MegaG PMO', size: 18, italics: true, color: '888888' })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
    }),
  )

  const doc = new Document({
    creator: 'MegaG PMO',
    title: `Ata — ${titulo}`,
    description: `Ata do comitê "${titulo}" realizado em ${data}`,
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 22 } },
      },
    },
    sections: [{
      children: children as Paragraph[],
    }],
  })

  const buf = await Packer.toBuffer(doc)
  const nomeArq = titulo.replace(/[^a-zA-Z0-9 ]/g, '').trim().replace(/\s+/g, '-')

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="ata-${nomeArq}.docx"`,
    },
  })
}
