'use client'

import { Bell, Search, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import type { SessionUser } from '@/lib/auth'

interface HeaderProps {
  usuario: SessionUser
  notificacoes?: number
}

export default function Header({ usuario, notificacoes = 0 }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <header className="h-16 bg-white border-b border-megag-cinza-medio flex items-center px-6 gap-4 sticky top-0 z-30">
      {/* Busca global */}
      <div className={`flex-1 max-w-md transition-all duration-200 ${searchOpen ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`}>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-megag-cinza-texto" />
          <input
            type="text"
            placeholder="Buscar projeto, comitê, documento..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-megag-cinza-claro border border-transparent rounded-lg
                       focus:outline-none focus:border-megag-azul/40 focus:bg-white focus:ring-2 focus:ring-megag-azul/10
                       placeholder-megag-cinza-texto transition-all"
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setSearchOpen(false)}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 ml-auto">
        {/* Notificações */}
        <button className="relative p-2 rounded-lg text-megag-cinza-texto hover:bg-megag-cinza-claro hover:text-megag-azul transition-colors">
          <Bell size={20} />
          {notificacoes > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              {notificacoes > 9 ? '9+' : notificacoes}
            </span>
          )}
        </button>

        {/* Separador */}
        <div className="w-px h-6 bg-megag-cinza-medio" />

        {/* Usuário */}
        <div className="flex items-center gap-2.5 cursor-pointer group">
          <div className="w-8 h-8 rounded-full bg-megag-azul flex items-center justify-center flex-shrink-0">
            <span className="text-white font-semibold text-sm">
              {usuario.nome.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-megag-preto leading-none">{usuario.nome.split(' ')[0]}</p>
            <p className="text-xs text-megag-cinza-texto leading-none mt-0.5">{usuario.perfil}</p>
          </div>
          <ChevronDown size={14} className="text-megag-cinza-texto group-hover:text-megag-azul transition-colors" />
        </div>
      </div>
    </header>
  )
}
