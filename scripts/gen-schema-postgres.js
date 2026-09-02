/**
 * Gerador do schema Postgres — Migração SQLite → PostgreSQL, Fase 1
 *
 * Lê o snapshot estrutural gerado por `npx drizzle-kit pull`
 * (lib/db/drizzle/migrations/meta/0000_snapshot.json — fiel ao banco SQLite real,
 * 69 tabelas / 892 colunas / 103 foreign keys) e emite lib/db/drizzle/schema.postgres.ts.
 *
 * Regras de conversão (documentadas aqui, não escondidas em código):
 *   - Toda tabela vira `AI.TI_PMO_<NOME_MAIUSCULO>` (padrão de nomenclatura confirmado
 *     na auditoria IA Champions: Diretoria PMO/Governança, Departamento TI, Sistema PMO).
 *   - INTEGER PRIMARY KEY AUTOINCREMENT -> integer().generatedAlwaysAsIdentity() (IDs
 *     preservados, nunca renumerados — necessário pra Fase 4 do plano geral).
 *   - Toda FK já inferida pelo drizzle-kit (103 no total, via os REFERENCES inline que
 *     já existiam no SQLite) vira .references() real em Postgres, com nome de
 *     constraint em português.
 *   - Colunas booleanas: SQLite não tem tipo BOOLEAN — são INTEGER 0/1 por convenção.
 *     Só as colunas na lista BOOLEAN_COLUMNS abaixo (levantada por leitura de
 *     lib/db/schema.sql + lib/db/index.ts, não por nome parecido) viram `boolean`.
 *   - Colunas JSON: só as colunas na lista JSONB_COLUMNS abaixo (levantada pelos
 *     comentários `-- JSON:` / `-- JSON array` já presentes no schema original) viram
 *     `jsonb`. Nenhuma inferida por nome.
 *   - Datas puras (sem hora): só as colunas em DATE_ONLY_COLUMNS (as que eram
 *     declaradas DATE, não DATETIME, no schema original) viram `date`.
 *   - Qualquer outra coluna que pareça timestamp (nome termina em _at, _em, ou começa
 *     com data_ e não está em nenhuma lista acima) vira `timestamp with time zone`,
 *     EXCETO as em TEXT_DATE_EXCEPTIONS (ex.: `competencia`, formato "YYYY-MM", não é
 *     uma data real — fica TEXT).
 *   - Todo o resto: integer -> integer, real -> numeric, text -> text.
 *
 * Colunas que não caem em nenhuma lista de override E têm nome ambíguo (não terminam
 * em _at/_em, não começam com data_) ficam como TEXT por padrão — o mapeamento
 * conservador é "quando em dúvida, não converte o tipo", pra nunca perder dado por
 * suposição errada. Ver seção "REVISAR" no rodapé do arquivo gerado.
 */
'use strict'

const fs = require('fs')
const path = require('path')

const SNAPSHOT_PATH = path.join(__dirname, '..', 'lib', 'db', 'drizzle', 'migrations', 'meta', '0000_snapshot.json')
const OUT_PATH = path.join(__dirname, '..', 'lib', 'db', 'drizzle', 'schema.postgres.ts')

// ─── Overrides levantados por leitura de lib/db/schema.sql + lib/db/index.ts ────
// Formato: "tabela.coluna". Nunca por nome parecido — cada uma foi conferida na
// declaração original (INTEGER DEFAULT 0/1 com semântica sim/não, ou comentário -- JSON).

const BOOLEAN_COLUMNS = new Set([
  'diretorias.ativo', 'areas.ativo', 'perfis.ativo', 'usuarios.ativo', 'projetos.ativo',
  'projeto_areas.ativo', 'cronogramas.ativo', 'cronograma_tarefas.ativo',
  'financeiro_contratos.ativo', 'financeiro_pagamentos.ativo', 'config_status_projeto.ativo',
  'config_cronograma_tipos.ativo', 'config_cronograma_criticidades.ativo',
  'config_motivos_pausa.ativo', 'config_contas_contabeis.ativo', 'config_centros_custo.ativo',
  'orcamento_grupos.ativo', 'orcamento_itens.ativo', 'config_checklist_conclusao.ativo',
  'documento_aprovadores.ativo', 'workflow_tipos_participacao.ativo', 'workflow_modelos.ativo',
  'triagens.concluida', 'estruturacao.concluida',
  'comite_participantes.presente', 'comite_participantes.confirmado',
  'ti_prioridades.confirmada', 'ti_prioridades.solicitacao_alteracao',
  'notificacoes.lida',
  'cronograma_tarefas.bloqueio',
  'cronogramas.is_baseline', 'cronogramas.arquivado',
  'config_status_projeto.is_initial',
  'config_cronograma_tipos.is_system', 'config_cronograma_criticidades.is_system',
  'documentos.gerado_auto', 'comite_ata.gerado_por_ia',
  'documento_aprovadores.obrigatorio', 'config_checklist_conclusao.obrigatorio',
  'projetos.projeto_migrado', 'projetos.cronograma_pendente',
  'viabilidade.ganho_tarefa_ativo', 'viabilidade.hc_ativo', 'viabilidade.horas_analistas_ativo',
  'viabilidade.tipo_payback_quantitativo', 'viabilidade.tipo_payback_qualitativo',
])

const JSONB_COLUMNS = new Set([
  'perfis.permissoes',
  'tap_versoes.areas_impactadas', 'triagens.areas_impactadas',
  'viabilidade.receitas_previstas', 'viabilidade.custos_previstos', 'viabilidade.economia_prevista',
  'viabilidade.riscos', 'viabilidade.impactos', 'viabilidade.marcos',
  'estruturacao.entregas',
  'cronograma_tarefas.dependencias',
  'auditoria.dados_antes', 'auditoria.dados_depois',
  'projeto_timeline.dados_json',
  'documentos.conteudo_json', 'documentos_versoes.conteudo_json', 'comite_ata.conteudo_json',
  'comites.resumo_executivo_ia_json',
  'viabilidade.horas_analistas_json',
  'projetos.checklist_conclusao',
  'financeiro_pagamentos.contratos_candidatos',
])

// Tabela.coluna -> date (não timestamptz). Levantado pelas declarações DATE
// (não DATETIME) originais em schema.sql / lib/db/index.ts.
const DATE_ONLY_COLUMNS = new Set([
  'projetos.data_inicio_prev', 'projetos.data_fim_prev', 'projetos.data_golive',
  'viabilidade.data_inicio_prev', 'viabilidade.data_fim_prev',
  'financeiro_lancamentos.data_lancamento',
  'cronograma_tarefas.data_inicio', 'cronograma_tarefas.data_fim',
  'aprovacoes.prazo',
  'config_contas_contabeis.data_inicio', 'config_contas_contabeis.data_fim',
  'financeiro_movimentos.data_emissao', 'financeiro_movimentos.data_vencimento',
  // REVISAR: comentário original diz "YYYY-MM-DD (competência)" — data pura, mas
  // coluna foi criada como TEXT solto em CREATE TABLE (index.ts), não como DATE.
  // Incluída aqui por semântica, não por declaração de tipo — conferir antes de aplicar.
  'payback_registros.data',
])

// Colunas com nome de data/timestamp que NÃO são data real — ficam TEXT.
const TEXT_DATE_EXCEPTIONS = new Set([
  'financeiro_lancamentos.competencia', 'roi_acompanhamento.competencia',
  'financeiro_pagamentos.competencia',
  'payback_lancamentos.competencia', 'payback_competencias.competencia',
  'financeiro_contrato_projecao_parcelas.competencia',
])

const isTimestampName = (col) => /(_at|_em)$/i.test(col) || /^data_/i.test(col) || col === 'data'

function pgIdentifier(table) {
  return 'TI_PMO_' + table.toUpperCase()
}

function toCamel(snake) {
  return snake.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())
}

function main() {
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'))
  const tables = snapshot.tables
  const tableNames = Object.keys(tables).sort()

  const revisar = []
  const lines = []
  lines.push('/**')
  lines.push(' * Schema PostgreSQL — Migração SQLite → PostgreSQL, Fase 1 (GERADO)')
  lines.push(' *')
  lines.push(' * Gerado por scripts/gen-schema-postgres.js a partir do snapshot real do banco')
  lines.push(' * (lib/db/drizzle/migrations/meta/0000_snapshot.json, via `npx drizzle-kit pull`).')
  lines.push(' * NÃO editar à mão — editar as listas de override em gen-schema-postgres.js e')
  lines.push(' * rodar `node scripts/gen-schema-postgres.js` de novo.')
  lines.push(' *')
  lines.push(' * Ainda não aplicado a nenhum banco (nem teste, nem produção) — revisar antes.')
  lines.push(' * Ver seção "REVISAR" no final do arquivo para colunas de classificação incerta.')
  lines.push(' */')
  lines.push("import { pgSchema, integer, text, boolean, jsonb, date, timestamp, numeric, foreignKey } from 'drizzle-orm/pg-core'")
  lines.push('')
  lines.push("export const ai = pgSchema('AI')")
  lines.push('')

  const varNameOf = (t) => toCamel(t)

  // Ordem topológica por dependência de FK (uma tabela só é emitida depois de todas
  // as que ela referencia) — necessário porque o builder de FK nomeada (foreignKey())
  // referencia a const da tabela-alvo diretamente (não via lazy ()=>), então a tabela
  // alvo precisa já estar inicializada. Auto-referências (parent_id -> mesma tabela)
  // não entram como dependência de ordem — usam `table.id` (o parâmetro local do
  // callback), nunca a const externa, então funcionam em qualquer posição.
  const order = []
  const visited = new Set()
  const visiting = new Set()
  function visit(t) {
    if (visited.has(t)) return
    if (visiting.has(t)) { order.push(t); visited.add(t); return } // ciclo — não esperado neste domínio, mas não trava a geração
    visiting.add(t)
    const deps = new Set(Object.values(tables[t].foreignKeys).map(fk => fk.tableTo).filter(dep => dep !== t))
    for (const dep of deps) visit(dep)
    visiting.delete(t)
    visited.add(t)
    order.push(t)
  }
  for (const t of tableNames) visit(t)

  for (const t of order) {
    const table = tables[t]
    const cols = table.columns
    const colNames = Object.keys(cols)
    const varName = varNameOf(t)
    const pgTableName = pgIdentifier(t)

    // Mapa coluna-de-origem -> FK (uma FK por coluna nesta base; nenhuma composta encontrada)
    const fkByColumn = {}
    for (const fkName of Object.keys(table.foreignKeys)) {
      const fk = table.foreignKeys[fkName]
      const ptName = `fk_${t}_${fk.columnsFrom[0]}`.replace(/_id$/, '')
      fkByColumn[fk.columnsFrom[0]] = {
        refVar: varNameOf(fk.tableTo),
        refCol: toCamel(fk.columnsTo[0]),
        name: ptName,
        selfRef: fk.tableTo === t,
      }
    }

    lines.push(`export const ${varName} = ai.table('${pgTableName}', {`)
    for (const c of colNames) {
      const col = cols[c]
      const key = `${t}.${c}`
      const propName = toCamel(c)
      const propDecl = propName === c ? '' : `'${c}', `
      let pgType

      if (col.primaryKey && col.autoincrement) {
        pgType = `integer(${propDecl ? `'${c}'` : ''}).primaryKey().generatedAlwaysAsIdentity()`
      } else if (BOOLEAN_COLUMNS.has(key)) {
        pgType = `boolean(${propDecl ? `'${c}'` : ''})`
      } else if (JSONB_COLUMNS.has(key)) {
        pgType = `jsonb(${propDecl ? `'${c}'` : ''})`
      } else if (DATE_ONLY_COLUMNS.has(key)) {
        pgType = `date(${propDecl ? `'${c}'` : ''})`
      } else if (TEXT_DATE_EXCEPTIONS.has(key)) {
        pgType = `text(${propDecl ? `'${c}'` : ''})`
      } else if (isTimestampName(c)) {
        pgType = `timestamp(${propDecl ? `'${c}'` : ''}, { withTimezone: true })`
        revisar.push(`${key} — classificada como timestamptz por nome; conferir se é data pura antes de aplicar`)
      } else if (col.type === 'integer') {
        pgType = `integer(${propDecl ? `'${c}'` : ''})`
      } else if (col.type === 'real') {
        pgType = `numeric(${propDecl ? `'${c}'` : ''})`
      } else {
        pgType = `text(${propDecl ? `'${c}'` : ''})`
      }

      if (col.notNull && !(col.primaryKey && col.autoincrement)) pgType += '.notNull()'
      if (col.default !== undefined && !(col.primaryKey && col.autoincrement)) {
        const d = col.default
        const isNumericCol = pgType.startsWith('numeric(')
        const isBooleanCol = pgType.startsWith('boolean(')
        if (d === '(CURRENT_TIMESTAMP)') {
          // default de timestamp fica a cargo da aplicação/insert explícito na migração de dados
        } else if (typeof d === 'string' && /^'.*'$/.test(d)) {
          pgType += `.default(${d})`
        } else if (isBooleanCol && (d === 0 || d === 1)) {
          pgType += `.default(${d === 1 ? 'true' : 'false'})`
        } else if (isNumericCol && typeof d === 'number') {
          // numeric() no Drizzle pg-core espera default como string (precisão arbitrária)
          pgType += `.default('${d}')`
        } else if (typeof d === 'number') {
          pgType += `.default(${d})`
        }
      }

      lines.push(`  ${propName}: ${pgType},`)
    }

    const fkEntries = Object.keys(fkByColumn)
    if (fkEntries.length === 0) {
      lines.push('})')
    } else {
      lines.push('}, (table) => [')
      for (const c of fkEntries) {
        const fk = fkByColumn[c]
        const colFrom = toCamel(c)
        const toRef = fk.selfRef ? `table.${fk.refCol}` : `${fk.refVar}.${fk.refCol}`
        lines.push(`  foreignKey({ columns: [table.${colFrom}], foreignColumns: [${toRef}], name: '${fk.name}' }),`)
      }
      lines.push('])')
    }
    lines.push('')
  }

  lines.push('// ─── REVISAR ANTES DE APLICAR ─────────────────────────────────────────────')
  lines.push('// Colunas classificadas como timestamptz só pelo nome (_at/_em/data_*), sem')
  lines.push('// estar em nenhuma lista de override — conferir cada uma contra o uso real')
  lines.push('// antes de rodar isso contra qualquer banco:')
  for (const r of [...new Set(revisar)]) {
    lines.push(`// - ${r}`)
  }

  fs.writeFileSync(OUT_PATH, lines.join('\n') + '\n', 'utf8')
  console.log(`Gerado: ${OUT_PATH}`)
  console.log(`Tabelas: ${tableNames.length}`)
  console.log(`Colunas classificadas boolean: ${BOOLEAN_COLUMNS.size}`)
  console.log(`Colunas classificadas jsonb: ${JSONB_COLUMNS.size}`)
  console.log(`Colunas classificadas date: ${DATE_ONLY_COLUMNS.size}`)
  console.log(`Colunas timestamptz por nome (REVISAR): ${new Set(revisar).size}`)
}

main()
