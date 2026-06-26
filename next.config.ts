import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  images: {
    domains: ['megag.com.br'],
  },
}

export default nextConfig
