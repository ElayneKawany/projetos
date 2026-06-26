import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import getDb from '@/lib/db'
import { registrarAuditoria } from '@/lib/db/auditoria'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { id } = await params
  const db = getDb()
  const cronograma = db
    .prepare('SELECT * FROM cronogramas WHERE projeto_id = ? ORDER BY versao DESC LIMIT 1')
    .get(Number(id))
  if (!cronograma) return NextResponse.json({ cronograma: null, tarefas: [] })
  const tarefas = db
    .prepare(
      `SELECT ct.*, u.nome as responsavel_nome
       FROM cronograma_tarefas ct
       LEFT JOIN usuarios u ON ct.responsavel_id = u.id
       WHERE ct.cronograma_id = ?
       ORDER BY ct.ordem`
    )
    .all((cronograma as any).id)
  return NextResponse.json({ cronograma, tarefas })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { id } = await params
  const db = getDb()

  // Determine next versao
  const last = db
    .prepare('SELECT MAX(versao) as max_v FROM cronogramas WHERE projeto_id = ?')
    .get(Number(id)) as { max_v: number | null }
  const nextVersao = (last?.max_v ?? 0) + 1

  let body: {
    label?: string
    fonte_importacao?: string
    tarefas?: Array<{
      nome: string
      data_inicio?: string
      data_fim?: string
      responsavel_id?: number | null
      nivel?: string
      ordem?: number
      codigo?: string
    }>
  }

  // Support both JSON and FormData (Excel import)
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    body = {
      label: formData.get('label')?.toString() ?? `Versão ${nextVersao}`,
      fonte_importacao: 'EXCEL',
      tarefas: [],
    }
    // Excel parsing would happen here; for now return a placeholder
    // In production, use a server-side xlsx library to parse the file
    const file = formData.get('file')
    if (!file) return NextResponse.json({ error: 'Arquivo não enviado.' }, { status: 400 })
    // Placeholder: insert empty cronograma with note
    body.tarefas = []
  } else {
    body = await request.json()
  }

  const insertCron = db.prepare(
    `INSERT INTO cronogramas (projeto_id, versao, label, fonte_importacao, criado_por, status)
     VALUES (?, ?, ?, ?, ?, 'RASCUNHO')`
  )
  const result = insertCron.run(
    Number(id),
    nextVersao,
    body.label ?? `Versão ${nextVersao}`,
    body.fonte_importacao ?? 'MANUAL',
    session.id
  )
  const cronogramaId = result.lastInsertRowid as number

  const insertTarefa = db.prepare(
    `INSERT INTO cronograma_tarefas
       (cronograma_id, codigo, nome, nivel, data_inicio, data_fim, responsavel_id, ordem)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
  const tarefas = body.tarefas ?? []
  for (let i = 0; i < tarefas.length; i++) {
    const t = tarefas[i]
    insertTarefa.run(
      cronogramaId,
      t.codigo ?? null,
      t.nome,
      t.nivel ?? 'TAREFA',
      t.data_inicio ?? null,
      t.data_fim ?? null,
      t.responsavel_id ?? null,
      t.ordem ?? i + 1
    )
  }

  registrarAuditoria({
    usuario_id: session.id,
    usuario_nome: session.nome,
    acao: 'CREATE',
    entidade: 'cronogramas',
    entidade_id: cronogramaId,
    projeto_id: Number(id),
    descricao: `Cronograma V${nextVersao} criado (${body.fonte_importacao ?? 'MANUAL'})`,
    dados_depois: { versao: nextVersao, tarefas: tarefas.length },
  })

  return NextResponse.json({ ok: true, cronogramaId, versao: nextVersao })
}
