# Manual de Instalação — MegaG PMO

Guia para instalar o sistema em um servidor (produção) e importar o portfólio real de projetos. Complementa `DOCKER.md` (guia detalhado de Docker) e `COMO_EXECUTAR.md` (setup local de desenvolvimento) — este manual é o ponto de entrada único para quem for instalar em servidor.

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Pré-requisitos](#2-pré-requisitos)
3. [Variáveis de ambiente](#3-variáveis-de-ambiente)
4. [Opção A — Instalação via Docker (recomendado)](#4-opção-a--instalação-via-docker-recomendado)
5. [Opção B — Instalação com Node.js direto no servidor](#5-opção-b--instalação-com-nodejs-direto-no-servidor)
6. [Pacote de deploy da aplicação](#6-pacote-de-deploy-da-aplicação)
7. [Pacote de importação — portfólio real de projetos](#7-pacote-de-importação--portfólio-real-de-projetos)
8. [Verificação pós-instalação](#8-verificação-pós-instalação)
9. [Backup e manutenção](#9-backup-e-manutenção)
10. [Solução de problemas](#10-solução-de-problemas)

---

## 1. Visão geral

| Item | Detalhe |
|---|---|
| Stack | Next.js 15 (App Router) · TypeScript · SQLite (`better-sqlite3`) · Tailwind CSS |
| Banco de dados | Arquivo único SQLite em `data/megag-pmo.db` — sem servidor de banco separado |
| Autenticação | JWT em cookie de sessão (`megag_pmo_session`, 8h) |
| Uploads | Arquivos em `public/uploads/` |
| Porta padrão | `3000` (interna — sempre atrás de um proxy reverso HTTPS em produção) |

Existem dois caminhos de instalação, cobertos nas seções 4 e 5:

- **Opção A — Docker**: `Dockerfile` e `docker-compose.yml` já prontos no repositório (multi-stage, usuário não-root, healthcheck). Caminho recomendado por ser reprodutível e isolado do SO do servidor.
- **Opção B — Node.js direto no servidor**: sem container, rodando com `npm start` sob um gerenciador de processo (pm2/systemd no Linux, NSSM/Serviço do Windows no Windows Server) atrás de Nginx ou IIS.

As seções 3 (variáveis de ambiente), 6 (pacote de deploy) e 7 (importação de dados) valem para as duas opções.

## 2. Pré-requisitos

**Comum às duas opções:**

- Acesso ao código-fonte do repositório (Git ou o pacote de deploy da seção 6).
- Uma chave de API Anthropic válida, caso as funcionalidades de IA (geração de ATA, Resumo Executivo IA) sejam usadas — obter em https://console.anthropic.com.
- Proxy reverso com HTTPS na frente da aplicação (Nginx, IIS ou equivalente) — a aplicação em si não faz TLS.

**Opção A — Docker:**

- Docker Engine + Docker Compose v2 (`docker compose version`).

**Opção B — Node.js direto:**

- Node.js **20.x** (mesma versão usada na imagem Docker — `node:20-alpine`) e npm.
- Ferramentas de build nativo para compilar o módulo `better-sqlite3`:
  - Linux (Debian/Ubuntu): `apt-get install -y python3 make g++`
  - Windows Server: Visual Studio Build Tools (workload "Desktop development with C++") ou `npm install --global windows-build-tools` (ambiente antigo) — confirme com `node -e "require('better-sqlite3')"` após o `npm install`.

## 3. Variáveis de ambiente

O arquivo `.env.example` documenta todas as variáveis. No servidor:

```bash
cp .env.example .env.local
```

Preencha `.env.local` com valores reais **direto no servidor** — nunca copie um `.env.local` de outro ambiente nem o inclua no pacote de deploy (ele já é ignorado por `.gitignore`/`.dockerignore`).

| Variável | Obrigatória | Como obter |
|---|---|---|
| `JWT_SECRET` | Sim | Gerar no próprio servidor: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` — mínimo 64 caracteres aleatórios, **diferente por ambiente** (nunca reaproveitar o valor de dev/homologação em produção). |
| `ANTHROPIC_API_KEY` | Sim, para os recursos de IA | Console Anthropic (https://console.anthropic.com → API Keys). |
| `DATABASE_URL` | Não | Caminho do arquivo SQLite. Padrão `./data/megag-pmo.db` — só mude se o volume de dados ficar em outro caminho. |
| `NODE_ENV` | Não | `production` no servidor. |

## 4. Opção A — Instalação via Docker (recomendado)

Guia completo em [`DOCKER.md`](DOCKER.md). Resumo dos passos no servidor:

```bash
git clone <url-do-repositorio> megag-pmo
cd megag-pmo
cp .env.example .env.local
# editar .env.local com os valores reais (seção 3)

mkdir -p data public/uploads
docker compose up --build -d
```

Primeira inicialização do banco (só na primeira vez, container já rodando):

```bash
docker compose exec app node scripts/seed.js
```

Isso cria as tabelas e os 6 usuários de demonstração documentados em `COMO_EXECUTAR.md` — troque as senhas desses usuários (ou crie usuários reais e desative os demo) antes de liberar o acesso, e siga com a importação do portfólio real (seção 7).

## 5. Opção B — Instalação com Node.js direto no servidor

```bash
git clone <url-do-repositorio> megag-pmo
cd megag-pmo
cp .env.example .env.local
# editar .env.local com os valores reais (seção 3)

npm ci --omit=dev
npm run build
node scripts/seed.js
```

### Subir o processo

**Linux — pm2** (mais simples de operar/monitorar):

```bash
npm install --global pm2
pm2 start npm --name megag-pmo -- start
pm2 save
pm2 startup   # gera o comando para iniciar o pm2 junto com o boot do servidor — rode o comando impresso
```

**Linux — systemd** (alternativa sem depender do pm2):

```ini
# /etc/systemd/system/megag-pmo.service
[Unit]
Description=MegaG PMO
After=network.target

[Service]
Type=simple
WorkingDirectory=/caminho/para/megag-pmo
ExecStart=/usr/bin/npm start
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now megag-pmo
```

**Windows Server** — rodar `npm start` como serviço, via NSSM (`nssm install MegaGPMO`, apontando para `node.exe` com argumento `node_modules\.bin\next start`) ou via IIS + [`iisnode`](https://github.com/Azure/iisnode). Escolha conforme a política de infraestrutura já usada na empresa para outras aplicações Node.

### Proxy reverso

A aplicação escuta em `http://localhost:3000` — nunca exponha essa porta diretamente à internet. Configure um proxy reverso com HTTPS:

- **Nginx**: `proxy_pass http://localhost:3000;` com os headers padrão (`X-Forwarded-For`, `X-Forwarded-Proto`, `Host`) e `client_max_body_size` aumentado (o sistema aceita upload de planilhas/documentos nas abas de Cronograma/TAP).
- **IIS**: módulo ARR (Application Request Routing) como reverse proxy para `localhost:3000`.

## 6. Pacote de deploy da aplicação

Para transferir o código para o servidor sem usar `git clone` (ambiente sem acesso direto ao repositório Git), gere um pacote a partir de um checkout limpo do repositório:

```bash
git archive --format=zip -o megag-pmo-deploy.zip HEAD
```

O `git archive` inclui somente os arquivos versionados — `node_modules/`, `.git/`, `data/` e `.env*` já ficam de fora automaticamente, pois nunca são commitados. Isso resulta exatamente no pacote necessário:

1. Copie `megag-pmo-deploy.zip` para o servidor e extraia.
2. Siga a partir de `cp .env.example .env.local` na seção 4 ou 5, conforme a opção de instalação escolhida.

Não é necessário (nem recomendado) empacotar `node_modules` — `npm ci` no servidor garante os binários nativos (`better-sqlite3`) compilados para o SO/arquitetura de destino, o que uma cópia de `node_modules` de outra máquina não garante.

## 7. Pacote de importação — portfólio real de projetos

Depois do `seed.js` (que cria apenas a base vazia + usuários de demonstração), existem dois scripts para trazer dados reais. Ambos exigem o **servidor parado** durante a execução.

### 7.1 Importação do portfólio de projetos

Script: `scripts/import-portfolio.js`. **Atenção: ele substitui completamente a base de projetos** (preserva usuários, perfis, diretorias, áreas e configurações) — é o fluxo de carga inicial, não um import incremental.

```bash
# parar o servidor / container antes de rodar
node scripts/import-portfolio.js "C:\caminho\para\planilha.xlsx"
# ou, sem argumento, usa scripts/projetos-validacao.xlsx como padrão
```

O que o script faz automaticamente:

- Verifica se `data/megag-pmo.db` existe (exige `seed.js` já executado).
- Faz **backup automático** do banco antes de qualquer alteração (`data/backup_<timestamp>.db`).
- Pede confirmação interativa antes de gravar.
- Grava logs em `logs/migracao_projetos_<timestamp>.log` / `.json`.

A planilha de origem precisa ter estas colunas (nomes aceitos entre parênteses, com e sem acento):

| Coluna | Aceita também | Obrigatória |
|---|---|---|
| Projeto | `PROJETO`, `Nome` | Sim |
| Etapa do Funil | `Etapa` | Sim |
| Diretoria | — | Sim |
| Área responsável | `Area` | Sim |
| Descrição | `DESCRIÇÃO`, `Descricao` | Não |
| Objetivo do Projeto | `Objetivo` | Não |
| Prioridade (Alta/Média/Baixa) | — | Não |
| Tipo de Ganho (Qualitativo/Quantitativo) | `Tipo Beneficio` | Não |
| Responsável | `Responsavel` | Não |
| Ponto focal | `Ponto Focal` | Não |
| PMO | — | Não |
| Data fim | `Data Fim`, `Data Prevista` | Não |

Valores de "Etapa do Funil" aceitos: `Proposta / Ideia`, `Estudo de Viabilidade`, `Em Execução`, `Acompanhamento de Payback`, `Pausado` (prefixo numérico do Excel, ex. `"1 - Proposta/Ideia"`, é removido automaticamente).

Reinicie o servidor/container após a importação.

### 7.2 Dados financeiros (histórico específico — avaliar caso a caso)

`scripts/import-financeiro.js` existe no repositório, mas **não é um script genérico de importação**: os valores de CAPEX aprovado/utilizado estão hardcoded no próprio arquivo, extraídos de uma apresentação específica do Comitê de Projetos já usada em uma migração anterior. Não faz parte do pacote padrão de importação para uma instalação nova — só é relevante se o histórico financeiro daquela apresentação específica também precisar ser recarregado. Para dados financeiros de um novo portfólio, use os lançamentos manuais da aba Financeiro de cada projeto.

### 7.3 Scripts que NÃO fazem parte do pacote de importação

A pasta `scripts/` contém outros arquivos auxiliares usados durante o desenvolvimento (prefixo `_`, arquivos `.xlsx` de teste, `validar-importacao-cronograma.js`, `reset-artefatos-importacao.js`, `check-data-fim-prev.js`, `cleanup-seed.js`). Nenhum deles é necessário para uma instalação nova — servem para diagnóstico e correções pontuais já aplicadas ao ambiente de desenvolvimento.

## 8. Verificação pós-instalação

1. Acessar a URL pública configurada no proxy reverso e confirmar que a tela de login carrega.
2. Login com um dos usuários de demonstração (tabela em `COMO_EXECUTAR.md`) ou com um usuário real já importado.
3. Abrir um projeto existente (pós-importação do portfólio) e confirmar que Cronograma, TAP e Financeiro carregam sem erro.
4. Se as funcionalidades de IA forem usadas: gerar uma ATA ou o Resumo Executivo de um Comitê e confirmar que não há erro de `ANTHROPIC_API_KEY`.
5. Docker: `docker compose ps` deve mostrar o healthcheck como `healthy` (baseado em `GET /login`).

## 9. Backup e manutenção

- **Banco de dados**: é um arquivo único (`data/megag-pmo.db`, mais os arquivos `-wal`/`-shm` do modo WAL do SQLite). Backup = copiar os três arquivos com o serviço parado, ou usar `sqlite3 data/megag-pmo.db ".backup data/backup.db"` com o serviço no ar (não bloqueia leitura/escrita).
- **Uploads**: `public/uploads/` — incluir na rotina de backup junto com o banco.
- **Atualização de versão**: `git pull` (ou novo pacote de deploy da seção 6) → `npm ci --omit=dev` → `npm run build` → reiniciar o processo/container. As migrações de schema (`runMigrations()`) rodam automaticamente na primeira conexão ao banco após o restart — não é necessário rodar `seed.js` novamente.
- **Docker**: `docker compose down && docker compose up --build -d` reconstrói a imagem preservando os volumes `./data` e `./public/uploads`.

## 10. Solução de problemas

| Sintoma | Causa provável | Solução |
|---|---|---|
| Build falha compilando `better-sqlite3` | Faltam ferramentas de compilação nativa | Instalar `python3 make g++` (Linux) ou Build Tools (Windows) — seção 2 |
| Login sempre falha, mesmo com senha correta | `JWT_SECRET` diferente do usado ao criar as sessões, ou não definido | Conferir `.env.local`; reiniciar o processo após qualquer mudança nele |
| Funcionalidades de IA retornam erro | `ANTHROPIC_API_KEY` ausente ou inválida | Conferir `.env.local`; testar a chave direto no console Anthropic |
| `import-portfolio.js` recusa rodar | `data/megag-pmo.db` não existe | Rodar `node scripts/seed.js` primeiro |
| Upload de planilha/anexo falha atrás do Nginx | `client_max_body_size` padrão (1MB) do Nginx é menor que o arquivo | Aumentar `client_max_body_size` no `server`/`location` do Nginx |
| Container "unhealthy" no `docker compose ps` | Aplicação não respondeu em `/login` a tempo | `docker compose logs app` para ver o erro real de boot |
