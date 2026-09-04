import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { registrarAuditoria } from '@/lib/db/auditoria'
import { asyncDb } from '@/lib/database'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!['ADMIN', 'PMO'].includes(session.perfil))
    return NextResponse.json({ error: 'Sem permissão — apenas ADMIN ou PMO' }, { status: 403 })

  const { id } = await params
  const projetoId = parseInt(id)
  if (isNaN(projetoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const db = getDb()
  const projeto = db.prepare(`
    SELECT p.*
    FROM projetos p
    WHERE p.id = ? AND p.ativo = 1
  `).get(projetoId) as Record<string, unknown> | undefined

  if (!projeto) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })
  if (!projeto.projeto_migrado) return NextResponse.json({ error: 'Projeto não é uma migração' }, { status: 400 })

  // cronogramas já migrada para Postgres — join cross-database não é mais possível,
  // resolvido em consulta separada (só precisamos saber se existe um cronograma ativo).
  const cronograma = await asyncDb.queryOne<{ id: number }>(
    `SELECT id FROM "AI"."TI_PMO_CRONOGRAMAS" WHERE projeto_id = ? AND ativo = true`,
    [projetoId]
  )

  // Verificar todas as pendências
  const pendencias: string[] = []
  if (!projeto.gerente_id)         pendencias.push('Responsável não definido')
  if (!projeto.pmo_responsavel_id) pendencias.push('PMO não definido')
  if (!projeto.ponto_focal)        pendencias.push('Ponto Focal não definido')
  if (!cronograma)                 pendencias.push('Cronograma não cadastrado')

  if (pendencias.length > 0) {
    return NextResponse.json({
      error: 'Existem pendências que impedem a finalização da migração',
      pendencias,
    }, { status: 422 })
  }

  const now = new Date().toISOString()

  db.transaction(() => {
    // Remove flag de migração
    db.prepare(`
      UPDATE projetos SET projeto_migrado = 0, updated_at = ? WHERE id = ?
    `).run(now, projetoId)

    db.prepare(`
      INSERT INTO projeto_timeline
        (projeto_id, modulo, artefato, evento, origem, titulo, descricao, usuario_id, usuario_nome, created_at)
      VALUES (?, 'PROJETO', 'PROJETO', 'ALTERADO', 'MANUAL',
        'Migração do projeto finalizada.',
        'Migração histórica concluída por ' || ? || '. Projeto passa a seguir todas as regras normais do PMO.',
        ?, ?, ?)
    `).run(projetoId, session.nome, session.id, session.nome, now)
  })()

  registrarAuditoria({
    usuario_id: session.id,
    usuario_nome: session.nome,
    acao: 'FINALIZAR_MIGRACAO',
    entidade: 'projetos',
    entidade_id: projetoId,
    projeto_id: projetoId,
    descricao: `Migração do projeto ID ${projetoId} finalizada por ${session.nome}`,
    dados_antes: { projeto_migrado: 1 },
    dados_depois: { projeto_migrado: 0, finalizado_em: now },
  })

  return NextResponse.json({ ok: true })
}
