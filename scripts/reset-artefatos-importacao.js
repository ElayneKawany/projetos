/**
 * Reset de status: TAP e Estudo de Viabilidade → RASCUNHO
 *
 * Projetos aguardando reimportação dos documentos oficiais.
 * Lista centralizada em: lib/config/reimportacao-pendente.ts
 *
 * Uso: node scripts/reset-artefatos-importacao.js
 *
 * O que faz:
 *   - Encontra a versão mais recente de tap_versoes e viabilidade para cada projeto
 *   - Se o status for APROVADO ou PENDENTE_APROVACAO, redefine para RASCUNHO
 *   - NÃO apaga registros, versões, histórico ou dados de auditoria
 *   - NÃO altera outros projetos
 *   - NÃO cria novas colunas ou tabelas
 *
 * Após a importação e aprovação dos documentos oficiais, os projetos
 * voltam ao fluxo normal automaticamente (nenhuma reversão necessária).
 */

'use strict'

const Database = require('better-sqlite3')
const path = require('path')

// Lista centralizada — espelho de lib/config/reimportacao-pendente.ts
const PROJETOS_PENDENTES_REIMPORTACAO = [
  'PRJ-2026-0001',
  'PRJ-2026-0002',
  'PRJ-2026-0007',
  'PRJ-2026-0008',
  'PRJ-2026-0009',
  'PRJ-2026-0010',
  'PRJ-2026-0011',
  'PRJ-2026-0012',
  'PRJ-2026-0014',
  'PRJ-2026-0020',
  'PRJ-2026-0021',
  'PRJ-2026-0025',
  'PRJ-2026-0026',
  'PRJ-2026-0027',
  'PRJ-2026-0028',
  'PRJ-2026-0031',
  'PRJ-2026-0032',
  'PRJ-2026-0033',
]

const DB_PATH = path.join(__dirname, '../data/megag-pmo.db')
const db = new Database(DB_PATH)

const findProjetoPorCodigo = db.prepare('SELECT id, codigo, nome FROM projetos WHERE codigo = ?')

const findLatestTap = db.prepare(`
  SELECT id, versao, status FROM tap_versoes
  WHERE projeto_id = ?
  ORDER BY versao DESC
  LIMIT 1
`)

const findLatestViabilidade = db.prepare(`
  SELECT id, versao, status FROM viabilidade
  WHERE projeto_id = ?
  ORDER BY versao DESC
  LIMIT 1
`)

const resetTapStatus = db.prepare(`
  UPDATE tap_versoes SET status = 'RASCUNHO' WHERE id = ?
`)

const resetViabilidadeStatus = db.prepare(`
  UPDATE viabilidade SET status = 'RASCUNHO' WHERE id = ?
`)

const STATUS_PARA_RESETAR = ['APROVADO', 'PENDENTE_APROVACAO']

let totalTapReset = 0
let totalViaReset = 0
let projetosNaoEncontrados = []

console.log('='.repeat(60))
console.log('Reset de artefatos — aguardando reimportação oficial')
console.log('='.repeat(60))
console.log()

const run = db.transaction(() => {
  for (const codigo of PROJETOS_PENDENTES_REIMPORTACAO) {
    const projeto = findProjetoPorCodigo.get(codigo)
    if (!projeto) {
      projetosNaoEncontrados.push(codigo)
      console.log(`⚠️  ${codigo} — projeto não encontrado no banco`)
      continue
    }

    console.log(`\n📁 ${projeto.codigo} — ${projeto.nome}`)

    // TAP
    const tap = findLatestTap.get(projeto.id)
    if (!tap) {
      console.log('   TAP: nenhuma versão encontrada')
    } else if (!STATUS_PARA_RESETAR.includes(tap.status)) {
      console.log(`   TAP v${tap.versao}: já em ${tap.status} — sem alteração`)
    } else {
      resetTapStatus.run(tap.id)
      console.log(`   TAP v${tap.versao}: ${tap.status} → RASCUNHO ✓`)
      totalTapReset++
    }

    // Viabilidade
    const via = findLatestViabilidade.get(projeto.id)
    if (!via) {
      console.log('   Viabilidade: nenhuma versão encontrada')
    } else if (!STATUS_PARA_RESETAR.includes(via.status)) {
      console.log(`   Viabilidade v${via.versao}: já em ${via.status} — sem alteração`)
    } else {
      resetViabilidadeStatus.run(via.id)
      console.log(`   Viabilidade v${via.versao}: ${via.status} → RASCUNHO ✓`)
      totalViaReset++
    }
  }
})

try {
  run()

  console.log()
  console.log('='.repeat(60))
  console.log('Resumo')
  console.log('='.repeat(60))
  console.log(`  TAPs resetados:          ${totalTapReset}`)
  console.log(`  Viabilidades resetadas:  ${totalViaReset}`)
  if (projetosNaoEncontrados.length > 0) {
    console.log(`  Projetos não encontrados: ${projetosNaoEncontrados.join(', ')}`)
  }
  console.log()
  console.log('Nenhum registro foi excluído. Apenas status redefinido para RASCUNHO.')
  console.log('Após importação e aprovação dos documentos oficiais, o fluxo volta ao normal.')
} catch (err) {
  console.error('ERRO — nenhuma alteração foi aplicada (transação revertida):', err)
  process.exit(1)
} finally {
  db.close()
}
