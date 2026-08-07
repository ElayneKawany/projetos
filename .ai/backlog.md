# Backlog Técnico — Melhorias Identificadas

Itens identificados durante auditorias e sprints que ficaram fora do escopo imediato.
Nenhum destes itens é bloqueante — registrados para priorização futura.

---

## Docker — Melhorias Opcionais

### 1. Separar dependências de produção das de desenvolvimento

**Benefício:** Reduz `node_modules` no runner removendo `typescript`, `eslint`, `@types/*`, `tailwindcss`, `autoprefixer`, `postcss` (~150 MB estimados).

**Como implementar:**
- Adicionar stage `deps-prod` com `npm ci --omit=dev`
- Manter stage `deps-dev` (com devDeps) para o builder
- Runner copia de `deps-prod`

**Impacto:** Nenhum na aplicação. Redução significativa do tamanho da imagem final.

---

### 2. Habilitar `output: 'standalone'` no Next.js

**Benefício:** Imagem final ~70% menor — apenas o bundle otimizado, sem `node_modules` completo.

**Como implementar:**
```ts
// next.config.ts
const nextConfig: NextConfig = {
  output: 'standalone',
  ...
}
```
Runner passaria a usar `CMD ["node", "server.js"]` ao invés de `npm start`.

**Impacto:** Nenhum no comportamento da aplicação. Requer alterar `next.config.ts`.

---

### 3. Consolidar RUN layers no runner stage

**Benefício:** Imagem mais limpa, menos camadas intermediárias.

**Como implementar:** Unificar os 4 `RUN` do runner em 2:
```dockerfile
RUN apk add --no-cache libc6-compat wget && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    mkdir -p /app/data /app/public/uploads
```

---

### 4. Usar `CMD node` diretamente ao invés de `npm start`

**Benefício:** Elimina o processo intermediário `npm`; Node.js recebe sinais de OS (SIGTERM) corretamente sem wrapper.

**Como implementar:**
```dockerfile
CMD ["node", "node_modules/.bin/next", "start"]
```
Ou com `output: 'standalone'`:
```dockerfile
CMD ["node", "server.js"]
```

---

### 5. Endpoint `/api/health` dedicado para Healthcheck

**Benefício:** Healthcheck mais leve e confiável — não depende de renderização de página com acesso a DB.

**Como implementar:** Criar `app/api/health/route.ts` retornando `{ status: 'ok' }`.
Atualizar `HEALTHCHECK` no Dockerfile e healthcheck no docker-compose.

---

## Repositório / Migração

### 6. Configurações (28 arquivos) — Repository Pattern

Módulo pendente da migração Repository. Estimativa: ~80 chamadas `getDb()` restantes.

### 7. Payback — Sprint 9

Módulo financeiro de acompanhamento de payback, aguardando Sprint 8 concluído.

---

## Infraestrutura (fora do escopo IA Champions Fase atual)

- Named volumes para produção (substituir bind mounts)
- PostgreSQL como banco de produção
- Kubernetes / Helm charts
