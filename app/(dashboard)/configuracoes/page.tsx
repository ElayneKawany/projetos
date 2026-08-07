import { getSession, temPermissao } from '@/lib/auth'
import { redirect } from 'next/navigation'
import getDb from '@/lib/db'
import ConfiguracoesClient from './ConfiguracoesClient'

export default async function ConfiguracoesPage() {
  const session = await getSession()
  if (!session) return null
  if (!temPermissao(session.perfil, 'config:write') && session.perfil !== 'PMO') redirect('/dashboard')

  const db = getDb()
  const diretorias = db.prepare(`
    SELECT d.*, COUNT(p.id) AS projeto_count,
      u.nome AS diretor_responsavel_nome
    FROM diretorias d
    LEFT JOIN projetos p ON p.diretoria_id = d.id AND p.ativo = 1
    LEFT JOIN usuarios u ON u.id = d.diretor_responsavel_id
    GROUP BY d.id
    ORDER BY d.nome
  `).all()
  const diretoresUsuarios = db.prepare(`
    SELECT u.id, u.nome
    FROM usuarios u
    JOIN perfis p ON u.perfil_id = p.id
    WHERE u.ativo = 1 AND p.codigo = 'DIRETOR'
    ORDER BY u.nome
  `).all() as { id: number; nome: string }[]
  const areas = db.prepare(`
    SELECT a.*, d.nome as diretoria_nome,
      (SELECT COUNT(*) FROM projetos p WHERE p.area_id = a.id AND p.ativo = 1) as projeto_count
    FROM areas a
    JOIN diretorias d ON a.diretoria_id = d.id
    ORDER BY a.nome
  `).all()
  const usuarios = db.prepare(`
    SELECT u.*, p.codigo as perfil_codigo, p.id as perfil_id,
      d.nome as diretoria_nome, a.nome as area_nome
    FROM usuarios u
    JOIN perfis p ON u.perfil_id = p.id
    LEFT JOIN diretorias d ON u.diretoria_id = d.id
    LEFT JOIN areas a ON u.area_id = a.id
    ORDER BY u.nome
  `).all()
  const configFinanceira = db.prepare("SELECT * FROM config_global").all()
  const configStatus = db.prepare("SELECT * FROM config_status_projeto ORDER BY ordem ASC").all()
  const tiposParticipacao = db.prepare("SELECT * FROM workflow_tipos_participacao ORDER BY id").all()
  const contasContabeis = db.prepare("SELECT * FROM config_contas_contabeis WHERE ativo = 1 ORDER BY codigo").all()
  const centrosCusto = db.prepare("SELECT * FROM config_centros_custo WHERE ativo = 1 ORDER BY codigo").all()
  const tiposTarefa = db.prepare("SELECT * FROM config_cronograma_tipos ORDER BY ordem, label").all()
  const criticidades = db.prepare("SELECT * FROM config_cronograma_criticidades ORDER BY ordem, label").all()
  const cfgRespImport = db
    .prepare("SELECT valor FROM config_global WHERE chave = 'responsavel_padrao_importacao'")
    .get() as { valor: string } | undefined
  const responsavelPadraoImportacaoId: number | null = cfgRespImport?.valor ? Number(cfgRespImport.valor) : null
  const motivosPausa = db.prepare('SELECT * FROM config_motivos_pausa ORDER BY ordem, nome').all()

  return (
    <ConfiguracoesClient
      diretorias={diretorias as never[]}
      diretoresUsuarios={diretoresUsuarios}
      areas={areas as never[]}
      usuarios={usuarios as never[]}
      configFinanceira={configFinanceira as never[]}
      configStatus={configStatus as never[]}
      tiposParticipacao={tiposParticipacao as never[]}
      contasContabeis={contasContabeis as never[]}
      centrosCusto={centrosCusto as never[]}
      tiposTarefa={tiposTarefa as never[]}
      criticidades={criticidades as never[]}
      responsavelPadraoImportacaoId={responsavelPadraoImportacaoId}
      motivosPausa={motivosPausa as never[]}
      session={session}
    />
  )
}
