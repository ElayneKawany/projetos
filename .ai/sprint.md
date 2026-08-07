# Sprint History

## Sprint 8 — Módulo Comitês (2026-08-05) ✅ COMPLETO

**Objetivo:** Migrar integralmente o módulo Comitês para a arquitetura Repository.

**Resultado:** 15 arquivos migrados, 0 erros TypeScript, ~27 chamadas `getDb()` removidas.

**Arquivos alterados:**
- `lib/repositories/comites.ts` — ~35 novos métodos adicionados
- `app/api/comites/route.ts`
- `app/api/comites/[id]/route.ts`
- `app/api/comites/[id]/participantes/route.ts`
- `app/api/comites/[id]/decisoes/route.ts`
- `app/api/comites/[id]/decisoes/[decId]/route.ts`
- `app/api/comites/[id]/pendencias/route.ts`
- `app/api/comites/[id]/pendencias/[pedId]/route.ts`
- `app/api/comites/[id]/projetos/route.ts`
- `app/api/comites/[id]/projetos/[projId]/route.ts`
- `app/api/comites/[id]/ata/route.ts`
- `app/api/comites/[id]/ata/gerar/route.ts`
- `app/api/comites/[id]/ata/exportar/route.ts`
- `app/api/comites/[id]/exportar/route.ts`
- `app/api/comites/[id]/resumo-ia/route.ts`

**Próximo sprint recomendado:** Sprint 9 — Módulo Payback

---

## Correções pré-Sprint 8 (2026-08-05) ✅

- `lib/repositories/financeiro.ts` — removidos cálculos KPI (`saldo`, `percentual_executado`) do `resumoExecutivo()`
- `app/api/usuarios/[id]/route.ts` — migrado para `UsuariosRepository`
- `lib/financeiro/contratos.ts`, `dashboard.ts`, `pagamentos.ts`, `importador.ts` — migrados para `FinanceiroRepository`

---

## Sprint 7 — Módulo Financeiro (anterior) ✅

- `lib/repositories/financeiro.ts` criado com ~18 métodos
- `lib/financeiro/` (4 arquivos de serviço) migrados
- APIs `app/api/projetos/[id]/financeiro/**` migradas

## Sprint 6 — Módulo Cronograma (anterior) ✅

- `lib/repositories/cronograma.ts` expandido
- `app/api/projetos/[id]/cronograma/route.ts` migrado
