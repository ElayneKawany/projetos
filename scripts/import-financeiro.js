/**
 * IMPORTAÇÃO FINANCEIRA – PMO MegaG
 *
 * Importa Budget Aprovado, Budget Utilizado e Saldo Atualizado
 * extraídos da "Apresentação - Comitê de Projetos.pptx"
 *
 * Execução:
 *   node scripts/import-financeiro.js
 *
 * ⚠️  Pare o servidor (Ctrl+C) antes de executar.
 *      Após a importação, reinicie com: npm run dev
 */

const Database = require('better-sqlite3')
const path = require('path')

const DB_PATH = path.join(__dirname, '..', 'data', 'megag-pmo.db')
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ─────────────────────────────────────────────────────────────
// Dados extraídos da apresentação do Comitê de Projetos
// Estrutura: { palavras-chave para match, capex_aprovado, utilizado }
// ─────────────────────────────────────────────────────────────
const FINANCIAL_DATA = [
  {
    keywords: ['agendamento', 'web'],
    label: 'Agendamento WEB',
    capex_aprovado: 39403.00,
    utilizado:      15392.00,
  },
  {
    keywords: ['picking', 'cart'],
    label: 'Picking Cart',
    capex_aprovado: 0.00,
    utilizado:      39604.00,
  },
  {
    keywords: ['abastecimento'],
    match_status: 'EXECUCAO',   // diferencia Fase 1 (ROI) de Fase 2 (EXECUCAO)
    label: 'Ponto de Abastecimento – Fase 2 (Freteiro)',
    capex_aprovado: 220000.00,
    utilizado:      190055.00,
  },
  {
    keywords: ['abastecimento'],
    match_status: 'ROI',        // Fase 1 está em acompanhamento de payback
    label: 'Ponto de Abastecimento – Fase 1',
    capex_aprovado: 220000.00,
    utilizado:      190055.00,
  },
  {
    keywords: ['construção', 'araraquara'],
    label: 'Construção CD Araraquara',
    capex_aprovado: 93579999.00,
    utilizado:      16676500.00,
  },
  {
    keywords: ['módulo', 'orçamento'],
    label: 'Módulo de Orçamento (Fases 1 e 2)',
    capex_aprovado: 35290.00,
    utilizado:      26939.00,
    // Budget compartilhado entre Fase 1 e Fase 2 – aplica na Fase 1
    match_first_only: true,
  },
  {
    keywords: ['boleto', 'híbrido'],
    label: 'Boleto Híbrido',
    capex_aprovado: 66600.00,
    utilizado:      91600.00,
  },
  {
    keywords: ['sorter', 'caçapava'],
    label: 'Sorter CDR – Caçapava',
    capex_aprovado: 2316295.63,  // R$ 2.170.661,23 + aditivo R$ 145.634,40
    utilizado:      2292323.00,
  },
  {
    keywords: ['almoxarifado'],
    label: 'Almoxarifado Fase 1 (Concluído)',
    capex_aprovado: 51575.00,
    utilizado:      51575.00,
  },
  {
    keywords: ['rhonda'],
    label: 'Revitalização do Rhonda',
    capex_aprovado: 44537.50,
    utilizado:      0.00,
  },
  {
    keywords: ['tms', 'ravex'],
    label: 'TMS Ravex Fase 2',
    capex_aprovado: 0.00,
    utilizado:      0.00,
  },
]

// ─────────────────────────────────────────────────────────────
// Buscar projetos do banco para matching
// ─────────────────────────────────────────────────────────────
const allProjects = db.prepare('SELECT id, nome, status FROM projetos').all()

function normalize(s) {
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
}

function findProject(entry) {
  const candidates = allProjects.filter(p => {
    const n = normalize(p.nome)
    const matched = entry.keywords.every(kw => n.includes(normalize(kw)))
    if (!matched) return false
    if (entry.match_status && p.status !== entry.match_status) return false
    return true
  })
  if (entry.match_first_only) return candidates.slice(0, 1)
  return candidates
}

// ─────────────────────────────────────────────────────────────
// Statements SQL
// ─────────────────────────────────────────────────────────────
const stmtUpdateCapex = db.prepare(`
  UPDATE projetos SET capex_aprovado = ?, updated_at = datetime('now') WHERE id = ?
`)

const stmtInsertLancamento = db.prepare(`
  INSERT INTO financeiro_lancamentos
    (projeto_id, tipo, categoria, descricao, valor, data_lancamento,
     competencia, observacoes, criado_por, status, created_at)
  VALUES
    (?, 'CAPEX', 'OUTRO', ?, ?, date('now'),
     strftime('%Y-%m', 'now'), ?, 1, 'APROVADO', datetime('now'))
`)

const stmtAuditoria = db.prepare(`
  INSERT INTO auditoria
    (usuario_id, usuario_nome, acao, entidade, entidade_id, projeto_id,
     descricao, dados_antes, dados_depois, created_at)
  VALUES (1, 'Administrador', 'UPDATE', 'projetos', ?, ?,
    ?, '{}', ?, datetime('now'))
`)

// ─────────────────────────────────────────────────────────────
// Executar importação
// ─────────────────────────────────────────────────────────────
let updated = 0
let notFound = []

console.log('\n📊 Importando dados financeiros da apresentação do Comitê...\n')

const importAll = db.transaction(() => {
  for (const entry of FINANCIAL_DATA) {
    // Pular entradas sem valores financeiros reais
    if (entry.capex_aprovado === 0 && entry.utilizado === 0) {
      console.log(`  ⏭  Ignorado (sem valores): ${entry.label}`)
      continue
    }

    const matches = findProject(entry)

    if (matches.length === 0) {
      notFound.push(entry.label)
      console.log(`  ❓ Não encontrado no banco: ${entry.label}`)
      continue
    }

    for (const proj of matches) {
      // 1. Atualizar capex_aprovado na tabela projetos
      stmtUpdateCapex.run(entry.capex_aprovado, proj.id)

      // 2. Se há valor utilizado, criar lançamento CAPEX (apenas se ainda não existe)
      const jaExiste = db.prepare(
        "SELECT id FROM financeiro_lancamentos WHERE projeto_id = ? AND descricao LIKE '%Budget utilizado%'"
      ).get(proj.id)
      if (entry.utilizado > 0 && !jaExiste) {
        stmtInsertLancamento.run(
          proj.id,
          `Budget utilizado – importado da apresentação do Comitê de Projetos`,
          entry.utilizado,
          `Importado automaticamente. Budget aprovado: R$ ${entry.capex_aprovado.toLocaleString('pt-BR', {minimumFractionDigits:2})} | Utilizado: R$ ${entry.utilizado.toLocaleString('pt-BR', {minimumFractionDigits:2})}`
        )
      }

      // 3. Auditoria
      stmtAuditoria.run(
        proj.id,
        proj.id,
        `Importação financeira: "${proj.nome}" — Budget Aprovado: R$ ${entry.capex_aprovado.toLocaleString('pt-BR')}, Utilizado: R$ ${entry.utilizado.toLocaleString('pt-BR')}`,
        JSON.stringify({ capex_aprovado: entry.capex_aprovado, utilizado: entry.utilizado })
      )

      const saldo = entry.capex_aprovado - entry.utilizado
      console.log(`  ✅ ${proj.nome}`)
      console.log(`       Aprovado : R$ ${entry.capex_aprovado.toLocaleString('pt-BR', {minimumFractionDigits:2})}`)
      console.log(`       Utilizado: R$ ${entry.utilizado.toLocaleString('pt-BR', {minimumFractionDigits:2})}`)
      console.log(`       Saldo    : R$ ${saldo.toLocaleString('pt-BR', {minimumFractionDigits:2})}`)
      updated++
    }
  }
})

importAll()

console.log('\n' + '═'.repeat(55))
console.log(`✅  Importação concluída! ${updated} projeto(s) atualizados.`)
if (notFound.length > 0) {
  console.log(`\n⚠️  Não encontrados (verifique o nome no banco):`)
  notFound.forEach(n => console.log(`   • ${n}`))
}
console.log('═'.repeat(55))
console.log('\nReinicie o servidor: npm run dev')
