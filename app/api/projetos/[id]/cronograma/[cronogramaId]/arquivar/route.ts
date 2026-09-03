import { NextRequest, NextResponse } from 'next/server'
import { getSession, temPermissao } from '@/lib/auth'
import { CronogramaRepository } from '@/lib/repositories'
import { registrarAuditoria } from '@/lib/db/auditoria'
import { registrarEvento } from '@/lib/timeline'

// PATCH — arquiva uma versão antiga do cronograma (some da lista padrão do seletor, mas
// continua disponível marcando "Versões arquivadas" e na Timeline/Auditoria). Só ADMIN/PMO;
// a versão atual (maior número de versão do projeto) nunca pode ser arquivada. Não apaga
// nem altera nenhuma tarefa, fase, pagamento, parcela, aprovação ou linha de base.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; cronogramaId: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  if (!temPermissao(session.perfil, 'cronograma:arquivar_versao')) {
    return NextResponse.json({ error: 'Sem permissão para arquivar versões do cronograma.' }, { status: 403 })
  }

  const { id, cronogramaId } = await params
  const projeto_id    = Number(id)
  const cronograma_id = Number(cronogramaId)

  const cronograma = await CronogramaRepository.findByIdAndProjetoId(cronograma_id, projeto_id) as
    Record<string, unknown> | undefined
  if (!cronograma) return NextResponse.json({ error: 'Cronograma não encontrado.' }, { status: 404 })

  const maxVersao = CronogramaRepository.maxVersao(projeto_id)
  if (Number(cronograma.versao) === maxVersao) {
    return NextResponse.json({ error: 'Não é possível arquivar a versão atual.' }, { status: 400 })
  }
  if (Number(cronograma.arquivado) === 1) {
    return NextResponse.json({ error: 'Esta versão já está arquivada.' }, { status: 400 })
  }

  CronogramaRepository.arquivarVersao(cronograma_id, session.id)

  registrarEvento({
    projeto_id,
    modulo:          'CRONOGRAMA',
    artefato:        'CRONOGRAMA',
    evento:          'ALTERADO',
    titulo:          `Versão V${cronograma.versao} do cronograma arquivada`,
    descricao:       `Arquivada por ${session.nome} — deixa de aparecer na lista padrão, permanece no histórico.`,
    usuario_id:      session.id,
    usuario_nome:    session.nome,
    referencia_id:   cronograma_id,
    referencia_tipo: 'cronograma',
  })

  registrarAuditoria({
    usuario_id:   session.id,
    usuario_nome: session.nome,
    acao:         'UPDATE',
    entidade:     'cronogramas',
    entidade_id:  cronograma_id,
    projeto_id,
    descricao:    `Versão V${cronograma.versao} arquivada por ${session.nome} (perfil ${session.perfil})`,
    dados_antes:  { arquivado: 0 },
    dados_depois: { arquivado: 1 },
  })

  return NextResponse.json({ ok: true })
}
