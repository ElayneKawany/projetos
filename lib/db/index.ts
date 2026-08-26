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
  // TAP – coluna de controle de atualização
  addCol('tap_versoes', 'updated_at', 'DATETIME')
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
  addCol('viabilidade', 'complexidade_tecnica')
  addCol('viabilidade', 'dependencia_fornecedores')
  addCol('viabilidade', 'recomendacao')
  addCol('viabilidade', 'justificativa_recomendacao')
  addCol('viabilidade', 'conclusao')
  // Cronograma – origem + soft-delete
  addCol('cronogramas', 'fonte_importacao', "TEXT DEFAULT 'MANUAL'")
  addCol('cronogramas', 'arquivo_origem')
  addCol('cronogramas', 'ativo', 'INTEGER DEFAULT 1')
  addCol('cronogramas', 'deleted_at')
  // Cronograma – campos adicionados pelo modelo oficial v2
  addCol('cronograma_tarefas', 'descricao')
  // Cronograma – execução de tarefas
  addCol('cronograma_tarefas', 'data_conclusao')
  addCol('cronograma_tarefas', 'concluido_por', 'INTEGER')
  addCol('cronograma_tarefas', 'prazo_status')
  // Cronograma – responsável padrão para importações (config_global)
  try {
    db.prepare("INSERT OR IGNORE INTO config_global (chave, valor, descricao) VALUES ('responsavel_padrao_importacao', '', 'Usuário padrão para tarefas sem responsável na importação de cronograma')").run()
  } catch { /* config_global pode não existir ainda — seeds criarão depois */ }

  // Migração de dados: status legado ATIVO → RASCUNHO (cronogramas criados antes da padronização)
  try {
    db.prepare("UPDATE cronogramas SET status = 'RASCUNHO' WHERE status = 'ATIVO'").run()
  } catch { /* tabela pode não existir em banco limpo */ }

  // Label de status: EXECUCAO → "Execução em andamento" (reflete melhor o ciclo de vida)
  try {
    db.prepare("UPDATE config_status_projeto SET label = 'Execução em andamento' WHERE codigo = 'EXECUCAO' AND label = 'Execução'").run()
  } catch { /* tabela pode não existir em banco limpo */ }

  // Cronograma – tipo semântico da macro fase (determina cor e ícone; substitui heurística de texto)
  addCol('cronograma_tarefas', 'tipo_macro', "TEXT DEFAULT 'OUTRO'")

  // Migração única: inferir tipo_macro para fases legadas com base no nome
  // Executada apenas uma vez — flag em config_global impede repetição
  try {
    const migFlag = db.prepare("SELECT valor FROM config_global WHERE chave = 'tipo_macro_migrated'").get()
    if (!migFlag) {
      db.prepare(`
        UPDATE cronograma_tarefas
        SET tipo_macro = CASE
          WHEN nome LIKE '%Inicia%'   THEN 'INICIACAO'
          WHEN nome LIKE '%Planej%'   THEN 'PLANEJAMENTO'
          WHEN nome LIKE '%Estrutur%' THEN 'ESTRUTURACAO'
          WHEN nome LIKE '%Desenvolv%' THEN 'DESENVOLVIMENTO'
          WHEN nome LIKE '%Implant%'  THEN 'IMPLANTACAO'
          WHEN nome LIKE '%Go Live%'  THEN 'GO_LIVE'
          WHEN nome LIKE '%Encerr%'   THEN 'ENCERRAMENTO'
          ELSE 'OUTRO'
        END
        WHERE nivel = 'FASE' AND (tipo_macro IS NULL OR tipo_macro = 'OUTRO')
      `).run()
      db.prepare(
        "INSERT OR IGNORE INTO config_global (chave, valor, descricao) VALUES ('tipo_macro_migrated', '1', 'Migração tipo_macro concluída — fases legadas mapeadas pelo nome')"
      ).run()
    }
  } catch { /* config_global pode não existir em banco limpo — seeds criam depois */ }

  // Sprint 1 – Módulo de Projetos
  // Projetos: campo justificativa (separado de descricao, obrigatório no cadastro)
  addCol('projetos', 'justificativa')

  // Diretorias — campos administrativos
  addCol('diretorias', 'descricao')
  addCol('diretorias', 'updated_at', 'DATETIME')
  addCol('diretorias', 'diretor_responsavel_id', 'INTEGER')
  addCol('diretorias', 'ordem', 'INTEGER DEFAULT 99')
  // Inicializa ordem institucional com base na sigla (idempotente — roda sempre para corrigir 99)
  try {
    db.exec(`
      UPDATE diretorias SET ordem = CASE sigla
        WHEN 'DF'    THEN 1
        WHEN 'DC'    THEN 2
        WHEN 'DMN'   THEN 3
        WHEN 'DL'    THEN 4
        ELSE 99 END
    `)
  } catch { /* silencioso */ }

  // Áreas — campos administrativos
  addCol('areas', 'descricao')
  addCol('areas', 'updated_at', 'DATETIME')

  // Sprint 2 – Premissas Financeiras do Estudo de Viabilidade
  addCol('viabilidade', 'capex', 'REAL')
  addCol('viabilidade', 'opex', 'REAL')
  addCol('viabilidade', 'opex_periodicidade', "TEXT DEFAULT 'MENSAL'")
  addCol('viabilidade', 'economia_estimada', 'REAL')
  addCol('viabilidade', 'economia_periodicidade', "TEXT DEFAULT 'MENSAL'")
  addCol('viabilidade', 'tipo_payback', "TEXT DEFAULT 'QUALITATIVO'")
  addCol('viabilidade', 'payback_informado', 'REAL')
  addCol('viabilidade', 'payback_unidade', "TEXT DEFAULT 'MESES'")
  // Condições para aprovação — obrigatório quando recomendacao = VIAVEL_AJUSTES
  addCol('viabilidade', 'condicoes_aprovacao')
  // Tipo de payback como flags independentes (permite selecionar ambos)
  addCol('viabilidade', 'tipo_payback_quantitativo', 'INTEGER')
  addCol('viabilidade', 'tipo_payback_qualitativo', 'INTEGER')
  addCol('viabilidade', 'beneficios_esperados')

  // Tabela de configuração de status (permite customização por empresa)
  db.exec(`CREATE TABLE IF NOT EXISTS config_status_projeto (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    descricao TEXT,
    cor TEXT DEFAULT '#6B7280',
    ordem INTEGER DEFAULT 0,
    ativo INTEGER DEFAULT 1,
    is_initial INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`)

  // Tabela de histórico de alterações por campo (rastreabilidade completa)
  db.exec(`CREATE TABLE IF NOT EXISTS projeto_historico_alteracoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projeto_id INTEGER NOT NULL,
    usuario_id INTEGER,
    usuario_nome TEXT,
    campo TEXT NOT NULL,
    valor_anterior TEXT,
    valor_novo TEXT,
    acao TEXT DEFAULT 'UPDATE',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`)

  // Workflow de aprovação de documentos (TAP, Viabilidade, Cronograma, Encerramento…)
  db.exec(`CREATE TABLE IF NOT EXISTS workflow_aprovacao (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projeto_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    referencia_id INTEGER NOT NULL,
    etapa_atual INTEGER DEFAULT 1,
    status TEXT DEFAULT 'EM_ANDAMENTO',
    criado_por INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  db.exec(`CREATE TABLE IF NOT EXISTS workflow_etapas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id INTEGER NOT NULL,
    ordem INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    usuario_nome TEXT NOT NULL,
    tipo TEXT NOT NULL,
    status TEXT DEFAULT 'PENDENTE',
    observacao TEXT,
    respondido_em DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  // Tipos de participação configuráveis (Aprovação, Ciência, futuros)
  db.exec(`CREATE TABLE IF NOT EXISTS workflow_tipos_participacao (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    codigo TEXT NOT NULL UNIQUE,
    descricao TEXT,
    ativo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  // Modelos de workflow reutilizáveis
  db.exec(`CREATE TABLE IF NOT EXISTS workflow_modelos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    descricao TEXT,
    ativo INTEGER DEFAULT 1,
    criado_por INTEGER,
    criado_por_nome TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  db.exec(`CREATE TABLE IF NOT EXISTS workflow_modelo_etapas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    modelo_id INTEGER NOT NULL,
    ordem INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    usuario_nome TEXT NOT NULL,
    tipo TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  // Referência ao modelo usado em cada workflow (nullable — pode ser ad-hoc)
  addCol('workflow_aprovacao', 'modelo_id', 'INTEGER')

  // ─── Sprint Financeiro — Arquitetura Oficial ───────────────────────────────

  // Plano de contas contábeis global (futura integração Consinco)
  db.exec(`CREATE TABLE IF NOT EXISTS config_contas_contabeis (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo           TEXT NOT NULL UNIQUE,
    descricao        TEXT NOT NULL,
    tipo             TEXT NOT NULL DEFAULT 'CAPEX_ATIVO',
    -- CAPEX_ATIVO | CAPEX_RETORNO | OPEX
    empresa          TEXT,
    filial           TEXT,
    integracao_codigo TEXT,   -- código no sistema ERP/Consinco
    ativo            INTEGER NOT NULL DEFAULT 1,
    data_inicio      DATE,
    data_fim         DATE,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  // Centros de custo globais (futura integração Consinco)
  db.exec(`CREATE TABLE IF NOT EXISTS config_centros_custo (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo      TEXT NOT NULL UNIQUE,
    descricao   TEXT NOT NULL,
    empresa     TEXT,
    filial      TEXT,
    ativo       INTEGER NOT NULL DEFAULT 1,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  // Grupos de investimento do orçamento (Nível 1) — criados na Viabilidade
  db.exec(`CREATE TABLE IF NOT EXISTS orcamento_grupos (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    projeto_id    INTEGER NOT NULL,
    viabilidade_id INTEGER,
    tipo          TEXT NOT NULL DEFAULT 'CAPEX_ATIVO',
    -- CAPEX_ATIVO | CAPEX_RETORNO | OPEX
    nome          TEXT NOT NULL,
    cor           TEXT,    -- hex: '#003087' — para dashboards
    icone         TEXT,    -- emoji ou nome de ícone
    ordem         INTEGER NOT NULL DEFAULT 0,
    ativo         INTEGER NOT NULL DEFAULT 1,
    criado_por    INTEGER,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  // Itens de investimento (Nível 2) — única fonte dos valores aprovados
  db.exec(`CREATE TABLE IF NOT EXISTS orcamento_itens (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    grupo_id              INTEGER NOT NULL,
    projeto_id            INTEGER NOT NULL,
    nome                  TEXT NOT NULL,
    descricao             TEXT,
    conta_contabil_id     INTEGER,  -- FK config_contas_contabeis (nullable)
    centro_custo_id       INTEGER,  -- FK config_centros_custo (nullable)
    valor_aprovado        REAL NOT NULL DEFAULT 0,
    valor_revisado        REAL,     -- revisão aprovada pós-viabilidade
    status                TEXT NOT NULL DEFAULT 'ATIVO',
    -- ATIVO | SUSPENSO | CANCELADO
    prioridade            TEXT NOT NULL DEFAULT 'MEDIA',
    -- ALTA | MEDIA | BAIXA
    responsavel_usuario_id INTEGER,   -- FK usuarios (nullable)
    ordem                 INTEGER NOT NULL DEFAULT 0,
    ativo                 INTEGER NOT NULL DEFAULT 1,
    criado_por            INTEGER,
    created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  // Movimentos financeiros — NF, contrato, comprovante, medição, adiantamento…
  db.exec(`CREATE TABLE IF NOT EXISTS financeiro_movimentos (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    projeto_id    INTEGER NOT NULL,
    item_id       INTEGER,   -- FK orcamento_itens (nullable — backcompat)
    tipo_movimento TEXT NOT NULL DEFAULT 'NF',
    -- NF | CONTRATO | COMPROVANTE | MEDICAO | ADIANTAMENTO | OUTRO
    numero_doc    TEXT,
    fornecedor    TEXT,
    valor_total   REAL NOT NULL DEFAULT 0,
    -- indica comprometimento; reduz saldo disponível
    data_emissao  DATE,
    data_vencimento DATE,
    status        TEXT NOT NULL DEFAULT 'PENDENTE',
    -- PENDENTE | APROVADO | REJEITADO | CANCELADO
    observacoes   TEXT,
    arquivo_path  TEXT,
    criado_por    INTEGER NOT NULL,
    aprovado_por  INTEGER,
    aprovado_em   DATETIME,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  // Pagamentos vinculados a um movimento (um movimento → N pagamentos)
  // movimento_id nullable: registros legados têm valor real; registros do módulo de contratos têm 0
  db.exec(`CREATE TABLE IF NOT EXISTS financeiro_pagamentos (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    movimento_id   INTEGER,
    projeto_id     INTEGER NOT NULL,
    valor_pago     REAL NOT NULL,
    data_pagamento TEXT,
    observacoes    TEXT,
    criado_por     INTEGER NOT NULL,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  // Timeline genérica do projeto — consolida todos os módulos
  db.exec(`CREATE TABLE IF NOT EXISTS projeto_timeline (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    projeto_id       INTEGER NOT NULL,
    modulo           TEXT NOT NULL,
    -- FINANCEIRO | WORKFLOW | CRONOGRAMA | PAYBACK | APROVACAO | TAP | VIABILIDADE | ORCAMENTO | SISTEMA
    artefato         TEXT NOT NULL,
    -- ITEM | DOCUMENTO | PAGAMENTO | TAP | CRONOGRAMA | WORKFLOW | GRUPO | PROJETO | MOVIMENTO
    evento           TEXT NOT NULL,
    -- CRIADO | ALTERADO | APROVADO | REJEITADO | CANCELADO | PAGO | ENVIADO | REVISAO | ENCERRADO | SUSPENSO
    origem           TEXT NOT NULL DEFAULT 'MANUAL',
    -- MANUAL | WORKFLOW | API | IMPORTACAO | ERP
    titulo           TEXT NOT NULL,
    descricao        TEXT,
    usuario_id       INTEGER,
    usuario_nome     TEXT,
    referencia_id    INTEGER,
    referencia_tipo  TEXT,
    dados_json       TEXT,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  // Coluna de backcompat em financeiro_lancamentos (legado)
  addCol('financeiro_lancamentos', 'item_id', 'INTEGER')

  // ─── Sprint Cronograma — Evolução do módulo existente ─────────────────────

  // Modo de elaboração do cronograma
  addCol('cronogramas', 'modo', "TEXT NOT NULL DEFAULT 'CENTRALIZADO'")
  // CENTRALIZADO | COLABORATIVO | IMPORTADO

  // Novos campos em cronograma_tarefas
  addCol('cronograma_tarefas', 'area_id',       'INTEGER')           // FK areas(id) — modo colaborativo
  addCol('cronograma_tarefas', 'tipo',           "TEXT DEFAULT 'TAREFA'")
  // TAREFA | MARCO | ENTREGA | REUNIAO | HOMOLOGACAO | IMPLANTACAO | VALIDACAO | TREINAMENTO | GO_LIVE | OUTRO
  addCol('cronograma_tarefas', 'criticidade',    "TEXT DEFAULT 'NORMAL'")
  // NORMAL | ALTA | CRITICA
  addCol('cronograma_tarefas', 'observacoes',    'TEXT')
  addCol('cronograma_tarefas', 'motivo_atraso',  'TEXT')
  addCol('cronograma_tarefas', 'dependencia_id', 'INTEGER')          // FK cronograma_tarefas(id) — para Gantt futuro
  addCol('cronograma_tarefas', 'peso',           'REAL DEFAULT 1')   // peso para progresso ponderado (cálculo futuro)
  addCol('cronograma_tarefas', 'alterado_por',   'INTEGER')          // FK usuarios(id)
  addCol('cronograma_tarefas', 'alterado_em',    'TEXT')

  // ─── Cronograma Sprint 2 — campos novos ───────────────────────────────────
  addCol('cronograma_tarefas', 'executor_id',    'INTEGER')          // FK usuarios(id) — executor opcional
  addCol('cronograma_tarefas', 'criado_por',     'INTEGER')          // FK usuarios(id) — corrige bug nova-atividade

  // ─── Soft-delete em tarefas (inline edit) ────────────────────────────────
  addCol('cronograma_tarefas', 'ativo', 'INTEGER DEFAULT 1')         // 0 = excluído pelo editor inline

  // ─── Responsável/Executor texto livre (aceita nomes externos) ────────────
  addCol('cronograma_tarefas', 'responsavel_nome_ext', 'TEXT')       // nome quando responsavel_id é NULL
  addCol('cronograma_tarefas', 'executor_nome_ext',    'TEXT')       // nome quando executor_id é NULL

  // ─── Cronograma Sprint 2 — soft-delete e controle de versão ───────────────
  addCol('cronogramas', 'ativo',       'INTEGER DEFAULT 1')          // 0 = substituído/soft-deleted
  addCol('cronogramas', 'deleted_at',  'TEXT')                       // ISO datetime quando ativo=0

  // Tabelas de configuração de tipos de tarefa e criticidades
  db.exec(`CREATE TABLE IF NOT EXISTS config_cronograma_tipos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo     TEXT NOT NULL UNIQUE,
    label      TEXT NOT NULL,
    ordem      INTEGER DEFAULT 0,
    ativo      INTEGER NOT NULL DEFAULT 1,
    is_system  INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`)

  db.exec(`CREATE TABLE IF NOT EXISTS config_cronograma_criticidades (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo     TEXT NOT NULL UNIQUE,
    label      TEXT NOT NULL,
    cor        TEXT DEFAULT '#6B7280',
    ordem      INTEGER DEFAULT 0,
    ativo      INTEGER NOT NULL DEFAULT 1,
    is_system  INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`)

  // Seed: tipos de tarefa padrão
  const tiposCronCount = (db.prepare('SELECT COUNT(*) as c FROM config_cronograma_tipos').get() as { c: number }).c
  if (tiposCronCount === 0) {
    const insTipoCron = db.prepare(
      'INSERT INTO config_cronograma_tipos (codigo, label, ordem, is_system) VALUES (?, ?, ?, ?)'
    )
    const tiposPadrao: [string, string, number, number][] = [
      ['TAREFA',       'Tarefa',       1,  1],
      ['MARCO',        'Marco',        2,  1],
      ['ENTREGA',      'Entrega',      3,  1],
      ['REUNIAO',      'Reunião',      4,  1],
      ['HOMOLOGACAO',  'Homologação',  5,  1],
      ['IMPLANTACAO',  'Implantação',  6,  1],
      ['VALIDACAO',    'Validação',    7,  1],
      ['TREINAMENTO',  'Treinamento',  8,  1],
      ['GO_LIVE',      'Go Live',      9,  1],
      ['OUTRO',        'Outro',        10, 0],
    ]
    for (const [codigo, label, ordem, is_system] of tiposPadrao) {
      insTipoCron.run(codigo, label, ordem, is_system)
    }
  }

  // Seed: criticidades padrão
  const critCount = (db.prepare('SELECT COUNT(*) as c FROM config_cronograma_criticidades').get() as { c: number }).c
  if (critCount === 0) {
    const insCrit = db.prepare(
      'INSERT INTO config_cronograma_criticidades (codigo, label, cor, ordem, is_system) VALUES (?, ?, ?, ?, ?)'
    )
    insCrit.run('NORMAL',  'Normal',   '#6B7280', 1, 1)
    insCrit.run('ALTA',    'Alta',     '#F59E0B', 2, 1)
    insCrit.run('CRITICA', 'Crítica',  '#EF4444', 3, 1)
  }

  // Seed: tipos de participação padrão
  const tiposCount = (db.prepare('SELECT COUNT(*) as c FROM workflow_tipos_participacao').get() as { c: number }).c
  if (tiposCount === 0) {
    const insTipo = db.prepare('INSERT INTO workflow_tipos_participacao (nome, codigo, descricao) VALUES (?, ?, ?)')
    insTipo.run('Aprovação', 'APROVACAO', 'Etapa de aprovação formal — pode rejeitar e solicitar revisão')
    insTipo.run('Ciência',   'CIENCIA',   'Tomada de ciência — avança automaticamente sem possibilidade de rejeição')
  }

  // ─── Sprint Financeiro — Módulo de Contratos ─────────────────────────────
  // observacao (sem S) é o campo oficial desde a criação; observacoes é mantido apenas via addCol
  // para bancos legados já existentes (COALESCE no SELECT garante compatibilidade)
  db.exec(`CREATE TABLE IF NOT EXISTS financeiro_contratos (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    projeto_id       INTEGER NOT NULL,
    numero_contrato  TEXT,
    contratado       TEXT NOT NULL,
    tipo_contrato    TEXT NOT NULL DEFAULT 'SERVICO',
    descricao_servico TEXT,
    valor_aprovado   REAL NOT NULL DEFAULT 0,
    status           TEXT NOT NULL DEFAULT 'ATIVO',
    observacao       TEXT,
    ativo            INTEGER NOT NULL DEFAULT 1,
    criado_por       INTEGER,
    created_at       TEXT DEFAULT (datetime('now')),
    updated_at       TEXT DEFAULT (datetime('now'))
  )`)

  // Expandir financeiro_pagamentos com campos de contrato (colunas novas; movimento_id NULL = registro antigo)
  addCol('financeiro_pagamentos', 'contrato_id',       'INTEGER')
  addCol('financeiro_pagamentos', 'numero_documento',  'TEXT')
  addCol('financeiro_pagamentos', 'tipo_documento',    "TEXT DEFAULT 'NF'")
  addCol('financeiro_pagamentos', 'nota_fiscal',       'TEXT')
  addCol('financeiro_pagamentos', 'competencia',       'TEXT')
  addCol('financeiro_pagamentos', 'arquivo_path',      'TEXT')
  addCol('financeiro_pagamentos', 'ativo',             'INTEGER DEFAULT 1')
  // observacao (sem S) — padrão oficial do módulo; tabela original tinha "observacoes" (com S)
  addCol('financeiro_pagamentos', 'observacao',        'TEXT')
  // comprovante — campo auxiliar para referência ao comprovante externo
  addCol('financeiro_pagamentos', 'comprovante',       'TEXT')
  // financeiro_contratos: migrar de observacoes → observacao (padronização)
  // Leitura usa COALESCE(observacao, observacoes); gravação usa apenas observacao
  addCol('financeiro_contratos',  'observacao',        'TEXT')
  // natureza_financeira: CAPEX ou OPEX — obrigatório para novos registros; DEFAULT 'CAPEX' para compatibilidade com registros existentes
  addCol('financeiro_contratos',  'natureza_financeira', "TEXT NOT NULL DEFAULT 'CAPEX'")

  // ─── Enquadramento de lançamentos em contratos ───────────────────────────
  // categoria: critério de matching (ex.: "Aço e Cordoalha"). NULL = contrato sem restrição de categoria.
  addCol('financeiro_contratos',  'categoria', 'TEXT')
  // enquadramento_status: resultado do enquadramento do pagamento a um contrato.
  // NULL = pagamento anterior a esta feature, nunca reavaliado retroativamente.
  // valores: 'AUTOMATICO' | 'AGUARDANDO_ANALISE' | 'SEM_CONTRATO' | 'MANUAL'
  addCol('financeiro_pagamentos', 'enquadramento_status', 'TEXT')
  // contratos_candidatos: JSON com os ids encontrados no momento da avaliação (só relevante quando AGUARDANDO_ANALISE)
  addCol('financeiro_pagamentos', 'contratos_candidatos', 'TEXT')
  // fornecedor: quem emitiu esta NF/pagamento especificamente — necessário para o enquadramento por fornecedor
  // funcionar quando o contrato não pré-existe na tela (fluxo "Lançar NF"). NULL em registros antigos = o
  // fornecedor efetivo daquele lançamento é o `contratado` do contrato já vinculado (nunca havia ambiguidade antes).
  addCol('financeiro_pagamentos', 'fornecedor', 'TEXT')

  // Histórico de enquadramento — append-only, nunca UPDATE/DELETE (mesmo espírito de projeto_historico_alteracoes)
  db.exec(`CREATE TABLE IF NOT EXISTS financeiro_enquadramento_historico (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    pagamento_id         INTEGER NOT NULL,
    projeto_id           INTEGER NOT NULL,
    contrato_id_anterior INTEGER,
    contrato_id_novo     INTEGER,
    tipo_acao            TEXT NOT NULL,
    regra_utilizada      TEXT,
    usuario_id           INTEGER,
    usuario_nome         TEXT,
    created_at           TEXT DEFAULT (datetime('now'))
  )`)

  // Encerramento oficial do projeto — campos gravados ao concluir
  addCol('projetos', 'data_conclusao_real',   'TEXT')
  addCol('projetos', 'hora_conclusao',        'TEXT')
  addCol('projetos', 'responsavel_conclusao', 'TEXT')
  addCol('projetos', 'motivo_conclusao',      'TEXT')
  addCol('projetos', 'checklist_conclusao',   'TEXT')

  // Snapshot final imutável — gerado em concluirProjeto(), jamais alterado
  db.exec(`CREATE TABLE IF NOT EXISTS projeto_snapshot_final (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    projeto_id          INTEGER NOT NULL UNIQUE,
    roi_previsto        REAL,
    roi_atual           REAL,
    capex_previsto      REAL,
    capex_executado     REAL,
    opex_previsto       REAL,
    opex_executado      REAL,
    economia_prevista   REAL,
    economia_realizada  REAL,
    data_fim_prev       TEXT,
    data_conclusao_real TEXT,
    dias_desvio         INTEGER,
    responsavel         TEXT,
    created_at          TEXT DEFAULT (datetime('now'))
  )`)

  // Checklist configurável para encerramento de projetos
  db.exec(`CREATE TABLE IF NOT EXISTS config_checklist_conclusao (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo     TEXT    NOT NULL UNIQUE,
    label      TEXT    NOT NULL,
    obrigatorio INTEGER NOT NULL DEFAULT 0,
    ordem      INTEGER NOT NULL DEFAULT 0,
    ativo      INTEGER NOT NULL DEFAULT 1
  )`)
  db.prepare(`INSERT OR IGNORE INTO config_checklist_conclusao (codigo, label, obrigatorio, ordem) VALUES ('escopo_entregue',      'Escopo entregue',          0, 1)`).run()
  db.prepare(`INSERT OR IGNORE INTO config_checklist_conclusao (codigo, label, obrigatorio, ordem) VALUES ('homologacao',          'Homologação realizada',    0, 2)`).run()
  db.prepare(`INSERT OR IGNORE INTO config_checklist_conclusao (codigo, label, obrigatorio, ordem) VALUES ('documentacao',         'Documentação entregue',    0, 3)`).run()
  db.prepare(`INSERT OR IGNORE INTO config_checklist_conclusao (codigo, label, obrigatorio, ordem) VALUES ('financeiro_encerrado', 'Financeiro encerrado',     0, 4)`).run()
  db.prepare(`INSERT OR IGNORE INTO config_checklist_conclusao (codigo, label, obrigatorio, ordem) VALUES ('cliente_aprovou',      'Cliente aprovou',          0, 5)`).run()

  // Novos status do ciclo de vida pós-execução
  db.prepare(
    `INSERT OR IGNORE INTO config_status_projeto (codigo, label, ordem, is_initial, ativo)
     VALUES ('PROJETO_CONCLUIDO', 'Projeto Concluído', 10, 0, 1)`
  ).run()
  db.prepare(
    `INSERT OR IGNORE INTO config_status_projeto (codigo, label, ordem, is_initial, ativo)
     VALUES ('PAYBACK_ACOMPANHAMENTO', 'Payback em acompanhamento', 11, 0, 1)`
  ).run()
  db.prepare(
    `INSERT OR IGNORE INTO config_status_projeto (codigo, label, ordem, is_initial, ativo)
     VALUES ('PAYBACK_ENCERRADO', 'Payback Encerrado', 12, 0, 1)`
  ).run()
  db.prepare(
    `INSERT OR IGNORE INTO config_status_projeto (codigo, label, ordem, is_initial, ativo)
     VALUES ('PROJETO_ENCERRADO', 'Projeto Encerrado', 13, 0, 1)`
  ).run()

  // ── Módulo Payback ───────────────────────────────────────────────────────────
  db.exec(`CREATE TABLE IF NOT EXISTS payback_competencias (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    projeto_id  INTEGER NOT NULL,
    ano         INTEGER NOT NULL,
    mes         INTEGER NOT NULL,
    receita     REAL    NOT NULL DEFAULT 0,
    economia    REAL    NOT NULL DEFAULT 0,
    capex       REAL    NOT NULL DEFAULT 0,
    opex        REAL    NOT NULL DEFAULT 0,
    fluxo       REAL    NOT NULL DEFAULT 0,
    observacao  TEXT,
    status      TEXT    NOT NULL DEFAULT 'RASCUNHO',
    criado_por  INTEGER,
    created_at  TEXT    DEFAULT (datetime('now')),
    updated_at  TEXT    DEFAULT (datetime('now')),
    UNIQUE(projeto_id, ano, mes)
  )`)

  // ── Migração v3 — Campos de Migração Histórica ──────────────────────────────

  // Tabela de motivos de pausa configuráveis
  db.exec(`CREATE TABLE IF NOT EXISTS config_motivos_pausa (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nome        TEXT    NOT NULL,
    descricao   TEXT,
    ordem       INTEGER NOT NULL DEFAULT 0,
    ativo       INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    DEFAULT (datetime('now')),
    updated_at  TEXT    DEFAULT (datetime('now'))
  )`)

  // Seed inicial de motivos de pausa
  const motivosPausaCount = (db.prepare('SELECT COUNT(*) as c FROM config_motivos_pausa').get() as { c: number }).c
  if (motivosPausaCount === 0) {
    const insMotivo = db.prepare('INSERT INTO config_motivos_pausa (nome, descricao, ordem) VALUES (?, ?, ?)')
    insMotivo.run('Aguardando orçamento', 'Projeto pausado por falta de orçamento aprovado', 1)
    insMotivo.run('Aguardando fornecedor', 'Aguardando proposta ou início de fornecedor contratado', 2)
    insMotivo.run('Aguardando desenvolvimento externo', 'Dependência de sistema ou entrega de terceiros', 3)
    insMotivo.run('Prioridade realocada', 'Recursos redirecionados para projeto de maior prioridade', 4)
    insMotivo.run('Pendência estratégica', 'Decisão estratégica pendente por diretoria/comitê', 5)
  }

  // Campos adicionados na migração histórica dos projetos
  addCol('projetos', 'projeto_migrado',    'INTEGER DEFAULT 0')  // 1 = importado via script — libera edição de artefatos
  addCol('projetos', 'migrado_em',         'TEXT')               // ISO datetime da migração
  addCol('projetos', 'migrado_por',        'INTEGER')            // FK usuarios(id) — responsável pela migração
  addCol('projetos', 'origem_dados',       'TEXT')               // MIGRACAO_EXCEL | MANUAL | API
  addCol('projetos', 'arquivo_origem',     'TEXT')               // nome do arquivo Excel importado
  addCol('projetos', 'motivo_pausa_id',    'INTEGER')            // FK config_motivos_pausa(id)
  addCol('projetos', 'data_pausa',         'TEXT')               // ISO date quando o projeto foi pausado
  addCol('projetos', 'usuario_pausa',      'INTEGER')            // FK usuarios(id) — quem pausou
  addCol('projetos', 'pmo_responsavel_id', 'INTEGER')            // FK usuarios(id) — PMO responsável
  addCol('projetos', 'pmo_responsavel',    'TEXT')               // legado TEXT — mantido por compatibilidade
  addCol('projetos', 'tipo_beneficio',     'TEXT')               // QUALITATIVO | QUANTITATIVO
  addCol('projetos', 'cronograma_pendente', 'INTEGER DEFAULT 0') // legado — não usar; verificar cronogramas tabela

  // Status PAUSADO — projetos com pausa temporária (não cancelados)
  db.prepare(
    `INSERT OR IGNORE INTO config_status_projeto (codigo, label, ordem, is_initial, ativo)
     VALUES ('PAUSADO', 'Pausado', 99, 0, 1)`
  ).run()

  // ── TI – Prioridades de atividades DEV2026 ───────────────────────────────────
  db.exec(`CREATE TABLE IF NOT EXISTS ti_prioridades (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    atividade_id                INTEGER NOT NULL,
    fonte                       TEXT    NOT NULL DEFAULT 'dev2026',
    prioridade                  INTEGER,
    confirmada                  INTEGER NOT NULL DEFAULT 0,
    confirmada_em               TEXT,
    confirmada_por              INTEGER,
    confirmada_por_nome         TEXT,
    confirmada_comite_id        INTEGER,
    solicitacao_alteracao       INTEGER NOT NULL DEFAULT 0,
    solicitacao_por             INTEGER,
    solicitacao_por_nome        TEXT,
    solicitacao_em              TEXT,
    solicitacao_motivo          TEXT,
    solicitacao_nova_prioridade INTEGER,
    workflow_id                 INTEGER,
    created_at                  TEXT DEFAULT (datetime('now')),
    updated_at                  TEXT DEFAULT (datetime('now')),
    UNIQUE(atividade_id, fonte)
  )`)

  // ── Módulo Payback v2 — Leituras periódicas do indicador ─────────────────────
  // Campos de base para cálculo automático (adicionados na viabilidade)
  addCol('viabilidade', 'baseline_valor',         'REAL')            // valor do indicador ANTES do projeto
  addCol('viabilidade', 'meta_valor',             'REAL')            // valor-alvo do indicador após o projeto
  addCol('viabilidade', 'tipo_indicador',         "TEXT DEFAULT 'ABSOLUTO'")  // PERCENTUAL | ABSOLUTO
  addCol('viabilidade', 'economia_mensal_esperada', 'REAL')           // benefício financeiro mensal esperado (R$)

  // TI — vínculo de atividade DEV2026 com projeto cadastrado
  addCol('ti_prioridades', 'projeto_id',     'INTEGER')
  addCol('ti_prioridades', 'projeto_codigo', 'TEXT')
  addCol('ti_prioridades', 'projeto_nome',   'TEXT')

  // Indicador Ganho Tarefa (redução de tempo de atividade)
  addCol('viabilidade', 'ganho_tarefa_ativo',       'INTEGER DEFAULT 0')
  addCol('viabilidade', 'ganho_tarefa_salario',      'REAL')
  addCol('viabilidade', 'ganho_tarefa_horas_antes',  'REAL')
  addCol('viabilidade', 'ganho_tarefa_horas_depois', 'REAL')
  addCol('viabilidade', 'ganho_tarefa_freq_mensal',  "REAL DEFAULT 1")
  // Indicador HC (redução de Headcount)
  addCol('viabilidade', 'hc_ativo',                 'INTEGER DEFAULT 0')
  addCol('viabilidade', 'hc_quantidade',             "INTEGER DEFAULT 1")
  addCol('viabilidade', 'hc_salario_mensal',         'REAL')
  addCol('viabilidade', 'hc_encargos_pct',           'REAL')
  addCol('viabilidade', 'hc_beneficios_mensais',     'REAL')
  addCol('viabilidade', 'hc_outros_mensais',         'REAL')

  // Horas de analistas MegaG — custo de desenvolvimento interno
  addCol('viabilidade', 'horas_analistas_ativo', 'INTEGER DEFAULT 0')
  addCol('viabilidade', 'horas_analistas_json',  'TEXT')
  addCol('viabilidade', 'horas_analistas_total', 'REAL')

  // Leituras reais do indicador mês a mês (substitui entrada manual na planilha)
  db.exec(`CREATE TABLE IF NOT EXISTS payback_registros (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    projeto_id  INTEGER NOT NULL,
    data        TEXT    NOT NULL,    -- YYYY-MM-DD (competência)
    valor_real  REAL    NOT NULL,    -- valor medido do indicador neste período
    origem      TEXT    NOT NULL DEFAULT 'manual',  -- manual | importacao | integracao
    observacao  TEXT,
    criado_por  INTEGER,
    created_at  TEXT DEFAULT (datetime('now'))
  )`)

  // ── Payback v3 — Lançamentos periódicos de investimento e benefício ──────────
  db.exec(`CREATE TABLE IF NOT EXISTS payback_lancamentos (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    projeto_id            INTEGER NOT NULL REFERENCES projetos(id),
    competencia           TEXT NOT NULL,
    data_lancamento       TEXT NOT NULL,
    investimento_periodo  REAL NOT NULL DEFAULT 0,
    beneficio_periodo     REAL NOT NULL DEFAULT 0,
    tipo_beneficio        TEXT,
    observacao            TEXT,
    usuario_id            INTEGER REFERENCES usuarios(id),
    usuario_nome          TEXT,
    created_at            TEXT DEFAULT (datetime('now')),
    updated_at            TEXT DEFAULT (datetime('now'))
  )`)
  addCol('payback_lancamentos', 'tipo_beneficio', 'TEXT')

  // ── Comitês — colunas adicionais ─────────────────────────────────────────────
  addCol('comites', 'hora', 'TEXT')
  addCol('comites', 'periodo_inicio', 'TEXT')
  addCol('comites', 'periodo_fim', 'TEXT')
  addCol('comites', 'descricao', 'TEXT')
  addCol('comites', 'resumo_executivo_ia', 'TEXT')
  addCol('comites', 'resumo_executivo_ia_json', 'TEXT')
  addCol('comites', 'resumo_ia_gerado_em', 'TEXT')
  addCol('comites', 'diretorias_ids', 'TEXT')
  addCol('comites', 'observacoes', 'TEXT')
  addCol('comite_participantes', 'confirmado', 'INTEGER DEFAULT 0')
  addCol('comite_projetos', 'ordem_pauta', 'INTEGER DEFAULT 0')
  addCol('comite_projetos', 'tempo_previsto', 'INTEGER')  // minutos

  // ── Comitê — Decisões ────────────────────────────────────────────────────────
  db.exec(`CREATE TABLE IF NOT EXISTS comite_decisoes (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    comite_id        INTEGER NOT NULL REFERENCES comites(id),
    projeto_id       INTEGER REFERENCES projetos(id),
    tipo             TEXT NOT NULL DEFAULT 'PENDENTE',
    descricao        TEXT NOT NULL,
    responsavel_nome TEXT,
    prazo            TEXT,
    status           TEXT DEFAULT 'PENDENTE',
    created_by       INTEGER NOT NULL REFERENCES usuarios(id),
    created_at       TEXT DEFAULT (datetime('now')),
    updated_at       TEXT DEFAULT (datetime('now'))
  )`)

  // ── Comitê — Pendências ──────────────────────────────────────────────────────
  db.exec(`CREATE TABLE IF NOT EXISTS comite_pendencias (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    comite_id        INTEGER NOT NULL REFERENCES comites(id),
    projeto_id       INTEGER REFERENCES projetos(id),
    descricao        TEXT NOT NULL,
    responsavel_nome TEXT,
    prazo            TEXT,
    status           TEXT DEFAULT 'ABERTA',
    created_by       INTEGER NOT NULL REFERENCES usuarios(id),
    created_at       TEXT DEFAULT (datetime('now')),
    resolved_at      TEXT,
    resolved_by      INTEGER REFERENCES usuarios(id)
  )`)

  // ── Comitê — Ata ─────────────────────────────────────────────────────────────
  db.exec(`CREATE TABLE IF NOT EXISTS comite_ata (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    comite_id       INTEGER NOT NULL UNIQUE REFERENCES comites(id),
    transcricao     TEXT,
    conteudo        TEXT,
    conteudo_json   TEXT,
    versao          INTEGER DEFAULT 1,
    gerado_por_ia   INTEGER DEFAULT 0,
    status          TEXT DEFAULT 'RASCUNHO',
    hora_inicio     TEXT,
    hora_fim        TEXT,
    duracao_min     INTEGER,
    created_by      INTEGER NOT NULL REFERENCES usuarios(id),
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
  )`)
  addCol('comite_ata', 'transcricao', 'TEXT')
  addCol('comite_ata', 'conteudo_json', 'TEXT')
  addCol('comite_ata', 'status', "TEXT DEFAULT 'RASCUNHO'")
  addCol('comite_ata', 'hora_inicio', 'TEXT')
  addCol('comite_ata', 'hora_fim', 'TEXT')
  addCol('comite_ata', 'duracao_min', 'INTEGER')

  // ── Comitê — Histórico da Ata (auditoria) ────────────────────────────────────
  db.exec(`CREATE TABLE IF NOT EXISTS comite_ata_historico (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    comite_id      INTEGER NOT NULL REFERENCES comites(id),
    ata_id         INTEGER NOT NULL REFERENCES comite_ata(id),
    versao         INTEGER NOT NULL,
    conteudo_snap  TEXT,
    acao           TEXT NOT NULL,
    usuario_id     INTEGER NOT NULL REFERENCES usuarios(id),
    usuario_nome   TEXT,
    created_at     TEXT DEFAULT (datetime('now'))
  )`)

  // ── Cronograma — Múltiplos Responsáveis (N:N) ────────────────────────────────
  db.exec(`CREATE TABLE IF NOT EXISTS cronograma_responsaveis (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    cronograma_tarefa_id INTEGER NOT NULL,
    usuario_id           INTEGER,
    usuario_nome_ext     TEXT,
    created_at           TEXT DEFAULT (datetime('now'))
  )`)

  // Cronograma — Linha de Base: datas originais antes de reprogramação
  addCol('cronograma_tarefas', 'data_fim_baseline', 'TEXT')
  addCol('cronograma_tarefas', 'data_inicio_baseline', 'TEXT')

  // Data limite do TAP — campo de controle no cabeçalho do TAP
  addCol('tap_versoes', 'data_limite_tap', 'TEXT')

  // Prazos das Macro Fases — baseline (data original bloqueada) + histórico de reprogramações
  addCol('projeto_fase_prazo', 'data_baseline', 'TEXT')
  db.exec(`CREATE TABLE IF NOT EXISTS projeto_fase_prazo_historico (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    projeto_id    INTEGER NOT NULL REFERENCES projetos(id),
    status        TEXT    NOT NULL,
    data_anterior TEXT    NOT NULL,
    nova_data     TEXT    NOT NULL,
    justificativa TEXT    NOT NULL,
    usuario_id    INTEGER REFERENCES usuarios(id),
    usuario_nome  TEXT,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  // Histórico de projeções de CAPEX do Estudo de Viabilidade
  db.exec(`CREATE TABLE IF NOT EXISTS viabilidade_capex_projecoes (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    viabilidade_id INTEGER NOT NULL REFERENCES viabilidade(id),
    projeto_id     INTEGER NOT NULL REFERENCES projetos(id),
    periodo_ref    TEXT    NOT NULL,
    valor          REAL    NOT NULL,
    descricao      TEXT    NOT NULL,
    usuario_id     INTEGER REFERENCES usuarios(id),
    usuario_nome   TEXT,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  // Prazos das Macro Fases — data limite por fase por projeto
  db.exec(`CREATE TABLE IF NOT EXISTS projeto_fase_prazo (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    projeto_id  INTEGER NOT NULL REFERENCES projetos(id),
    status      TEXT    NOT NULL,
    data_limite TEXT,
    usuario_id  INTEGER REFERENCES usuarios(id),
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(projeto_id, status)
  )`)

  // ─── Cronograma — Tarefa de Pagamento (parcelas) ────────────────────────────
  // Único toque em cronograma_tarefas: `tipo` já tem outro significado (config_cronograma_tipos),
  // então a natureza da tarefa (normal vs. controle de parcelas) precisa de coluna própria.
  addCol('cronograma_tarefas', 'natureza_tarefa', "TEXT DEFAULT 'NORMAL'")  // 'NORMAL' | 'PAGAMENTO'

  db.exec(`CREATE TABLE IF NOT EXISTS cronograma_tarefa_pagamento (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    cronograma_tarefa_id    INTEGER NOT NULL UNIQUE REFERENCES cronograma_tarefas(id),
    beneficiario            TEXT,
    valor_total             REAL NOT NULL,
    qtd_parcelas            INTEGER NOT NULL,
    periodicidade           TEXT NOT NULL DEFAULT 'MENSAL',
    data_primeira_parcela   TEXT NOT NULL,
    financeiro_pagamento_id INTEGER,
    criado_por              INTEGER REFERENCES usuarios(id),
    created_at              DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  db.exec(`CREATE TABLE IF NOT EXISTS cronograma_tarefa_parcelas (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    cronograma_tarefa_id     INTEGER NOT NULL REFERENCES cronograma_tarefas(id),
    numero                   INTEGER NOT NULL,
    valor                    REAL NOT NULL,
    data_vencimento          TEXT NOT NULL,
    data_vencimento_baseline TEXT,
    status                   TEXT NOT NULL DEFAULT 'PENDENTE',
    data_pagamento           TEXT,
    pago_por                 INTEGER REFERENCES usuarios(id),
    financeiro_pagamento_id  INTEGER,
    created_at               DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at               DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  // ─── Financeiro — Projeção de pagamentos do contrato ────────────────────────
  // Só "quanto está previsto pagar em qual mês" — nunca é pagamento real. A comparação
  // projetado×realizado (futura) cruza `competencia` com financeiro_pagamentos.competencia.
  addCol('financeiro_contratos', 'tipo_projecao', "TEXT DEFAULT 'NENHUMA'")  // 'NENHUMA' | 'PARCELADO'

  db.exec(`CREATE TABLE IF NOT EXISTS financeiro_contrato_projecao_parcelas (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    contrato_id     INTEGER NOT NULL REFERENCES financeiro_contratos(id),
    numero          INTEGER NOT NULL,
    competencia     TEXT NOT NULL,
    valor_projetado REAL NOT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  db.exec(`CREATE TABLE IF NOT EXISTS cronograma_tarefa_parcelas_historico (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    parcela_id           INTEGER NOT NULL REFERENCES cronograma_tarefa_parcelas(id),
    cronograma_tarefa_id INTEGER NOT NULL REFERENCES cronograma_tarefas(id),
    projeto_id           INTEGER NOT NULL REFERENCES projetos(id),
    campo                TEXT NOT NULL,
    valor_anterior       TEXT,
    valor_novo           TEXT,
    justificativa        TEXT,
    usuario_id           INTEGER REFERENCES usuarios(id),
    usuario_nome         TEXT,
    created_at           DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  // ─── Cronograma — Arquivamento de versões antigas ───────────────────────────
  // Dedicado (não reaproveita cronogramas.ativo/deleted_at, que já existem mas nunca são
  // escritos — servem a um soft-delete futuro diferente). Arquivar só tira a versão da
  // lista padrão do seletor; nenhum dado de tarefa/pagamento/aprovação é tocado.
  addCol('cronogramas', 'arquivado', 'INTEGER DEFAULT 0')
  addCol('cronogramas', 'arquivado_por', 'INTEGER REFERENCES usuarios(id)')
  addCol('cronogramas', 'arquivado_em', 'TEXT')

  // Seed: popula config_status_projeto com os status padrão se ainda estiver vazio
  const count = (db.prepare('SELECT COUNT(*) as c FROM config_status_projeto').get() as { c: number }).c
  if (count === 0) {
    const statusPadrao = [
      { codigo: 'PROPOSTA',          label: 'Proposta / Ideia',        ordem: 1,  is_initial: 1 },
      { codigo: 'TRIAGEM',           label: 'Triagem / TAP Inicial',   ordem: 2,  is_initial: 0 },
      { codigo: 'COMITE_IDEIAS',     label: 'Comitê de Projetos',      ordem: 3,  is_initial: 0 },
      { codigo: 'VIABILIDADE',       label: 'Estudo de Viabilidade',   ordem: 4,  is_initial: 0 },
      { codigo: 'COMPLEMENTACAO_TAP',label: 'Complementação TAP',      ordem: 5,  is_initial: 0 },
      { codigo: 'APROVACAO',         label: 'Fluxo de Aprovação',      ordem: 6,  is_initial: 0 },
      { codigo: 'ESTRUTURACAO',      label: 'Estruturação',            ordem: 7,  is_initial: 0 },
      { codigo: 'CRONOGRAMA',        label: 'Cronograma Oficial',      ordem: 8,  is_initial: 0 },
      { codigo: 'EXECUCAO',          label: 'Execução',                ordem: 9,  is_initial: 0 },
      { codigo: 'GOLIVE',            label: 'Go Live',                 ordem: 10, is_initial: 0 },
      { codigo: 'ROI',               label: 'Acompanhamento ROI',      ordem: 11, is_initial: 0 },
      { codigo: 'ENCERRAMENTO',      label: 'Encerramento',            ordem: 12, is_initial: 0 },
      { codigo: 'CANCELADO',         label: 'Cancelado',               ordem: 13, is_initial: 0 },
      { codigo: 'SUSPENSO',          label: 'Suspenso',                ordem: 14, is_initial: 0 },
    ]
    const ins = db.prepare(
      'INSERT INTO config_status_projeto (codigo, label, ordem, is_initial) VALUES (?, ?, ?, ?)'
    )
    for (const s of statusPadrao) {
      ins.run(s.codigo, s.label, s.ordem, s.is_initial)
    }
  }
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
