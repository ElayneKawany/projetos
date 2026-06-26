import { getSession, temPermissao } from '@/lib/auth'
import { redirect } from 'next/navigation'
import getDb from '@/lib/db'
import ConfiguracoesClient from './ConfiguracoesClient'

export default async function ConfiguracoesPage() {
  const session = await getSession()
  if (!session) return null
  if (!temPermissao(session.perfil, 'config:write') && session.perfil !== 'PMO') redirect('/dashboard')

  const db = getDb()
  const diretorias = db.prepare('SELECT * FROM diretorias ORDER BY nome').all()
  const areas = db.prepare('SELECT a.*, d.nome as diretoria_nome FROM areas a JOIN diretorias d ON a.diretoria_id=d.id ORDER BY a.nome').all()
  const usuarios = db.prepare(`
    SELECT u.*, p.codigo as perfil_codigo, d.nome as diretoria_nome
    FROM usuarios u
    JOIN perfis p ON u.perfil_id = p.id
    LEFT JOIN diretorias d ON u.diretoria_id = d.id
    ORDER BY u.nome
  `).all()
  const configFinanceira = db.prepare("SELECT * FROM config_global").all()

  return (
    <ConfiguracoesClient
      diretorias={diretorias as never[]}
      areas={areas as never[]}
      usuarios={usuarios as never[]}
      configFinanceira={configFinanceira as never[]}
      session={session}
    />
  )
}
