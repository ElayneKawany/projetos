/**
 * SEED INICIAL – PMO MegaG
 * Executa: node scripts/seed.js
 */
const Database = require('better-sqlite3')
const bcrypt = require('bcryptjs')
const path = require('path')
const fs = require('fs')

const DB_PATH = path.join(__dirname, '..', 'data', 'megag-pmo.db')
const SCHEMA_PATH = path.join(__dirname, '..', 'lib', 'db', 'schema.sql')

// Garantir diretório
if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
}

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// Aplicar schema
const schema = fs.readFileSync(SCHEMA_PATH, 'utf8')
db.exec(schema)

console.log('🌱 Iniciando seed...')

// ── Perfis ─────────────────────────────────────────────────
const perfis = [
  { id:1, codigo:'ADMIN',       nome:'Administrador',  descricao:'Acesso total ao sistema', permissoes:'{}' },
  { id:2, codigo:'PMO',         nome:'PMO',             descricao:'Gestão completa de projetos', permissoes:'{}' },
  { id:3, codigo:'DIRETOR',     nome:'Diretor',         descricao:'Projetos da sua diretoria', permissoes:'{}' },
  { id:4, codigo:'GESTOR',      nome:'Gestor',          descricao:'Projetos sob sua responsabilidade', permissoes:'{}' },
  { id:5, codigo:'SOLICITANTE', nome:'Solicitante',     descricao:'Cadastro e acompanhamento', permissoes:'{}' },
  { id:6, codigo:'CEO',         nome:'CEO',             descricao:'Aprovação executiva', permissoes:'{}' },
]
const insertPerfil = db.prepare(`
  INSERT OR IGNORE INTO perfis (id, codigo, nome, descricao, permissoes) VALUES (@id, @codigo, @nome, @descricao, @permissoes)
`)
perfis.forEach(p => insertPerfil.run(p))
console.log('✓ Perfis criados')

// ── Diretorias ──────────────────────────────────────────────
const diretorias = [
  { id:1, codigo:'DIR-OPERACOES',  nome:'Diretoria de Operações',       sigla:'DO'  },
  { id:2, codigo:'DIR-COMERCIAL',  nome:'Diretoria Comercial',           sigla:'DC'  },
  { id:3, codigo:'DIR-FINANCEIRO', nome:'Diretoria Financeira',          sigla:'DF'  },
  { id:4, codigo:'DIR-TI',         nome:'Diretoria de Tecnologia',       sigla:'DTI' },
  { id:5, codigo:'DIR-RH',         nome:'Diretoria de Pessoas',          sigla:'DRH' },
  { id:6, codigo:'DIR-SUPRIMENTOS',nome:'Diretoria de Suprimentos',      sigla:'DS'  },
]
const insertDir = db.prepare(`
  INSERT OR IGNORE INTO diretorias (id, codigo, nome, sigla) VALUES (@id, @codigo, @nome, @sigla)
`)
diretorias.forEach(d => insertDir.run(d))
console.log('✓ Diretorias criadas')

// ── Áreas ───────────────────────────────────────────────────
const areas = [
  { id:1,  diretoria_id:1, codigo:'AREA-PRODUCAO',    nome:'Produção',              sigla:'PROD'  },
  { id:2,  diretoria_id:1, codigo:'AREA-LOGISTICA',   nome:'Logística',             sigla:'LOG'   },
  { id:3,  diretoria_id:1, codigo:'AREA-QUALIDADE',   nome:'Qualidade',             sigla:'QUAL'  },
  { id:4,  diretoria_id:2, codigo:'AREA-VENDAS',      nome:'Vendas',                sigla:'VND'   },
  { id:5,  diretoria_id:2, codigo:'AREA-MARKETING',   nome:'Marketing',             sigla:'MKT'   },
  { id:6,  diretoria_id:3, codigo:'AREA-CONTROLADORIA',nome:'Controladoria',        sigla:'CTRL'  },
  { id:7,  diretoria_id:3, codigo:'AREA-TESOURARIA',  nome:'Tesouraria',            sigla:'TES'   },
  { id:8,  diretoria_id:4, codigo:'AREA-SISTEMAS',    nome:'Sistemas',              sigla:'SIS'   },
  { id:9,  diretoria_id:4, codigo:'AREA-INFRA',       nome:'Infraestrutura',        sigla:'INFRA' },
  { id:10, diretoria_id:5, codigo:'AREA-DP',          nome:'Dept. Pessoal',         sigla:'DP'    },
  { id:11, diretoria_id:6, codigo:'AREA-COMPRAS',     nome:'Compras',               sigla:'CMP'   },
]
const insertArea = db.prepare(`
  INSERT OR IGNORE INTO areas (id, diretoria_id, codigo, nome, sigla) VALUES (@id, @diretoria_id, @codigo, @nome, @sigla)
`)
areas.forEach(a => insertArea.run(a))
console.log('✓ Áreas criadas')

// ── Usuários ────────────────────────────────────────────────
const senhaHash = bcrypt.hashSync('Megag@2026', 12)
const senhaHash2 = bcrypt.hashSync('PMO@2026', 12)

const usuarios = [
  {
    id:1, cpf:'00000000001', nome:'Administrador PMO', email:'admin@megag.com.br',
    senha_hash: senhaHash, cargo:'Administrador do Sistema',
    diretoria_id:null, area_id:null, perfil_id:1,
  },
  {
    id:2, cpf:'00000000002', nome:'Ana Paula Ferreira', email:'ana.ferreira@megag.com.br',
    senha_hash: senhaHash2, cargo:'Coordenadora PMO',
    diretoria_id:1, area_id:1, perfil_id:2,
  },
  {
    id:3, cpf:'00000000003', nome:'Carlos Eduardo Silva', email:'carlos.silva@megag.com.br',
    senha_hash: senhaHash, cargo:'CEO',
    diretoria_id:null, area_id:null, perfil_id:6,
  },
  {
    id:4, cpf:'00000000004', nome:'Marcos Oliveira', email:'marcos.oliveira@megag.com.br',
    senha_hash: senhaHash, cargo:'Diretor de Operações',
    diretoria_id:1, area_id:null, perfil_id:3,
  },
  {
    id:5, cpf:'00000000005', nome:'Fernanda Costa', email:'fernanda.costa@megag.com.br',
    senha_hash: senhaHash, cargo:'Gerente de Projetos',
    diretoria_id:1, area_id:1, perfil_id:4,
  },
  {
    id:6, cpf:'00000000006', nome:'Roberto Mendes', email:'roberto.mendes@megag.com.br',
    senha_hash: senhaHash, cargo:'Analista de TI',
    diretoria_id:4, area_id:8, perfil_id:5,
  },
]
const insertUser = db.prepare(`
  INSERT OR IGNORE INTO usuarios (id, cpf, nome, email, senha_hash, cargo, diretoria_id, area_id, perfil_id)
  VALUES (@id, @cpf, @nome, @email, @senha_hash, @cargo, @diretoria_id, @area_id, @perfil_id)
`)
usuarios.forEach(u => insertUser.run(u))
console.log('✓ Usuários criados')

// ── Configurações Financeiras ───────────────────────────────
const configs = [
  { chave:'selic',          valor:'10.75', descricao:'Taxa SELIC atual (% ao ano)' },
  { chave:'taxa_desconto',  valor:'12.00', descricao:'Taxa de desconto para VPL (% ao ano)' },
  { chave:'inflacao',       valor:'4.50',  descricao:'Projeção de inflação (IPCA % ao ano)' },
]
const insertConfig = db.prepare(`
  INSERT OR IGNORE INTO config_global (chave, valor, descricao) VALUES (@chave, @valor, @descricao)
`)
configs.forEach(c => insertConfig.run(c))
console.log('✓ Configurações financeiras criadas')

// ── Projetos de exemplo ─────────────────────────────────────
const projetos = [
  {
    codigo:'PRJ-2026-0001', nome:'Modernização do ERP MegaG',
    solicitante_id:5, diretoria_id:4, area_id:8,
    ponto_focal:'Roberto Mendes', contato:'roberto.mendes@megag.com.br',
    objetivo:'Migrar o sistema ERP atual para uma plataforma moderna baseada em nuvem, melhorando a integração entre setores.',
    descricao:'Projeto de transformação digital do core de gestão da empresa.',
    beneficios:'Redução de 40% no tempo de processamento, integração em tempo real, eliminação de planilhas paralelas.',
    status:'EXECUCAO', classificacao:'PROJETO', complexidade:'ALTA', prioridade:'ALTA',
    gerente_id:5, capex_aprovado:850000, opex_aprovado:120000,
    data_inicio_prev:'2026-02-01', data_fim_prev:'2026-11-30',
    created_by:2,
  },
  {
    codigo:'PRJ-2026-0002', nome:'Automação da Linha de Produção B',
    solicitante_id:4, diretoria_id:1, area_id:1,
    ponto_focal:'Marcos Oliveira', contato:'marcos.oliveira@megag.com.br',
    objetivo:'Automatizar os processos manuais da linha de produção B para aumentar a capacidade produtiva em 35%.',
    descricao:'Instalação de robótica e sistemas de controle na linha B da fábrica.',
    beneficios:'Aumento de capacidade, redução de custos com mão de obra, menor índice de erros.',
    status:'VIABILIDADE', classificacao:'PROJETO', complexidade:'ALTA', prioridade:'ALTA',
    gerente_id:null, capex_aprovado:1200000, opex_aprovado:80000,
    data_inicio_prev:'2026-05-01', data_fim_prev:'2026-12-31',
    created_by:2,
  },
  {
    codigo:'PRJ-2026-0003', nome:'Programa de Fidelidade B2B',
    solicitante_id:5, diretoria_id:2, area_id:4,
    ponto_focal:'Fernanda Costa', contato:'fernanda.costa@megag.com.br',
    objetivo:'Criar um programa de fidelidade para distribuidores B2B com pontuação e benefícios progressivos.',
    descricao:'Plataforma digital de relacionamento com distribuidores.',
    beneficios:'Aumento de 15% na retenção de distribuidores, incremento de 8% no ticket médio.',
    status:'APROVACAO', classificacao:'PROJETO', complexidade:'MEDIA', prioridade:'MEDIA',
    gerente_id:5, capex_aprovado:250000, opex_aprovado:60000,
    data_inicio_prev:'2026-04-01', data_fim_prev:'2026-09-30',
    created_by:2,
  },
  {
    codigo:'PRJ-2026-0004', nome:'Melhoria no Processo de Inventário',
    solicitante_id:6, diretoria_id:6, area_id:11,
    ponto_focal:'Roberto Mendes', contato:'roberto.mendes@megag.com.br',
    objetivo:'Digitalizar e automatizar o processo de inventário utilizando RFID.',
    descricao:'Substituição do inventário manual por sistema de rastreamento RFID.',
    beneficios:'Redução de 80% no tempo de inventário, acuracidade de 99,8%.',
    status:'TRIAGEM', classificacao:'PROJETO', complexidade:'MEDIA', prioridade:'BAIXA',
    gerente_id:null, capex_aprovado:180000, opex_aprovado:24000,
    data_inicio_prev:'2026-07-01', data_fim_prev:'2026-12-31',
    created_by:6,
  },
  {
    codigo:'PRJ-2026-0005', nome:'Portal RH Self-Service',
    solicitante_id:5, diretoria_id:5, area_id:10,
    ponto_focal:'Fernanda Costa', contato:'fernanda.costa@megag.com.br',
    objetivo:'Criar um portal de autoatendimento para colaboradores acessarem contracheques, férias e documentos.',
    descricao:'Portal digital de RH integrado ao sistema de folha.',
    beneficios:'Redução de 60% nas solicitações ao DP, maior autonomia dos colaboradores.',
    status:'PROPOSTA', classificacao:'PROJETO', complexidade:'BAIXA', prioridade:'MEDIA',
    gerente_id:null, capex_aprovado:0, opex_aprovado:0,
    data_inicio_prev:null, data_fim_prev:null,
    created_by:5,
  },
]

const insertProj = db.prepare(`
  INSERT OR IGNORE INTO projetos
    (codigo, nome, solicitante_id, diretoria_id, area_id, ponto_focal, contato, objetivo,
     descricao, beneficios, status, classificacao, complexidade, prioridade, gerente_id,
     capex_aprovado, opex_aprovado, data_inicio_prev, data_fim_prev, created_by)
  VALUES
    (@codigo, @nome, @solicitante_id, @diretoria_id, @area_id, @ponto_focal, @contato, @objetivo,
     @descricao, @beneficios, @status, @classificacao, @complexidade, @prioridade, @gerente_id,
     @capex_aprovado, @opex_aprovado, @data_inicio_prev, @data_fim_prev, @created_by)
`)
projetos.forEach(p => insertProj.run(p))
console.log('✓ Projetos de exemplo criados')

// ── Comitê de exemplo ───────────────────────────────────────
db.prepare(`
  INSERT OR IGNORE INTO comites (id, titulo, tipo, data_realizacao, local, status, created_by)
  VALUES (1, 'Comitê de Ideias – Q2 2026', 'IDEIAS', '2026-07-10 14:00:00', 'Sala de Reuniões Principal', 'AGENDADO', 2)
`).run()

db.prepare(`
  INSERT OR IGNORE INTO comite_projetos (comite_id, projeto_id, pauta_item, snap_prioridade, snap_complexidade)
  VALUES (1, 4, 'Avaliação inicial do projeto de inventário RFID', 'BAIXA', 'MEDIA')
`).run()
console.log('✓ Comitê de exemplo criado')

// ── TAP versão para projetos avançados ─────────────────────
const tapProjeto1 = db.prepare(`SELECT id FROM projetos WHERE codigo='PRJ-2026-0001'`).get()
if (tapProjeto1) {
  db.prepare(`
    INSERT OR IGNORE INTO tap_versoes
      (projeto_id, versao, label, fase_origem, escopo_inicial, beneficios_tap,
       investimento_total, roi_previsto, vpl, tir, payback_meses, status, criado_por)
    VALUES
      (${tapProjeto1.id}, 1, 'TAP V1', 'TRIAGEM',
       'Migração completa do ERP para plataforma cloud com integração de todos os módulos.',
       'Aumento de produtividade, eliminação de retrabalho, integração em tempo real.',
       970000, 145.3, 823000, 28.4, 18, 'APROVADO', 2)
  `).run()
}

// ── Lançamentos financeiros de exemplo ─────────────────────
const proj1 = db.prepare(`SELECT id FROM projetos WHERE codigo='PRJ-2026-0001'`).get()
if (proj1) {
  const lancamentos = [
    { tipo:'CAPEX', categoria:'CONTRATO', descricao:'Contrato licença ERP Cloud', fornecedor:'SAP Brasil', numero_doc:'CONT-2026-001', valor:450000, data_lancamento:'2026-02-15', status:'APROVADO' },
    { tipo:'CAPEX', categoria:'NF',       descricao:'Servidores e infraestrutura',  fornecedor:'Dell Technologies', numero_doc:'NF-45823', valor:180000, data_lancamento:'2026-03-01', status:'APROVADO' },
    { tipo:'OPEX',  categoria:'NF',       descricao:'Consultoria implementação Q1', fornecedor:'Accenture Brasil', numero_doc:'NF-89234', valor:35000,  data_lancamento:'2026-03-31', status:'APROVADO' },
    { tipo:'OPEX',  categoria:'NF',       descricao:'Treinamento equipe',           fornecedor:'Treinamentos Tech', numero_doc:'NF-12345', valor:22000,  data_lancamento:'2026-04-15', status:'PENDENTE' },
  ]
  const insertLanc = db.prepare(`
    INSERT OR IGNORE INTO financeiro_lancamentos
      (projeto_id, tipo, categoria, descricao, fornecedor, numero_doc, valor, data_lancamento, criado_por, status)
    VALUES
      (${proj1.id}, @tipo, @categoria, @descricao, @fornecedor, @numero_doc, @valor, @data_lancamento, 2, @status)
  `)
  lancamentos.forEach(l => insertLanc.run(l))
}
console.log('✓ Lançamentos financeiros criados')

// ── Aprovação pendente de exemplo ───────────────────────────
const proj3 = db.prepare(`SELECT id FROM projetos WHERE codigo='PRJ-2026-0003'`).get()
if (proj3) {
  db.prepare(`
    INSERT OR IGNORE INTO aprovacoes (id, projeto_id, tipo, status, solicitante_id, aprovador_id, observacao_req, prazo)
    VALUES (1, ${proj3.id}, 'TAP', 'PENDENTE', 5, 3, 'TAP V1 finalizado aguardando aprovação executiva.', '2026-07-15')
  `).run()
}
console.log('✓ Aprovações de exemplo criadas')

// ── Auditoria inicial ───────────────────────────────────────
db.prepare(`
  INSERT INTO auditoria (usuario_id, usuario_nome, acao, entidade, descricao)
  VALUES (1, 'Administrador PMO', 'CREATE', 'sistema', 'Seed inicial do sistema PMO MegaG executado com sucesso.')
`).run()

console.log('\n✅ Seed concluído com sucesso!')
console.log('\n📋 CREDENCIAIS DE ACESSO:')
console.log('┌─────────────────────────────────────────────────────────┐')
console.log('│ CPF             │ Senha         │ Perfil                │')
console.log('├─────────────────────────────────────────────────────────┤')
console.log('│ 000.000.000-01  │ Megag@2026    │ Administrador         │')
console.log('│ 000.000.000-02  │ PMO@2026      │ PMO                   │')
console.log('│ 000.000.000-03  │ Megag@2026    │ CEO                   │')
console.log('│ 000.000.000-04  │ Megag@2026    │ Diretor               │')
console.log('│ 000.000.000-05  │ Megag@2026    │ Gestor                │')
console.log('│ 000.000.000-06  │ Megag@2026    │ Solicitante           │')
console.log('└─────────────────────────────────────────────────────────┘')

db.close()
