/**
 * check-data-fim-prev.js
 *
 * Garante que nenhum NOVO arquivo use data_fim_prev para lógica de negócio.
 *
 * data_fim_prev é um campo LEGADO. A fonte oficial de data de conclusão é
 * projeto.data_fim_efetiva (MAX das tarefas do cronograma ativo).
 *
 * Usos PERMITIDOS (allowlist abaixo):
 *   - Definição de tipos (types/)
 *   - Schema e migrations (lib/db/)
 *   - Guard de proteção (lib/guards/)
 *   - Repositórios (lib/repositories/)
 *   - Serviços legados documentados (lib/projetos.ts, lib/financeiro.ts, lib/payback/)
 *   - Importadores e validações de artefatos (lib/importadores/, lib/validacoes-artefatos.ts)
 *   - Formulário de edição da Viabilidade (components/projeto/ViabilidadeEditor.tsx)
 *   - APIs de Viabilidade, Visão Geral, Payback, Comitês, rota principal do projeto
 *   - Componentes e páginas de dashboard existentes (já comprometidos no baseline)
 *
 * Qualquer arquivo NÃO listado abaixo que usar data_fim_prev falhará o build.
 */

const fs   = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')

// Lista de arquivos autorizados a conter data_fim_prev (caminhos relativos à raiz).
// Adicionar um novo arquivo aqui requer revisão do squad + comentário justificando o uso.
const ALLOWLIST = new Set([
  // ── Tipos e schema ─────────────────────────────────────────────
  'types/index.ts',
  'lib/db/index.ts',
  'lib/db/drizzle/schema.ts',

  // ── Proteção e governança ───────────────────────────────────────
  'lib/guards/data-fim-prev.guard.ts',

  // ── Repositórios (acesso ao banco, campo legado) ────────────────
  'lib/repositories/projetos.ts',
  'lib/repositories/viabilidade.ts',
  'lib/repositories/financeiro.ts',
  'lib/repositories/comites.ts',

  // ── Serviços legados documentados ──────────────────────────────
  'lib/projetos.ts',
  'lib/financeiro.ts',
  'lib/validacoes-artefatos.ts',

  // ── Payback (campo legado, calculado sobre histórico) ──────────
  'lib/payback/calcularPayback.ts',

  // ── Importadores (template/planilha) ───────────────────────────
  'lib/importadores/viabilidade-modelo.ts',

  // ── Formulário de edição (Viabilidade — campo editável) ────────
  'components/projeto/ViabilidadeEditor.tsx',

  // ── APIs de escrita dos formulários legados ────────────────────
  'app/api/projetos/[id]/route.ts',
  'app/api/projetos/[id]/visao-geral/route.ts',
  'app/api/projetos/[id]/viabilidade/[vid]/route.ts',
  'app/api/projetos/[id]/viabilidade/[vid]/nova-versao/route.ts',
  'app/api/projetos/[id]/payback/dados/route.ts',
  'app/api/comites/[id]/resumo-ia/route.ts',

  // ── Baseline dos componentes de dashboard (comprometidos) ──────
  'app/(dashboard)/projetos/ProjetosClient.tsx',
  'app/(dashboard)/projetos/[id]/ProjetoDetalheClient.tsx',
  'app/(dashboard)/projetos/[id]/page.tsx',
  'app/(dashboard)/comites/[id]/ComiteDetalheClient.tsx',
  'app/(dashboard)/comites/[id]/page.tsx',
])

// Diretórios ignorados integralmente (nunca terão arquivos TS nossos)
const IGNORED_DIRS = ['node_modules', '.next', '.git', 'dist', 'build']

let violations = 0

function normalizeRelative(fullPath) {
  return path.relative(root, fullPath).replace(/\\/g, '/')
}

function scanDir(dir) {
  let entries
  try {
    entries = fs.readdirSync(dir)
  } catch {
    return
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry)

    let stat
    try {
      stat = fs.statSync(fullPath)
    } catch {
      continue
    }

    if (stat.isDirectory()) {
      if (IGNORED_DIRS.includes(entry)) continue
      scanDir(fullPath)
      continue
    }

    if (!entry.endsWith('.ts') && !entry.endsWith('.tsx')) continue

    const relPath = normalizeRelative(fullPath)

    if (ALLOWLIST.has(relPath)) continue

    const content = fs.readFileSync(fullPath, 'utf8')
    if (content.includes('data_fim_prev')) {
      console.error(`❌  ${relPath}`)
      console.error(`    → data_fim_prev é um campo legado. Use projeto.data_fim_efetiva.`)
      console.error(`    → Se o uso for legítimo, adicione o arquivo ao ALLOWLIST em scripts/check-data-fim-prev.js`)
      violations++
    }
  }
}

scanDir(root)

if (violations > 0) {
  console.error(`\n🚫  Build bloqueado: ${violations} arquivo(s) com uso não autorizado de data_fim_prev.`)
  process.exit(1)
} else {
  console.log('✅  Verificação data_fim_prev OK — nenhum uso não autorizado encontrado.')
}
