# Estratégia de Testes

## Stack

| Ferramenta | Versão | Uso |
|---|---|---|
| Jest | ^30 | Test runner |
| ts-jest | ^29 | Transpilação TypeScript |
| jest-environment-node | ^30 | Ambiente Node (não browser) |

Configuração: `jest.config.js` (CommonJS — `module.exports`).

---

## Suítes Existentes

### `__tests__/financeiro.test.ts` — 15 testes ✅

Cobre `lib/financeiro.ts`: cálculos financeiros puros.

| Grupo | Testes |
|---|---|
| ROI | Cálculo básico, ROI zero, ROI negativo, sem investimento |
| VPL | VPL positivo, negativo, taxa zero, fluxo vazio |
| TIR | TIR padrão, TIR negativa, TIR zero |
| Payback | Payback simples, payback nunca atingido |

### `__tests__/auth.test.ts` — 12 testes ✅

Cobre `lib/auth.ts`: hierarquia de permissões.

| Grupo | Testes |
|---|---|
| temPermissao | ADMIN tem tudo, SOLICITANTE tem mínimo, CEO > DIRETOR, limites de hierarquia |

### `__tests__/status.test.ts` — 8 testes ✅

Cobre `types/index.ts`: STATUS_ORDER e transições.

| Grupo | Testes |
|---|---|
| STATUS_ORDER | Comprimento (13), ordem correta, sem duplicatas |
| STATUS_LABELS | Label para cada status existente |

**Total: 35 testes, 35 passando (100%)**

---

## Como Executar

```bash
# Todos os testes
npm test

# Com cobertura
npm run test:coverage

# Um arquivo específico
npx jest __tests__/financeiro.test.ts

# Modo watch
npx jest --watch
```

---

## Cobertura Atual

| Arquivo | Cobertura |
|---|---|
| `lib/financeiro.ts` | ~90% (funções ROI/VPL/TIR/Payback) |
| `lib/auth.ts` | ~80% (temPermissao) |
| `types/index.ts` | ~60% (STATUS_ORDER/LABELS) |
| Demais arquivos | 0% — não cobertos |

---

## O que Deve ser Testado (por nova implementação)

| Tipo de código | O que testar |
|---|---|
| Cálculos financeiros | Fórmulas com casos limites (zero, negativo, overflow) |
| Regras de permissão | Cada nível de perfil e borda (ex.: CEO vs DIRETOR) |
| Transições de status | Sequência obrigatória, transições inválidas |
| Validações de entrada | Campos obrigatórios, tipos, limites |

**Não testar:**
- Queries SQL (Repository) — testar com integração, não mock
- Componentes React — fora da suite atual
- Rotas Next.js — fora da suite atual

---

## Decisões de Teste

### Por que Jest e não pytest?

O padrão IA Champions recomenda Python + pytest. Neste projeto o stack é Node.js/TypeScript. O Comitê de Isenção foi informado. A suite Jest é equivalente em cobertura para o stack utilizado.

### Por que não mockar o banco?

Experiência anterior mostrou que mocks divergem da produção. Testes unitários de lógica pura (sem banco) são os mais confiáveis — portanto a estratégia atual foca em testar funções puras (cálculos, permissões) sem tocar o banco.

### Expansão futura

- Testes de integração: criar banco em memória (`better-sqlite3 :memory:`) e testar repositories
- Testes de API: `msw` ou similar para mock de requisições
- Meta: cobertura > 80% para todo novo código de Service
