import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3', 'pptxgenjs', 'docx'],
  images: {
    domains: ['megag.com.br'],
  },
  webpack(config, { isServer }) {
    if (!isServer) {
      // Polyfill bare node module names
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false, net: false, tls: false, http: false, https: false,
        stream: false, path: false, os: false, crypto: false, zlib: false,
      }
      // Alias node: scheme URIs (used by pptxgenjs) to false for browser bundles
      config.resolve.alias = {
        ...config.resolve.alias,
        'node:fs': false,
        'node:https': false,
        'node:http': false,
        'node:net': false,
        'node:tls': false,
        'node:stream': false,
        'node:path': false,
        'node:os': false,
        'node:crypto': false,
        'node:zlib': false,
        'node:url': false,
        'node:buffer': false,
        'node:events': false,
        'node:util': false,
      }
    }
    return config
  },
}

export default nextConfig
