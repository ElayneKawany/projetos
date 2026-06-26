'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, FolderKanban, Users, CalendarDays,
  DollarSign, FileText, CheckSquare, ShieldCheck, Settings,
  ChevronLeft, ChevronRight, LogOut, Bell
} from 'lucide-react'

interface MenuItem {
  label: string
  href: string
  icon: React.ElementType
  badge?: number
}

const MENU_ITEMS: MenuItem[] = [
  { label: 'Dashboard',    href: '/dashboard',      icon: LayoutDashboard },
  { label: 'Projetos',     href: '/projetos',        icon: FolderKanban },
  { label: 'Comitês',      href: '/comites',         icon: Users },
  { label: 'Cronogramas',  href: '/cronogramas',     icon: CalendarDays },
  { label: 'Financeiro',   href: '/financeiro',      icon: DollarSign },
  { label: 'Documentos',   href: '/documentos',      icon: FileText },
  { label: 'Aprovações',   href: '/aprovacoes',      icon: CheckSquare },
  { label: 'Auditoria',    href: '/auditoria',       icon: ShieldCheck },
  { label: 'Configurações',href: '/configuracoes',   icon: Settings },
]

interface SidebarProps {
  usuario: {
    nome: string
    perfil: string
    diretoria_nome?: string | null
  }
}

export default function Sidebar({ usuario }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={`
        fixed left-0 top-0 h-screen z-40
        flex flex-col
        bg-gradient-sidebar
        transition-all duration-300
        ${collapsed ? 'w-16' : 'w-64'}
      `}
    >
      {/* Logo */}
      <div className={`
        flex items-center h-16 px-4 border-b border-white/10
        ${collapsed ? 'justify-center' : 'justify-between'}
      `}>
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-megag-dourado rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm font-display">M</span>
            </div>
            <div>
              <p className="text-white font-bold text-sm font-display leading-none">MegaG</p>
              <p className="text-blue-300 text-[10px] font-medium tracking-wider uppercase leading-none mt-0.5">PMO Portal</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 bg-megag-dourado rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm font-display">M</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded text-blue-300 hover:text-white hover:bg-white/10 transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-item ${active ? 'active' : ''} ${collapsed ? 'justify-center px-2' : ''}`}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && (
                <span className="flex-1">{item.label}</span>
              )}
              {!collapsed && item.badge && item.badge > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Perfil e logout */}
      <div className={`border-t border-white/10 p-3 ${collapsed ? 'flex justify-center' : ''}`}>
        {!collapsed ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 px-2">
              <div className="w-8 h-8 rounded-full bg-megag-dourado/20 border border-megag-dourado/40 flex items-center justify-center flex-shrink-0">
                <span className="text-megag-dourado font-semibold text-xs">
                  {usuario.nome.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-semibold truncate">{usuario.nome}</p>
                <p className="text-blue-300 text-[10px] truncate">{usuario.perfil}</p>
              </div>
            </div>
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                className="w-full flex items-center gap-2 px-3 py-2 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg text-xs font-medium transition-colors"
              >
                <LogOut size={14} />
                Sair
              </button>
            </form>
          </div>
        ) : (
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="p-2 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Sair"
            >
              <LogOut size={16} />
            </button>
          </form>
        )}
      </div>
    </aside>
  )
}
