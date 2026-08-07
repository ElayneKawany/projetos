# MegaG PMO — Docker

Guia para execução do sistema via Docker.

---

## Pré-requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e em execução
- Arquivo `.env.local` configurado (copie de `.env.example`)

```bash
cp .env.example .env.local
# Edite .env.local com os valores reais (JWT_SECRET forte, ANTHROPIC_API_KEY)
```

---

## Preparação inicial (executar apenas uma vez)

Crie os diretórios de dados no host antes da primeira execução.
Isso garante que o container (usuário `nextjs`, uid 1001) tenha permissão de escrita,
especialmente em sistemas Linux onde o Docker cria diretórios com owner root.

```bash
mkdir -p data public/uploads
```

> **Por quê?** Os volumes `./data` e `./public/uploads` são bind mounts.
> Se o diretório não existir no host, o Docker o cria como root —
> e o usuário não-root do container (uid 1001) não consegue escrever.
> Criando antes, o diretório fica com o owner do usuário atual do host.

---

## Subir o ambiente

```bash
docker compose up --build
```

A aplicação estará disponível em: **http://localhost:3000**

> Na primeira execução, o banco de dados SQLite é criado automaticamente
> em `./data/megag-pmo.db` com as tabelas e configurações iniciais.

---

## Parar o ambiente

```bash
docker compose down
```

Os dados do banco e uploads são preservados nos diretórios `./data/` e `./public/uploads/`.

---

## Reconstruir a imagem

Use quando houver alterações no código ou dependências:

```bash
docker compose up --build --force-recreate
```

Ou para forçar rebuild sem cache (mais lento, garante imagem limpa):

```bash
docker compose build --no-cache
docker compose up
```

---

## Atualizar dependências

Após alterar `package.json`:

```bash
# No host: atualizar package-lock.json
npm install

# Reconstruir a imagem com as novas dependências
docker compose up --build --force-recreate
```

---

## Inicializar dados de demonstração (seed)

O schema do banco é criado automaticamente ao subir o container.
Para popular com dados de demonstração:

```bash
docker compose exec app node scripts/seed.js
```

> **Nota:** Execute apenas uma vez em ambiente de desenvolvimento.
> Em produção, omita este passo.

---

## Verificar logs

```bash
# Logs em tempo real
docker compose logs -f

# Últimas 100 linhas
docker compose logs --tail=100
```

---

## Dados persistidos

| Diretório no host | Caminho no container | Conteúdo |
|---|---|---|
| `./data/` | `/app/data/` | Banco SQLite (`megag-pmo.db`) |
| `./public/uploads/` | `/app/public/uploads/` | Arquivos enviados pelos usuários |

> Esses diretórios são criados automaticamente pelo Docker na primeira execução.

---

## Informações da imagem

| Item | Valor |
|---|---|
| Base | `node:20-alpine` |
| Estratégia | Multi-stage build (deps → builder → runner) |
| Usuário | `nextjs` (não-root, uid 1001) |
| Porta | 3000 |
| Healthcheck | `GET /login` a cada 30s |
