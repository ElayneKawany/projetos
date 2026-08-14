-- ============================================================
-- SCHEMA PMO MEGAG ALIMENTOS
-- Preparado para futura migração Oracle
-- Nunca excluir registros: usar flags deleted_at / ativo
-- ============================================================

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- ============================================================
-- CONFIGURAÇÕES GLOBAIS
-- ============================================================
CREATE TABLE IF NOT EXISTS config_global (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  chave       TEXT NOT NULL UNIQUE,
  valor       TEXT NOT NULL,
  descricao   TEXT,
  updated_by  INTEGER,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- DIRETORIAS E ÁREAS
-- ============================================================
CREATE TABLE IF NOT EXISTS diretorias (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo      TEXT NOT NULL UNIQUE,
  nome        TEXT NOT NULL,
  sigla       TEXT NOT NULL,
  ativo       INTEGER NOT NULL DEFAULT 1,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS areas (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  diretoria_id INTEGER NOT NULL REFERENCES diretorias(id),
  codigo       TEXT NOT NULL UNIQUE,
  nome         TEXT NOT NULL,
  sigla        TEXT NOT NULL,
  ativo        INTEGER NOT NULL DEFAULT 1,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- USUÁRIOS E PERFIS
-- ============================================================
CREATE TABLE IF NOT EXISTS perfis (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo      TEXT NOT NULL UNIQUE,  -- ADMIN, PMO, DIRETOR, GESTOR, SOLICITANTE, CEO
  nome        TEXT NOT NULL,
  descricao   TEXT,
  permissoes  TEXT NOT NULL DEFAULT '{}',  -- JSON de permissões
  ativo       INTEGER NOT NULL DEFAULT 1,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usuarios (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  cpf          TEXT NOT NULL UNIQUE,
  nome         TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE,
  senha_hash   TEXT NOT NULL,
  cargo        TEXT,
  diretoria_id INTEGER REFERENCES diretorias(id),
  area_id      INTEGER REFERENCES areas(id),
  perfil_id    INTEGER NOT NULL REFERENCES perfis(id),
  ativo        INTEGER NOT NULL DEFAULT 1,
  ultimo_login DATETIME,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessoes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id),
  token       TEXT NOT NULL UNIQUE,
  ip          TEXT,
  user_agent  TEXT,
  expires_at  DATETIME NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- PROJETOS
-- ============================================================
CREATE TABLE IF NOT EXISTS projetos (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo            TEXT NOT NULL UNIQUE,   -- PRJ-2026-0001
  nome              TEXT NOT NULL,
  solicitante_id    INTEGER NOT NULL REFERENCES usuarios(id),
  diretoria_id      INTEGER NOT NULL REFERENCES diretorias(id),
  area_id           INTEGER NOT NULL REFERENCES areas(id),
  ponto_focal       TEXT,
  contato           TEXT,
  objetivo          TEXT NOT NULL,
  descricao         TEXT,
  beneficios        TEXT,
  status            TEXT NOT NULL DEFAULT 'PROPOSTA',
  -- PROPOSTA | TRIAGEM | COMITE_IDEIAS | VIABILIDADE | COMPLEMENTACAO_TAP
  -- APROVACAO | ESTRUTURACAO | CRONOGRAMA | EXECUCAO | GOLIVE | ROI | ENCERRAMENTO
  -- CANCELADO | SUSPENSO
  classificacao     TEXT,  -- PROJETO | MELHORIA_CONTINUA
  complexidade      TEXT,  -- BAIXA | MEDIA | ALTA
  prioridade        TEXT DEFAULT 'MEDIA',  -- BAIXA | MEDIA | ALTA
  gerente_id        INTEGER REFERENCES usuarios(id),
  capex_aprovado    REAL DEFAULT 0,
  opex_aprovado     REAL DEFAULT 0,
  data_inicio_prev  DATE,
  data_fim_prev     DATE,
  data_golive       DATE,
  ativo             INTEGER NOT NULL DEFAULT 1,
  created_by        INTEGER NOT NULL REFERENCES usuarios(id),
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Prazo por macro fase do projeto
CREATE TABLE IF NOT EXISTS projeto_fase_prazo (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  projeto_id  INTEGER NOT NULL REFERENCES projetos(id),
  status      TEXT    NOT NULL,
  data_limite TEXT,
  usuario_id  INTEGER REFERENCES usuarios(id),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(projeto_id, status)
);

-- Histórico de status do projeto
CREATE TABLE IF NOT EXISTS projeto_status_historico (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  projeto_id  INTEGER NOT NULL REFERENCES projetos(id),
  status_de   TEXT NOT NULL,
  status_para TEXT NOT NULL,
  motivo      TEXT,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Histórico de prioridade do projeto
CREATE TABLE IF NOT EXISTS projeto_prioridade_historico (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  projeto_id     INTEGER NOT NULL REFERENCES projetos(id),
  prioridade_de  TEXT NOT NULL,
  prioridade_para TEXT NOT NULL,
  motivo         TEXT,
  usuario_id     INTEGER NOT NULL REFERENCES usuarios(id),
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Áreas participantes do projeto
CREATE TABLE IF NOT EXISTS projeto_areas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  projeto_id  INTEGER NOT NULL REFERENCES projetos(id),
  area_id     INTEGER NOT NULL REFERENCES areas(id),
  responsavel_id INTEGER REFERENCES usuarios(id),
  papel       TEXT,
  ativo       INTEGER NOT NULL DEFAULT 1,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TAP EVOLUTIVO (versionado, nunca sobrescrever)
-- ============================================================
CREATE TABLE IF NOT EXISTS tap_versoes (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  projeto_id            INTEGER NOT NULL REFERENCES projetos(id),
  versao                INTEGER NOT NULL,   -- 1, 2, 3 ...
  label                 TEXT NOT NULL,      -- "TAP V1", "TAP V2"
  fase_origem           TEXT NOT NULL,      -- TRIAGEM | VIABILIDADE | COMPLEMENTACAO
  -- Triagem
  escopo_inicial        TEXT,
  escopo_fora           TEXT,
  beneficios_tap        TEXT,
  areas_impactadas      TEXT,               -- JSON array
  -- Complementação
  objetivo_detalhado    TEXT,
  descricao_solucao     TEXT,
  premissas             TEXT,
  restricoes            TEXT,
  riscos_iniciais       TEXT,
  -- Viabilidade
  investimento_total    REAL,
  roi_previsto          REAL,
  vpl                   REAL,
  tir                   REAL,
  payback_meses         REAL,
  -- Metadados
  criado_por            INTEGER NOT NULL REFERENCES usuarios(id),
  aprovado_por          INTEGER REFERENCES usuarios(id),
  aprovado_em           DATETIME,
  status                TEXT DEFAULT 'RASCUNHO',   -- RASCUNHO | APROVADO
  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TRIAGEM
-- ============================================================
CREATE TABLE IF NOT EXISTS triagens (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  projeto_id        INTEGER NOT NULL UNIQUE REFERENCES projetos(id),
  escopo_inicial    TEXT,
  escopo_fora       TEXT,
  beneficios        TEXT,
  areas_impactadas  TEXT,  -- JSON array de area_id
  classificacao     TEXT,  -- PROJETO | MELHORIA_CONTINUA
  complexidade      TEXT,  -- BAIXA | MEDIA | ALTA
  prioridade        TEXT,  -- BAIXA | MEDIA | ALTA
  observacoes       TEXT,
  responsavel_id    INTEGER REFERENCES usuarios(id),
  concluida         INTEGER DEFAULT 0,
  created_by        INTEGER NOT NULL REFERENCES usuarios(id),
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- COMITÊS
-- ============================================================
CREATE TABLE IF NOT EXISTS comites (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo          TEXT NOT NULL,
  tipo            TEXT NOT NULL DEFAULT 'IDEIAS',  -- IDEIAS | APROVACAO | REVISAO
  data_realizacao DATETIME NOT NULL,
  local           TEXT,
  pauta           TEXT,
  decisao_geral   TEXT,
  status          TEXT DEFAULT 'AGENDADO',  -- AGENDADO | REALIZADO | CANCELADO
  created_by      INTEGER NOT NULL REFERENCES usuarios(id),
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comite_participantes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  comite_id    INTEGER NOT NULL REFERENCES comites(id),
  usuario_id   INTEGER REFERENCES usuarios(id),
  nome_externo TEXT,  -- participante sem cadastro
  cargo        TEXT,
  presente     INTEGER DEFAULT 0,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comite_projetos (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  comite_id            INTEGER NOT NULL REFERENCES comites(id),
  projeto_id           INTEGER NOT NULL REFERENCES projetos(id),
  pauta_item           TEXT,
  decisao              TEXT,  -- APROVADO | REPROVADO | PENDENTE | REVISAR
  observacoes          TEXT,
  -- Snapshot na data do comitê
  snap_prioridade      TEXT,
  snap_complexidade    TEXT,
  snap_investimento    REAL,
  snap_roi             REAL,
  snap_payback         REAL,
  created_at           DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comite_documentos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  comite_id   INTEGER NOT NULL REFERENCES comites(id),
  nome        TEXT NOT NULL,
  caminho     TEXT NOT NULL,
  tipo        TEXT,
  created_by  INTEGER NOT NULL REFERENCES usuarios(id),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- ESTUDO DE VIABILIDADE
-- ============================================================
CREATE TABLE IF NOT EXISTS viabilidade (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  projeto_id            INTEGER NOT NULL REFERENCES projetos(id),
  versao                INTEGER NOT NULL DEFAULT 1,
  -- ABA: FINANCEIRO
  selic                 REAL,
  taxa_desconto         REAL,
  inflacao              REAL,
  investimento_total    REAL,
  receitas_previstas    TEXT,   -- JSON: [{ano, valor}]
  custos_previstos      TEXT,   -- JSON: [{ano, valor}]
  economia_prevista     TEXT,   -- JSON: [{ano, valor}]
  roi                   REAL,
  vpl                   REAL,
  tir                   REAL,
  payback_meses         REAL,
  -- ABA: OPERACIONAL
  impacto_operacional   TEXT,
  recursos_necessarios  TEXT,
  mudanca_processo      TEXT,
  -- ABA: TÉCNICO
  tecnologias           TEXT,
  integrações           TEXT,
  infraestrutura        TEXT,
  -- ABA: RISCOS
  riscos                TEXT,   -- JSON: [{descricao, probabilidade, impacto, mitigacao}]
  -- ABA: IMPACTOS
  impactos              TEXT,   -- JSON: [{area, tipo, descricao}]
  -- ABA: CRONOGRAMA PRELIMINAR
  data_inicio_prev      DATE,
  data_fim_prev         DATE,
  marcos                TEXT,   -- JSON: [{descricao, data}]
  -- Metadados
  status                TEXT DEFAULT 'RASCUNHO',
  criado_por            INTEGER NOT NULL REFERENCES usuarios(id),
  aprovado_por          INTEGER REFERENCES usuarios(id),
  aprovado_em           DATETIME,
  created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- FINANCEIRO - CAPEX / OPEX
-- ============================================================
CREATE TABLE IF NOT EXISTS financeiro_lancamentos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  projeto_id      INTEGER NOT NULL REFERENCES projetos(id),
  tipo            TEXT NOT NULL,         -- CAPEX | OPEX
  categoria       TEXT NOT NULL,         -- NF | CONTRATO | COMPROVANTE | OUTRO
  descricao       TEXT NOT NULL,
  fornecedor      TEXT,
  numero_doc      TEXT,                  -- Nº NF / contrato
  valor           REAL NOT NULL,
  data_lancamento DATE NOT NULL,
  competencia     TEXT,                  -- YYYY-MM
  observacoes     TEXT,
  arquivo_path    TEXT,
  criado_por      INTEGER NOT NULL REFERENCES usuarios(id),
  aprovado_por    INTEGER REFERENCES usuarios(id),
  aprovado_em     DATETIME,
  status          TEXT DEFAULT 'PENDENTE',  -- PENDENTE | APROVADO | REJEITADO
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Acompanhamento ROI realizado
CREATE TABLE IF NOT EXISTS roi_acompanhamento (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  projeto_id      INTEGER NOT NULL REFERENCES projetos(id),
  competencia     TEXT NOT NULL,    -- YYYY-MM
  receita_real    REAL DEFAULT 0,
  custo_real      REAL DEFAULT 0,
  economia_real   REAL DEFAULT 0,
  observacoes     TEXT,
  criado_por      INTEGER NOT NULL REFERENCES usuarios(id),
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- ESTRUTURAÇÃO
-- ============================================================
CREATE TABLE IF NOT EXISTS estruturacao (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  projeto_id        INTEGER NOT NULL UNIQUE REFERENCES projetos(id),
  gerente_id        INTEGER REFERENCES usuarios(id),
  patrocinador_id   INTEGER REFERENCES usuarios(id),
  metodologia       TEXT,
  escopo_detalhado  TEXT,
  entregas          TEXT,         -- JSON array
  observacoes       TEXT,
  concluida         INTEGER DEFAULT 0,
  created_by        INTEGER NOT NULL REFERENCES usuarios(id),
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- CRONOGRAMA (estilo MS Project)
-- ============================================================
CREATE TABLE IF NOT EXISTS cronogramas (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  projeto_id      INTEGER NOT NULL REFERENCES projetos(id),
  versao          INTEGER NOT NULL DEFAULT 1,
  label           TEXT NOT NULL,   -- "Baseline" | "Replanejamento V2"
  is_baseline     INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'ATIVO',   -- ATIVO | HISTORICO
  motivo_replano  TEXT,
  fonte_importacao TEXT DEFAULT 'MANUAL',  -- MANUAL | EXCEL
  arquivo_origem  TEXT,
  aprovado_por    INTEGER REFERENCES usuarios(id),
  aprovado_em     DATETIME,
  criado_por      INTEGER NOT NULL REFERENCES usuarios(id),
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cronograma_tarefas (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  cronograma_id   INTEGER NOT NULL REFERENCES cronogramas(id),
  parent_id       INTEGER REFERENCES cronograma_tarefas(id),  -- macro/micro
  nivel           INTEGER DEFAULT 1,      -- 1=macro, 2=micro
  ordem           INTEGER DEFAULT 0,
  codigo          TEXT,                   -- WBS: 1, 1.1, 1.2, 2...
  nome            TEXT NOT NULL,
  responsavel_id  INTEGER REFERENCES usuarios(id),
  data_inicio     DATE,
  data_fim        DATE,
  duracao_dias    INTEGER,
  dependencias    TEXT,                   -- JSON: [tarefa_id, ...]
  percentual      INTEGER DEFAULT 0,      -- 0-100
  bloqueio        INTEGER DEFAULT 0,
  motivo_bloqueio TEXT,
  status          TEXT DEFAULT 'NAO_INICIADA',
  -- NAO_INICIADA | EM_ANDAMENTO | CONCLUIDA | ATRASADA | BLOQUEADA
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- EXECUÇÃO - ATUALIZAÇÕES
-- ============================================================
CREATE TABLE IF NOT EXISTS execucao_atualizacoes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  projeto_id      INTEGER NOT NULL REFERENCES projetos(id),
  tarefa_id       INTEGER REFERENCES cronograma_tarefas(id),
  tipo            TEXT NOT NULL,   -- PROGRESSO | EVIDENCIA | COMENTARIO | BLOQUEIO
  descricao       TEXT NOT NULL,
  percentual      INTEGER,
  criado_por      INTEGER NOT NULL REFERENCES usuarios(id),
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS execucao_arquivos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  atualizacao_id  INTEGER NOT NULL REFERENCES execucao_atualizacoes(id),
  nome            TEXT NOT NULL,
  caminho         TEXT NOT NULL,
  tipo_mime       TEXT,
  tamanho_bytes   INTEGER,
  criado_por      INTEGER NOT NULL REFERENCES usuarios(id),
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- NOTIFICAÇÕES
-- ============================================================
CREATE TABLE IF NOT EXISTS notificacoes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id      INTEGER NOT NULL REFERENCES usuarios(id),
  projeto_id      INTEGER REFERENCES projetos(id),
  tipo            TEXT NOT NULL,   -- VENCIMENTO_30D | VENCIMENTO_15D | VENCIMENTO_7D | ATRASO | APROVACAO
  titulo          TEXT NOT NULL,
  mensagem        TEXT NOT NULL,
  lida            INTEGER DEFAULT 0,
  lida_em         DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- APROVAÇÕES
-- ============================================================
CREATE TABLE IF NOT EXISTS aprovacoes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  projeto_id      INTEGER NOT NULL REFERENCES projetos(id),
  tipo            TEXT NOT NULL,
  -- TAP | VIABILIDADE | CRONOGRAMA | LANCAMENTO | ENCERRAMENTO | DOCUMENTO
  referencia_id   INTEGER,          -- ID do item a aprovar
  referencia_tipo TEXT,             -- nome da tabela
  status          TEXT DEFAULT 'PENDENTE',   -- PENDENTE | APROVADO | REJEITADO
  solicitante_id  INTEGER NOT NULL REFERENCES usuarios(id),
  aprovador_id    INTEGER REFERENCES usuarios(id),
  observacao_req  TEXT,
  observacao_apr  TEXT,
  aprovado_em     DATETIME,
  prazo           DATE,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- GESTÃO DOCUMENTAL
-- ============================================================
CREATE TABLE IF NOT EXISTS documentos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  projeto_id      INTEGER REFERENCES projetos(id),  -- NULL = doc corporativo
  tipo            TEXT NOT NULL,
  -- TAP | ESTUDO | ATA | ONE_PAGE | COMITE | ENCERRAMENTO
  -- POLITICA | PROCEDIMENTO | IT | RELATORIO
  titulo          TEXT NOT NULL,
  descricao       TEXT,
  versao          INTEGER NOT NULL DEFAULT 1,
  status          TEXT DEFAULT 'RASCUNHO',
  -- RASCUNHO | EM_APROVACAO | APROVADO | PUBLICADO | OBSOLETO
  gerado_auto     INTEGER DEFAULT 0,   -- 1 = gerado pelo sistema
  caminho         TEXT,                -- PDF gerado
  conteudo_json   TEXT,                -- dados estruturados
  criado_por      INTEGER NOT NULL REFERENCES usuarios(id),
  aprovado_por    INTEGER REFERENCES usuarios(id),
  aprovado_em     DATETIME,
  publicado_em    DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Versões anteriores (nunca sobrescrever)
CREATE TABLE IF NOT EXISTS documentos_versoes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  documento_id   INTEGER NOT NULL REFERENCES documentos(id),
  versao         INTEGER NOT NULL,
  status         TEXT,
  caminho        TEXT,
  conteudo_json  TEXT,
  criado_por     INTEGER NOT NULL REFERENCES usuarios(id),
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- ENCERRAMENTO
-- ============================================================
CREATE TABLE IF NOT EXISTS encerramentos (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  projeto_id           INTEGER NOT NULL UNIQUE REFERENCES projetos(id),
  licoes_aprendidas    TEXT,
  roi_previsto         REAL,
  roi_realizado        REAL,
  payback_previsto     REAL,
  payback_realizado    REAL,
  capex_previsto       REAL,
  capex_realizado      REAL,
  opex_previsto        REAL,
  opex_realizado       REAL,
  economia_prevista    REAL,
  economia_realizada   REAL,
  avaliacao_geral      TEXT,
  recomendacoes        TEXT,
  criado_por           INTEGER NOT NULL REFERENCES usuarios(id),
  aprovado_por         INTEGER REFERENCES usuarios(id),
  aprovado_em          DATETIME,
  created_at           DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- AUDITORIA (imutável)
-- ============================================================
CREATE TABLE IF NOT EXISTS auditoria (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id      INTEGER REFERENCES usuarios(id),
  usuario_nome    TEXT,            -- snapshot do nome
  acao            TEXT NOT NULL,
  -- CREATE | UPDATE | DELETE_SOFT | APPROVE | REJECT | LOGIN | LOGOUT
  -- UPLOAD | STATUS_CHANGE | PRIORITY_CHANGE | VERSIONING
  entidade        TEXT NOT NULL,   -- nome da tabela
  entidade_id     INTEGER,
  projeto_id      INTEGER REFERENCES projetos(id),
  descricao       TEXT NOT NULL,
  dados_antes     TEXT,            -- JSON snapshot antes
  dados_depois    TEXT,            -- JSON snapshot depois
  ip              TEXT,
  user_agent      TEXT,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- APROVADORES CONFIGURÁVEIS POR TIPO DE DOCUMENTO
-- ============================================================
CREATE TABLE IF NOT EXISTS documento_aprovadores (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo_documento TEXT NOT NULL,
  -- TAP | VIABILIDADE | CRONOGRAMA | LANCAMENTO | ENCERRAMENTO
  usuario_id     INTEGER NOT NULL REFERENCES usuarios(id),
  ordem          INTEGER DEFAULT 1,
  obrigatorio    INTEGER DEFAULT 1,
  ativo          INTEGER DEFAULT 1,
  created_by     INTEGER REFERENCES usuarios(id),
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- ANEXOS DE LANÇAMENTOS FINANCEIROS (NF, contratos, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS financeiro_anexos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  lancamento_id   INTEGER NOT NULL REFERENCES financeiro_lancamentos(id),
  nome            TEXT NOT NULL,
  caminho         TEXT NOT NULL,
  tipo_mime       TEXT,
  tamanho_bytes   INTEGER,
  tipo_anexo      TEXT DEFAULT 'NF',
  -- NF | CONTRATO | COMPROVANTE | OUTRO
  criado_por      INTEGER NOT NULL REFERENCES usuarios(id),
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_projetos_status      ON projetos(status);
CREATE INDEX IF NOT EXISTS idx_projetos_diretoria   ON projetos(diretoria_id);
CREATE INDEX IF NOT EXISTS idx_projetos_gerente     ON projetos(gerente_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_entidade   ON auditoria(entidade, entidade_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_projeto    ON auditoria(projeto_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario    ON auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario ON notificacoes(usuario_id, lida);
CREATE INDEX IF NOT EXISTS idx_aprovacoes_status    ON aprovacoes(status, aprovador_id);
CREATE INDEX IF NOT EXISTS idx_tap_projeto          ON tap_versoes(projeto_id, versao);
CREATE INDEX IF NOT EXISTS idx_cronograma_projeto   ON cronogramas(projeto_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_projeto  ON financeiro_lancamentos(projeto_id, tipo);
CREATE INDEX IF NOT EXISTS idx_doc_aprovadores_tipo ON documento_aprovadores(tipo_documento, ativo);
CREATE INDEX IF NOT EXISTS idx_financeiro_anexos    ON financeiro_anexos(lancamento_id);
