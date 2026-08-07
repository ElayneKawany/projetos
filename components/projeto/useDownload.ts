'use client'

import { useState } from 'react'

/**
 * Hook utilitário para download autenticado de arquivos via fetch.
 * Substitui <a href download> que não passa cookies de sessão no App Router.
 */
export function useDownload() {
  const [baixando, setBaixando] = useState<string | null>(null)
  const [erroDownload, setErroDownload] = useState<string | null>(null)

  async function baixar(url: string, nomeArquivo: string) {
    setBaixando(nomeArquivo)
    setErroDownload(null)
    try {
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? `Erro ${res.status} ao gerar o arquivo.`)
      }

      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = objectUrl
      a.download = nomeArquivo
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)
    } catch (e) {
      setErroDownload(e instanceof Error ? e.message : 'Erro desconhecido ao baixar o arquivo.')
    } finally {
      setBaixando(null)
    }
  }

  return { baixar, baixando, erroDownload, setErroDownload }
}
