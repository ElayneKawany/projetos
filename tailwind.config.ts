import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Identidade Visual MegaG
        megag: {
          azul: '#003087',
          'azul-medio': '#1a4fa0',
          'azul-claro': '#2563B0',
          'azul-hover': '#004ab3',
          dourado: '#C8A84B',
          'dourado-claro': '#D4B96A',
          'dourado-escuro': '#A8882A',
          branco: '#FFFFFF',
          'cinza-claro': '#F4F6FA',
          'cinza-medio': '#E2E8F0',
          'cinza-borda': '#CBD5E1',
          'cinza-texto': '#64748B',
          'cinza-escuro': '#334155',
          preto: '#0F172A',
        },
        // Status dos projetos
        status: {
          proposta: '#94A3B8',
          triagem: '#60A5FA',
          comite: '#A78BFA',
          viabilidade: '#F59E0B',
          tap: '#F97316',
          aprovacao: '#EF4444',
          estruturacao: '#8B5CF6',
          cronograma: '#3B82F6',
          execucao: '#10B981',
          golive: '#059669',
          roi: '#0EA5E9',
          encerramento: '#6B7280',
        },
        // Prioridade
        prioridade: {
          baixa: '#10B981',
          media: '#F59E0B',
          alta: '#EF4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Montserrat', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'megag': '0 2px 8px rgba(0, 48, 135, 0.12)',
        'megag-md': '0 4px 16px rgba(0, 48, 135, 0.15)',
        'megag-lg': '0 8px 32px rgba(0, 48, 135, 0.18)',
        'card': '0 1px 4px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04)',
      },
      backgroundImage: {
        'gradient-megag': 'linear-gradient(135deg, #003087 0%, #1a4fa0 50%, #2563B0 100%)',
        'gradient-dourado': 'linear-gradient(135deg, #C8A84B 0%, #D4B96A 100%)',
        'gradient-sidebar': 'linear-gradient(180deg, #003087 0%, #001a50 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'pulse-megag': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
