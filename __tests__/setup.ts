// Variáveis de ambiente necessárias para testes unitários.
// lib/config/env.ts faz fail-fast se JWT_SECRET não estiver definido.
process.env.JWT_SECRET = 'test-secret-not-used-at-runtime'
