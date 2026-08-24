import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import { parsearExcelFinanceiro } from '@/lib/importadores/financeiro-excel'
import { importarContratos } from '@/lib/financeiro/importador'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'projetos:manage')) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  const { id } = await params
  const projeto_id = Number(id)

  const form = await request.formData()
  const file = form.get('file') as File | null

  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })
  }

  const ext = file.name.toLowerCase()
  if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls')) {
    return NextResponse.json({ error: 'Apenas arquivos .xlsx e .xls são aceitos.' }, { status: 400 })
  }

  const buffer = await file.arrayBuffer()
  const resultado = parsearExcelFinanceiro(buffer)

  if (resultado.errosFatais.length > 0) {
    return NextResponse.json({ ok: false, errosFatais: resultado.errosFatais }, { status: 422 })
  }

  if (resultado.contratos.length === 0) {
    return NextResponse.json({
      ok: false,
      warnings: resultado.warnings,
      mensagem: 'Nenhum contrato válido encontrado na planilha.',
    }, { status: 422 })
  }

  const { importados, pagamentosImportados, pagamentosDuplicadosIgnorados } = importarContratos(
    projeto_id,
    resultado.contratos,
    session.id,
    session.nome,
  )

  const warnings = [...resultado.warnings]
  if (pagamentosDuplicadosIgnorados > 0) {
    warnings.push(`${pagamentosDuplicadosIgnorados} lançamento(s) já existente(s) foram ignorados (evita duplicar reimportação da mesma planilha).`)
  }

  return NextResponse.json({
    ok: true,
    importados,
    pagamentosImportados,
    pagamentosDuplicadosIgnorados,
    contratosProcessados: resultado.contratosImportados,
    linhasLidas: resultado.linhasLidas,
    warnings,
  })
}
