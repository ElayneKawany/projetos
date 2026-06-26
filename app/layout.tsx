import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PMO MegaG | Portal de Governança de Projetos',
  description: 'Sistema de Gestão de Projetos MegaG Alimentos',
  icons: { icon: '/megag/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
