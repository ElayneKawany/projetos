import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import { enquadrarLancamento } from '@/lib/financeiro/enquadramento'
import { FinanceiroRepository } from '@/lib/repositories'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import type { TipoDocumentoFinanceiro } from '@/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contId: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'projetos:manage')) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  const { id, contId } = await params
  const projeto_id = Number(id)
  const contrato_id = Number(contId)

  const contentType = request.headers.get('content-type') ?? ''
  let arquivo_path: string | null = null

  let fornecedor: string | null = null
  let numero_documento: string | null = null
  let tipo_documento: TipoDocumentoFinanceiro = 'NF'
  let nota_fiscal: string | null = null
  let data_pagamento: string | null = null
  let competencia: string | null = null
  let valor_pago = 0
  let observacao: string | null = null

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData()
    fornecedor = (form.get('fornecedor') as string) || null
    numero_documento = (form.get('numero_documento') as string) || null
    tipo_documento = ((form.get('tipo_documento') as string) || 'NF') as TipoDocumentoFinanceiro
    nota_fiscal = (form.get('nota_fiscal') as string) || null
    data_pagamento = (form.get('data_pagamento') as string) || null
    competencia = (form.get('competencia') as string) || null
    valor_pago = Number(form.get('valor_pago')) || 0
    observacao = (form.get('observacao') as string) || null

    const arquivo = form.get('arquivo') as File | null
    if (arquivo && arquivo.size > 0) {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'financeiro', String(projeto_id))
      await mkdir(uploadDir, { recursive: true })
      const ext = path.extname(arquivo.name) || ''
      const fname = `pag_${contrato_id}_${Date.now()}${ext}`
      const dest = path.join(uploadDir, fname)
      const buf = await arquivo.arrayBuffer()
      await writeFile(dest, Buffer.from(buf))
      arquivo_path = `/uploads/financeiro/${projeto_id}/${fname}`
    }
  } else {
    const body = await request.json()
    fornecedor = body.fornecedor ?? null
    numero_documento = body.numero_documento ?? null
    tipo_documento = (body.tipo_documento ?? 'NF') as TipoDocumentoFinanceiro
    nota_fiscal = body.nota_fiscal ?? null
    data_pagamento = body.data_pagamento ?? null
    competencia = body.competencia ?? null
    valor_pago = Number(body.valor_pago) || 0
    observacao = body.observacao ?? null
  }

  if (valor_pago <= 0) {
    return NextResponse.json({ error: 'Valor pago deve ser maior que zero.' }, { status: 400 })
  }

  try {
    // Contrato já é explícito (usuário abriu "Lançar pagamento" dentro deste card) — prioridade 1 do
    // enquadramento, vence sempre. Fornecedor vem do formulário (pré-preenchido com o contratado do
    // contrato, mas editável) — cai para o contratado do contrato só se vier vazio.
    const contrato = FinanceiroRepository.findContratoParaPagamento(contrato_id)
    if (!contrato) return NextResponse.json({ error: 'Contrato não encontrado.' }, { status: 404 })

    const fornecedorFinal = (fornecedor && fornecedor.trim()) || contrato.contratado

    const resultado = enquadrarLancamento(
      {
        contrato_id, projeto_id, fornecedor: fornecedorFinal,
        numero_documento, tipo_documento, nota_fiscal, data_pagamento, competencia, valor_pago, observacao, arquivo_path,
      },
      session.id,
      session.nome,
    )
    return NextResponse.json({ ok: true, id: resultado.pagamento_id }, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro ao salvar pagamento.' }, { status: 400 })
  }
}
