# 🏭 PMO MegaG – Como Executar Localmente

## Pré-requisitos

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **npm 9+** (vem com o Node)

---

## 1. Instalar dependências

Abra o terminal na pasta `megag-pmo` e execute:

```bash
cd megag-pmo
npm install
```

> A instalação pode levar 2–3 minutos na primeira vez.

---

## 2. Popular o banco de dados

Execute o seed para criar as tabelas e os dados iniciais:

```bash
node scripts/seed.js
```

Você verá as credenciais de acesso no terminal.

---

## 3. Iniciar o servidor

```bash
npm run dev
```

Acesse: **http://localhost:3000**

---

## Credenciais de Acesso

| CPF | Senha | Perfil |
|---|---|---|
| 000.000.000-01 | `Megag@2026` | Administrador |
| 000.000.000-02 | `PMO@2026` | PMO |
| 000.000.000-03 | `Megag@2026` | CEO |
| 000.000.000-04 | `Megag@2026` | Diretor |
| 000.000.000-05 | `Megag@2026` | Gestor |
| 000.000.000-06 | `Megag@2026` | Solicitante |

---

## Estrutura de arquivos criados

```
megag-pmo/
├── app/
│   ├── (auth)/login/          ← Tela de login
│   ├── (dashboard)/           ← Módulos autenticados
│   │   ├── dashboard/         ← Dashboard PMO/Executivo
│   │   ├── projetos/          ← Lista + detalhe de projetos
│   │   ├── comites/           ← Comitês
│   │   ├── cronogramas/       ← Cronogramas (Baseline)
│   │   ├── financeiro/        ← CAPEX/OPEX/ROI
│   │   ├── documentos/        ← Gestão documental
│   │   ├── aprovacoes/        ← Fluxo de aprovação
│   │   ├── auditoria/         ← Trilha de auditoria
│   │   └── configuracoes/     ← Usuários, diretorias, premissas
│   └── api/                   ← APIs REST
├── components/layout/          ← Sidebar + Header MegaG
├── lib/
│   ├── auth.ts                 ← JWT + sessão
│   ├── projetos.ts             ← Lógica de projetos
│   ├── financeiro.ts           ← ROI, VPL, TIR, Payback
│   └── db/                     ← SQLite + schema + auditoria
├── scripts/seed.js             ← Dados iniciais
├── types/index.ts              ← Todos os tipos TypeScript
└── data/megag-pmo.db           ← Banco gerado automaticamente
```

---

## Regras de negócio implementadas

- ✅ ID automático de projetos: `PRJ-2026-NNNN`
- ✅ Ciclo de vida completo (12 fases)
- ✅ TAP evolutivo com versionamento (nunca sobrescreve)
- ✅ Histórico completo de status e prioridade
- ✅ CAPEX/OPEX com saldo automático
- ✅ Cálculo automático: ROI, VPL, TIR, Payback
- ✅ Auditoria imutável em toda alteração
- ✅ Controle por perfil (Admin, PMO, Diretor, Gestor, Solicitante, CEO)
- ✅ Design system MegaG (azul institucional + dourado executivo)
- ✅ Middleware de autenticação em todas as rotas
- ✅ Arquitetura preparada para migração Oracle

---

## Para deploy em servidor interno

1. Altere `NODE_ENV=production` no `.env.local`
2. Troque o `JWT_SECRET` por uma chave segura
3. Execute `npm run build` e depois `npm start`
4. Configure um proxy reverso (Nginx/IIS) para a porta 3000

---

## 4. Importar portfólio de projetos existente

Se você possui um arquivo `Portfolio de projetos.xlsx` com seus projetos atuais,
o sistema já contém o arquivo `scripts/portfolio-data.json` gerado a partir dele.

**⚠️ Pare o servidor** antes de importar (Ctrl+C no terminal do `npm run dev`).

```bash
node scripts/import-portfolio.js
```

Após a importação, reinicie:

```bash
npm run dev
```

> O script ignora projetos já importados (pode ser executado mais de uma vez com segurança).

---

## Próximas evoluções (backlog)

- Cronograma visual tipo Gantt interativo
- Geração automática de PDFs (TAP, Atas, Relatórios)
- Notificações por e-mail
- Upload de arquivos/evidências na execução
- Dashboard de ROI realizado pós Go Live
- Módulo de encerramento com lições aprendidas
- Migração para Oracle Database
