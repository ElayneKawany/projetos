import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_PATH = process.env.DATABASE_URL || path.join(process.cwd(), 'data', 'megag-pmo.db')
const SCHEMA_PATH = path.join(process.cwd(), 'lib', 'db', 'schema.sql')

// Garantir que o diretório data/ existe
const dataDir = path.dirname(DB_PATH)
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

let _db: Database.Database | null = null

/** Migrações de colunas (idempotentes – falham silenciosamente se já existirem) */
function runMigrations(db: Database.Database) {
  const addCol = (table: string, col: string, def = 'TEXT') => {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`) } catch { /* já existe */ }
  }
  // TAP V2 – campos do template de Escopo de Projeto
  addCol('tap_versoes', 'situacao_atual')
  addCol('tap_versoes', 'escopo_fisico')
  addCol('tap_versoes', 'escopo_sistemico')
  addCol('tap_versoes', 'escopo_processo')
  addCol('tap_versoes', 'setores_envolvidos')
  addCol('tap_versoes', 'etapas_projeto')
  addCol('tap_versoes', 'entregaveis')
  addCol('tap_versoes', 'pontos_atencao')
  addCol('tap_versoes', 'pontos_definir')
  // Viabilidade – campos do template
  addCol('viabilidade', 'resumo_executivo')
  addCol('viabilidade', 'sistemas_envolvidos')
  addCol('viabilidade', 'dependencia_fornecedores')
  addCol('viabilidade', 'recomendacao')
  addCol('viabilidade', 'justificativa_recomendacao')
  addCol('viabilidade', 'conclusao')
  // Cronograma – origem
  addCol('cronogramas', 'fonte_importacao', "TEXT DEFAULT 'MANUAL'")
  addCol('cronogramas', 'arquivo_origem')
}

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH)
    _db.pragma('journal_mode = WAL')
    _db.pragma('foreign_keys = ON')

    // Aplicar schema (CREATE TABLE IF NOT EXISTS – idempotente)
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8')
    _db.exec(schema)

    // Migrações de colunas adicionadas após a criação do banco
    runMigrations(_db)
  }
  return _db
}

export default getDb
