# ============================================================
# MegaG PMO — Dockerfile
# Estratégia multi-stage: deps → builder → runner
#
# Stage 1 (deps):    instala todas as dependências npm,
#                    incluindo compilação de módulos nativos
#                    (better-sqlite3 requer python3/make/g++)
# Stage 2 (builder): copia deps + código-fonte, executa next build
# Stage 3 (runner):  imagem enxuta de produção — apenas
#                    node_modules + artefatos .next + public
# ============================================================

# ── Stage 1: deps ────────────────────────────────────────────
FROM node:20-alpine AS deps

# Ferramentas necessárias para compilar módulos nativos (better-sqlite3)
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

# Copiar somente manifesto de dependências para maximizar cache de camadas.
# Esta camada só é recompilada quando package.json ou package-lock.json mudam.
COPY package.json package-lock.json ./
RUN npm ci


# ── Stage 2: builder ─────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Reutilizar node_modules já compilados do stage anterior
COPY --from=deps /app/node_modules ./node_modules

# Copiar código-fonte
COPY . .

# JWT_SECRET precisa existir para que lib/config/env.ts não lance erro
# durante o build. Este valor placeholder NÃO é usado em produção —
# o container recebe o valor real via variável de ambiente em runtime.
ARG JWT_SECRET=build-placeholder-not-used-at-runtime
ENV JWT_SECRET=$JWT_SECRET

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build


# ── Stage 3: runner ──────────────────────────────────────────
FROM node:20-alpine AS runner

# libc6-compat: necessário para módulos nativos (better-sqlite3) em Alpine
# wget: usado pelo HEALTHCHECK
RUN apk add --no-cache libc6-compat wget

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Usuário não-root para segurança
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Criar diretórios persistidos antes de trocar de usuário
RUN mkdir -p /app/data /app/public/uploads

# Artefatos de produção
COPY --from=deps    --chown=nextjs:nodejs /app/node_modules     ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next            ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public           ./public
COPY --chown=nextjs:nodejs package.json   ./
COPY --chown=nextjs:nodejs next.config.ts ./

# Garantir permissão de escrita nos diretórios de dados
RUN chown -R nextjs:nodejs /app/data /app/public/uploads

USER nextjs

EXPOSE 3000

# Aguarda até 60s para o Next.js inicializar antes de verificar saúde
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:3000/login > /dev/null || exit 1

CMD ["npm", "start"]
