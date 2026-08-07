# Solicitação Formal de Isencao — Linguagem de Programacao
## Programa IA Champions — Padrao de Desenvolvimento

**Documento:** ISENCAO-NODEJS-2026-001
**Data:** 2026-08-07
**Projeto:** MegaG PMO — Portal Corporativo de Governanca de Projetos
**Solicitante:** PMO MegaG Alimentos
**Contato tecnico:** elayne.leite@megag.com.br
**Status:** Aguardando deliberacao do Comite IA Champions

---

## 1. Contexto do Projeto

### 1.1 Descricao do Sistema

O MegaG PMO e o portal oficial de governanca de projetos da MegaG Alimentos, desenvolvido
para suportar o processo completo do PMO corporativo, desde a concepcao de ideias ate
o encerramento com acompanhamento de payback.

**Stack tecnologica utilizada:**
- Linguagem: TypeScript 5.4
- Runtime: Node.js 20 LTS
- Framework: Next.js 15 (App Router)
- Banco de dados: SQLite (better-sqlite3) — com migracao para PostgreSQL planejada
- Autenticacao: JWT via `jose` com cookies HttpOnly
- ORM: Drizzle ORM (schema definido, migrations gerenciadas)

### 1.2 Porte e Complexidade

O sistema compreende:
- 98+ endpoints REST distribuidos em 37 paginas
- Fluxos de workflow de aprovacao multi-etapa
- Geracao de documentos (DOCX, XLSX, PPTX, PDF)
- Integracao com Claude AI (Anthropic) para resumos executivos e atas
- Modulos: Projetos, TAP, Viabilidade, Cronograma, Financeiro, Orcamento,
  Comites, Payback, Aprovacoes, Usuarios, Configuracoes, Auditoria
- Sistema em producao com dados reais do PMO corporativo

### 1.3 Motivo da Solicitacao de Isencao

O Padrao de Desenvolvimento IA Champions define Python como a linguagem oficial. O MegaG PMO
foi concebido e desenvolvido integralmente em Node.js/TypeScript, por razoes tecnicas
detalhadas nas secoes seguintes. A reescrita em Python nao e tecnicamente viavel sem risco
operacional significativo ao PMO.

---

## 2. Justificativa Tecnica

### 2.1 Por que Node.js/TypeScript foi a escolha correta

O projeto e um portal web fullstack com forte acoplamento entre camada de servidor e
interface de usuario. As seguintes caracteristicas determinaram a escolha:

**a) Next.js 15 App Router com Server Components**

A arquitetura utiliza Server Components do React, que permitem buscar dados diretamente
do banco na camada de renderizacao sem expor APIs publicas intermediarias. Este modelo
nao tem equivalente no ecossistema Python sem aumentar significativamente a complexidade
arquitetural (dois repositorios, contratos de API entre frontend React e backend Python,
latencia adicional de rede interna).

**b) TypeScript compartilhado entre servidor e cliente**

Os tipos definidos em `types/index.ts` sao compartilhados automaticamente entre API routes,
Server Components e componentes React. Em uma arquitetura Python + React, o contrato de
tipos teria que ser replicado ou gerado via OpenAPI, introduzindo possibilidade de
divergencia.

**c) Geracao de documentos corporativos**

O sistema gera DOCX (via `docx`), XLSX (via `xlsx`), PPTX (via `pptxgenjs`) e PDF (via
`jspdf`). Estas bibliotecas Node.js estao maduras, amplamente utilizadas em producao e
com suporte ativo. As equivalentes Python (python-docx, openpyxl, python-pptx) existem
mas o ecossistema de geracao de PPTX programatica em Python e consideravelmente menos
robusto.

**d) Integracao com Claude AI**

O SDK oficial `@anthropic-ai/sdk` para Node.js tem paridade completa de recursos com o
SDK Python. O streaming de respostas da IA — utilizado nas funcionalidades de geracao
de resumo executivo e ata de comites — e nativamente suportado em ambos os SDKs.

### 2.2 Inviabilidade de Reescrita

Reescrever o projeto em Python implicaria:
- Reconstrucao de 98+ endpoints REST
- Reconstrucao de 37 paginas com Server Components React
- Remocao do beneficio de Server Components (SSR/SSG nativo)
- Periodo de indisponibilidade ou funcionamento paralelo de dois sistemas
- Risco de regressao em funcionalidades criticas de producao
- Estimativa de esforco: 3 a 4 meses de desenvolvimento dedicado
- Custo de opportunity: paralisacao de novas funcionalidades durante a migracao

---

## 3. Beneficios do Node.js/TypeScript Neste Projeto

### 3.1 Fullstack Unificado

A escolha de Node.js/TypeScript permite manter toda a aplicacao — servidor, banco de
dados e interface — em um unico repositorio com uma unica linguagem. Isso resulta em:

- Reducao de overhead operacional (um unico pipeline de CI/CD)
- Deploys atomicos (servidor e cliente sempre em sincronia)
- Tipos compartilhados sem geracao de codigo ou contratos externos
- Uma unica base de conhecimento para o time de manutencao
- Reducao de surface area de bugs por incompatibilidade de contratos

### 3.2 Produtividade

O ecossistema Node.js/TypeScript oferece produtividade comprovada para portais de
gestao corporativa:

- Hot Module Replacement (HMR) durante o desenvolvimento
- IntelliSense completo em toda a codebase (servidor + cliente)
- Componentes React reutilizaveis entre paginas sem adaptacoes
- Validacao de formularios com `react-hook-form` + `zod` integrada ao mesmo
  sistema de tipos das APIs
- Tailwind CSS com classes customizadas do design system definidas em
  `tailwind.config.ts` e `app/globals.css`

### 3.3 Ecossistema

O ecossistema npm oferece bibliotecas maduras e mantidas ativamente para todos os
requisitos do projeto:

| Necessidade | Biblioteca | Status |
|---|---|---|
| ORM | Drizzle ORM | Ativo, TypeScript-first |
| JWT | `jose` | Padrão IETF, auditado |
| Logging estruturado | `pino` | Equivalente ao `structlog` Python |
| Geracao DOCX | `docx` | 200k downloads/semana |
| Geracao XLSX | `xlsx` | 5M downloads/semana |
| Geracao PDF | `jspdf` | Amplamente adotado |
| Claude AI | `@anthropic-ai/sdk` | Mantido pela Anthropic |
| Validacao | `zod` | TypeScript-first, 10M downloads/semana |
| Testes | `jest` + `ts-jest` | Equivalente ao `pytest` |

---

## 4. Riscos Avaliados

### 4.1 Risco: Nao conformidade com o Padrao IA Champions

**Probabilidade:** Alta (concretizado — item reprovado na auditoria)
**Impacto:** Medio — o projeto opera corretamente, mas nao e formalmente conforme
**Mitigacao:** Esta solicitacao de isencao e o plano de adequacao documentado em
`.ai/conformidade-megag.md`

### 4.2 Risco: Suporte e manutencao futura

**Probabilidade:** Baixa
**Impacto:** Medio
**Analise:** Node.js 20 e uma versao LTS com suporte ate abril de 2026 (ativa) e
manutencao de seguranca ate abril de 2028. Next.js e mantido pela Vercel com releases
regulares e retrocompatibilidade garantida. TypeScript e mantido pela Microsoft.
Nao ha risco de abandono dos principais componentes da stack.

### 4.3 Risco: Migracao para PostgreSQL

**Probabilidade:** Alta (necessidade prevista)
**Impacto:** Medio-Alto
**Mitigacao:** Auditoria tecnica concluida (`.ai/audit.json`, Item 4). Interface
assincrona `AsyncDatabaseClient` preparada. ORM Drizzle instalado com schema definido.
Plano de migracao em 3 sprints documentado no Roadmap.

### 4.4 Risco: Cobertura de testes insuficiente

**Probabilidade:** Media
**Impacto:** Medio
**Analise:** Suite atual: 35 testes unitarios (Jest). Meta definida: cobertura > 80%.
**Mitigacao:** Expansao progressiva da suite de testes como item prioritario no backlog
tecnico.

### 4.5 Risco: Divergencia futura com o Padrao

**Probabilidade:** Baixa (mediante isencao formal)
**Impacto:** Baixo
**Mitigacao:** Com a isencao formalizada, o projeto deixa de ser avaliado contra o
criterio de linguagem e passa a ser avaliado somente pelos demais 12 criterios, nos
quais esta em conformidade.

---

## 5. Declaracao Formal de Solicitacao de Isencao

O PMO da MegaG Alimentos solicita formalmente ao **Comite IA Champions** a concessao
de isencao permanente do requisito de linguagem Python para o projeto MegaG PMO,
com base nos seguintes fundamentos:

**I.** O projeto MegaG PMO e um sistema fullstack em producao, desenvolvido integralmente
em Node.js/TypeScript com Next.js 15, atendendo a um requisito tecnico legitimo de
unificacao da codebase de servidor e cliente.

**II.** A reescrita em Python nao e tecnicamente viavel sem risco operacional significativo,
estimada em 3 a 4 meses de esforco com interrupcao ou bifurcacao do sistema atual.

**III.** O projeto atende ao espirito do Padrao IA Champions em 12 das 13 categorias
avaliadas (score: 92% excluindo o criterio de linguagem), demonstrando aderencia
ao padrão de qualidade em todas as demais dimensoes.

**IV.** A stack Node.js/TypeScript oferece equivalentes diretos para todos os requisitos
do Padrao: tipagem estatica (TypeScript equiv. Python+mypy), testes (Jest equiv. pytest),
logging (pino equiv. structlog), ORM (Drizzle), CI/CD, Docker, OpenAPI, JWT e IaC.

**V.** O plano de conformidade completa esta documentado, com prazo estimado e responsaveis
definidos para os itens pendentes (ORM Drizzle em uso, PostgreSQL em roadmap).

---

## 6. Assinaturas

| Papel | Nome | Data |
|---|---|---|
| Solicitante (PMO MegaG) | | |
| Gestor de TI / CTO | | |
| Deliberacao do Comite IA Champions | | |
| Numero do Protocolo | ISENCAO-NODEJS-2026-001 | |

---

*Documento tecnico — MegaG PMO — `.ai/isencao-nodejs.md` — 2026-08-07*
