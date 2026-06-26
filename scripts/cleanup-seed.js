/**
 * LIMPEZA DE DADOS FICTÍCIOS – PMO MegaG
 *
 * Remove todos os dados do seed (projetos e usuários de teste)
 * mantendo apenas os projetos reais importados da planilha.
 *
 * Execução:
 *   node scripts/cleanup-seed.js
 *
 * ⚠️  Pare o servidor (Ctrl+C) antes de executar.
 *      Após a limpeza, reinicie com: npm run dev
 */

const Database = require('better-sqlite3')
const path = require('path')

const DB_PATH = path.join(__dirname, '..', 'data', 'megag-pmo.db')
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ── Identificar projetos do seed ──────────────────────────────
// Os 5 projetos fictícios criados pelo seed.js têm códigos PRJ-2026-0001 a PRJ-2026-0005
const seedProjetos = db.prepare(`
  SELECT id, codigo, nome FROM projetos
  WHERE CAST(REPLACE(codigo,'PRJ-2026-','') AS INTEGER) <= 5
`).all()

if (seedProjetos.length === 0) {
  console.log('ℹ️  Nenhum projeto seed encontrado. Limpeza já foi feita.')
} else {
  console.log(`🗑️  Projetos seed encontrados (${seedProjetos.length}):`)
  seedProjetos.forEach(p => console.log(`   • ${p.codigo} – ${p.nome}`))
}

const seedIds = seedProjetos.map(p => p.id)
const placeholders = seedIds.map(() => '?').join(',')

// ── Usuários fictícios (CPFs 000000000XX, exceto admin 01 e PMO 02) ──
const seedUsers = db.prepare(`
  SELECT id, cpf, nome FROM usuarios
  WHERE cpf LIKE '000000000%'
  AND cpf NOT IN ('00000000001','00000000002')
`).all()

console.log(`\n🗑️  Usuários de teste encontrados (${seedUsers.length}):`)
seedUsers.forEach(u => console.log(`   • CPF ${u.cpf} – ${u.nome}`))

// ── Comitês fictícios ─────────────────────────────────────────
const seedComites = db.prepare(`
  SELECT id, nome FROM comites
  WHERE id <= 10
`).all()

// ── Executar limpeza em transação ─────────────────────────────
const cleanup = db.transaction(() => {
  let total = 0

  if (seedIds.length > 0) {
    // Ordem respeita FKs: filhos antes dos pais
    const tabelas = [
      'execucao_arquivos',
      'execucao_atualizacoes',
      'cronograma_tarefas',
      'cronogramas',
      'estruturacao',
      'roi_acompanhamento',
      'financeiro_lancamentos',
      'viabilidade',
      'comite_projetos',
      'tap_versoes',
      'triagens',
      'aprovacoes',
      'notificacoes',
      'projeto_areas',
      'projeto_status_historico',
      'projeto_prioridade_historico',
      'documentos_versoes',
    ]

    for (const tabela of tabelas) {
      try {
        const r = db.prepare(
          `DELETE FROM ${tabela} WHERE projeto_id IN (${placeholders})`
        ).run(...seedIds)
        if (r.changes > 0) console.log(`  ✓ ${tabela}: ${r.changes} registro(s) removido(s)`)
        total += r.changes
      } catch (e) {
        // Tabela pode não ter coluna projeto_id — ignorar
      }
    }

    // Documentos podem ter só projeto_id indiretamente via documentos_versoes já deletadas
    try {
      db.prepare(`DELETE FROM documentos WHERE projeto_id IN (${placeholders})`).run(...seedIds)
    } catch (e) {}

    // Remover os projetos seed
    const rp = db.prepare(`DELETE FROM projetos WHERE id IN (${placeholders})`).run(...seedIds)
    console.log(`  ✓ projetos: ${rp.changes} removido(s)`)
    total += rp.changes
  }

  // Remover comitês seed e participantes
  for (const c of seedComites) {
    db.prepare('DELETE FROM comite_participantes WHERE comite_id = ?').run(c.id)
    db.prepare('DELETE FROM comite_projetos WHERE comite_id = ?').run(c.id)
    db.prepare('DELETE FROM comites WHERE id = ?').run(c.id)
    console.log(`  ✓ comitê removido: ${c.nome}`)
    total++
  }

  // Remover usuários de teste
  if (seedUsers.length > 0) {
    const userIds = seedUsers.map(u => u.id)
    const uph = userIds.map(() => '?').join(',')
    // Atualizar projetos que referenciam esses usuários (gerente_id, solicitante_id, created_by)
    for (const col of ['gerente_id', 'solicitante_id', 'created_by']) {
      try {
        db.prepare(`UPDATE projetos SET ${col} = 1 WHERE ${col} IN (${uph})`).run(...userIds)
      } catch (e) {}
    }
    db.prepare(`DELETE FROM sessoes WHERE usuario_id IN (${uph})`).run(...userIds)
    db.prepare(`DELETE FROM notificacoes WHERE usuario_id IN (${uph})`).run(...userIds)
    const ru = db.prepare(`DELETE FROM usuarios WHERE id IN (${uph})`).run(...userIds)
    console.log(`  ✓ usuários de teste: ${ru.changes} removido(s)`)
    total += ru.changes
  }

  // Limpar auditoria de seed
  db.prepare(`
    DELETE FROM auditoria
    WHERE descricao LIKE '%seed%'
    OR descricao LIKE '%Dados iniciais%'
    OR descricao LIKE '%teste%'
  `).run()

  return total
})

console.log('\n🔄 Executando limpeza...')
try {
  const total = cleanup()

  // Registrar auditoria da limpeza
  db.prepare(`
    INSERT INTO auditoria
      (usuario_id, usuario_nome, acao, entidade, descricao, dados_antes, dados_depois, created_at)
    VALUES (1, 'Administrador', 'DELETE_SOFT', 'projetos',
      'Limpeza de dados fictícios do seed — mantidos apenas projetos reais do portfólio',
      '{}', '{"operacao":"cleanup_seed"}', datetime('now'))
  `).run()

  console.log('\n' + '═'.repeat(55))
  console.log(`✅  Limpeza concluída! ${total} registros removidos.`)
  console.log('   Mantidos: Admin (CPF 000.000.000-01) e PMO (CPF 000.000.000-02)')
  console.log('   Mantidos: todos os projetos importados da planilha')
  console.log('═'.repeat(55))
  console.log('\nReinicie o servidor: npm run dev')
} catch (err) {
  console.error('\n❌ Erro durante a limpeza:', err.message)
  console.error('   Verifique se o servidor está parado e tente novamente.')
  process.exit(1)
}
