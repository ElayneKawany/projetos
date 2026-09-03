import { getSession, temPermissao } from '@/lib/auth'
import { redirect } from 'next/navigation'
import getDb from '@/lib/db'
import { asyncDb } from '@/lib/database'
import { UsuariosRepository } from '@/lib/repositories'
import ConfiguracoesClient from './ConfiguracoesClient'

const T_USUARIOS = '"AI"."TI_PMO_USUARIOS"'

export default async function ConfiguracoesPage() {
  const session = await getSession()
  if (!session) return null
  if (!temPermissao(session.perfil, 'config:write') && session.perfil !== 'PMO') redirect('/dashboard')

  const db = getDb()
  const diretoriasRaw = db.prepare(`
    SELECT d.*, COUNT(p.id) AS projeto_count
    FROM diretorias d
    LEFT JOIN projetos p ON p.diretoria_id = d.id AND p.ativo = 1
    GROUP BY d.id
    ORDER BY d.nome
  `).all() as (Record<string, unknown> & { diretor_responsavel_id: number | null })[]
  const diretorNomes = await UsuariosRepository.findNomesPorIds(
    diretoriasRaw.map(d => d.diretor_responsavel_id).filter((v): v is number => v != null)
  )
  const diretorias = diretoriasRaw.map(d => ({
    ...d,
    diretor_responsavel_nome: d.diretor_responsavel_id != null ? diretorNomes.get(d.diretor_responsavel_id)?.nome ?? null : null,
  }))

  const perfilDiretor = db.prepare(`SELECT id FROM perfis WHERE codigo = 'DIRETOR'`).get() as { id: number } | undefined
  const diretoresUsuarios = perfilDiretor
    ? await asyncDb.queryMany<{ id: number; nome: string }>(
        `SELECT id, nome FROM ${T_USUARIOS} WHERE ativo = true AND perfil_id = ? ORDER BY nome`,
        [perfilDiretor.id]
      )
    : []

  const areas = db.prepare(`
    SELECT a.*, d.nome as diretoria_nome,
      (SELECT COUNT(*) FROM projetos p WHERE p.area_id = a.id AND p.ativo = 1) as projeto_count
    FROM areas a
    JOIN diretorias d ON a.diretoria_id = d.id
    ORDER BY a.nome
  `).all()

  const usuariosRaw = await asyncDb.queryMany<Record<string, unknown> & { perfil_id: number; diretoria_id: number | null; area_id: number | null }>(
    `SELECT * FROM ${T_USUARIOS} ORDER BY nome`
  )
  const perfilIdsCfg = [...new Set(usuariosRaw.map(u => u.perfil_id))]
  const diretoriaIdsCfg = [...new Set(usuariosRaw.map(u => u.diretoria_id).filter((v): v is number => v != null))]
  const areaIdsCfg = [...new Set(usuariosRaw.map(u => u.area_id).filter((v): v is number => v != null))]
  const perfisCfg = perfilIdsCfg.length
    ? db.prepare(`SELECT id, codigo FROM perfis WHERE id IN (${perfilIdsCfg.map(() => '?').join(',')})`).all(...perfilIdsCfg) as { id: number; codigo: string }[]
    : []
  const diretoriasCfg = diretoriaIdsCfg.length
    ? db.prepare(`SELECT id, nome FROM diretorias WHERE id IN (${diretoriaIdsCfg.map(() => '?').join(',')})`).all(...diretoriaIdsCfg) as { id: number; nome: string }[]
    : []
  const areasCfg = areaIdsCfg.length
    ? db.prepare(`SELECT id, nome FROM areas WHERE id IN (${areaIdsCfg.map(() => '?').join(',')})`).all(...areaIdsCfg) as { id: number; nome: string }[]
    : []
  const perfilCfgMap = new Map(perfisCfg.map(p => [p.id, p.codigo]))
  const diretoriaCfgMap = new Map(diretoriasCfg.map(d => [d.id, d.nome]))
  const areaCfgMap = new Map(areasCfg.map(a => [a.id, a.nome]))
  const usuarios = usuariosRaw.map(u => ({
    ...u,
    perfil_codigo: perfilCfgMap.get(u.perfil_id) ?? null,
    diretoria_nome: u.diretoria_id != null ? diretoriaCfgMap.get(u.diretoria_id) ?? null : null,
    area_nome: u.area_id != null ? areaCfgMap.get(u.area_id) ?? null : null,
  }))
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
