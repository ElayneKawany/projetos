import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { FinanceiroRepository } from '@/lib/repositories'
import { registrarAuditoria } from '@/lib/db/auditoria'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { id } = await params
  const lancamentos = FinanceiroRepository.findLancamentos(Number(id))
  return NextResponse.json({ lancamentos })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { id } = await params

  let tipo: string,
    categoria: string,
    descricao: string,
    fornecedor: string | null,
    numero_doc: string | null,
    valor: number,
    data_lancamento: string,
    competencia: string | null,
    observacoes: string | null,
    arquivo_nf: string | null

  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    tipo = formData.get('tipo')?.toString() ?? ''
    categoria = formData.get('categoria')?.toString() ?? ''
    descricao = formData.get('descricao')?.toString() ?? ''
    fornecedor = formData.get('fornecedor')?.toString() || null
    numero_doc = formData.get('numero_doc')?.toString() || null
    valor = parseFloat(formData.get('valor')?.toString() ?? '0')
    data_lancamento = formData.get('data_lancamento')?.toString() ?? ''
    competencia = formData.get('competencia')?.toString() || null
    observacoes = formData.get('observacoes')?.toString() || null

    // Handle file upload: save to public/uploads/financeiro/
    const file = formData.get('arquivo_nf')
    if (file && file instanceof File) {
      const timestamp = Date.now()
      const safeFilename = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      arquivo_nf = `/uploads/financeiro/${safeFilename}`
      // Note: actual file write requires fs — in Next.js 15 app router use writeFile from 'fs/promises'
      try {
        const { writeFile, mkdir } = await import('fs/promises')
        const { join } = await import('path')
        const uploadDir = join(process.cwd(), 'public', 'uploads', 'financeiro')
        await mkdir(uploadDir, { recursive: true })
        const buffer = Buffer.from(await file.arrayBuffer())
        await writeFile(join(uploadDir, safeFilename), buffer)
      } catch {
        arquivo_nf = null
      }
    } else {
      arquivo_nf = null
    }
  } else {
    const body = await request.json()
    tipo = body.tipo
    categoria = body.categoria
    descricao = body.descricao
    fornecedor = body.fornecedor || null
    numero_doc = body.numero_doc || null
    valor = body.valor
    data_lancamento = body.data_lancamento
    competencia = body.competencia || null
    observacoes = body.observacoes || null
    arquivo_nf = null
  }

  if (!tipo || !categoria || !descricao || !valor || !data_lancamento) {
    return NextResponse.json({ error: 'Campos obrigatórios não preenchidos.' }, { status: 400 })
  }

  const newId = FinanceiroRepository.insertLancamentoRoute({
    projeto_id: Number(id),
    tipo, categoria, descricao, fornecedor, numero_doc,
    valor, data_lancamento, competencia, observacoes,
    arquivo_nf, criado_por: session.id,
  })

  registrarAuditoria({
    usuario_id: session.id,
    usuario_nome: session.nome,
    acao: 'CREATE',
    entidade: 'financeiro_lancamentos',
    entidade_id: Number(newId),
    projeto_id: Number(id),
    descricao: `Lançamento ${tipo} criado: ${descricao} (R$ ${valor})`,
    dados_depois: { tipo, categoria, descricao, valor, data_lancamento },
  })

  return NextResponse.json({ ok: true, id: newId })
}
