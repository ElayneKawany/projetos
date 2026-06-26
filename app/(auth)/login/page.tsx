'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Lock, User, AlertCircle } from 'lucide-react'

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0,3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6)}`
  return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`
}

export default function LoginPage() {
  const router = useRouter()
  const [cpf, setCpf] = useState('')
  const [senha, setSenha] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: cpf.replace(/\D/g, ''), senha }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErro(data.error || 'Erro ao autenticar.')
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-megag flex items-center justify-center p-4">
      {/* Padrão decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-white/5 rounded-full" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-white/5 rounded-full" />
        <div className="absolute top-1/3 left-1/4 w-64 h-64 bg-megag-dourado/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo e título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-megag-lg mb-4">
            <div className="w-10 h-10 bg-gradient-megag rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl font-display">M</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white font-display">MegaG PMO</h1>
          <p className="text-blue-200 text-sm mt-1">Portal de Governança de Projetos</p>
        </div>

        {/* Card de login */}
        <div className="bg-white rounded-2xl shadow-megag-lg p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-megag-preto font-display">Entrar</h2>
            <p className="text-sm text-megag-cinza-texto mt-1">Use seu CPF e senha corporativa.</p>
          </div>

          {erro && (
            <div className="mb-4 flex items-center gap-2.5 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              <AlertCircle size={16} className="flex-shrink-0" />
              {erro}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="input-label">CPF</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-megag-cinza-texto" />
                <input
                  type="text"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  className="input pl-9"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label className="input-label">Senha</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-megag-cinza-texto" />
                <input
                  type={showSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="Sua senha"
                  className="input pl-9 pr-10"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowSenha(!showSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-megag-cinza-texto hover:text-megag-azul transition-colors"
                >
                  {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3 text-base mt-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Autenticando...
                </>
              ) : 'Entrar'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-megag-cinza-medio">
            <p className="text-xs text-megag-cinza-texto text-center">
              Problemas de acesso? Contate o administrador PMO.
            </p>
          </div>
        </div>

        <p className="text-center text-blue-300/60 text-xs mt-6">
          © {new Date().getFullYear()} MegaG Alimentos. Todos os direitos reservados.
        </p>
      </div>
    </div>
  )
}
