import { temPermissao } from '@/lib/auth'

describe('temPermissao', () => {
  describe('ADMIN (nível 100)', () => {
    it('tem acesso a config:write', () => {
      expect(temPermissao('ADMIN', 'config:write')).toBe(true)
    })
    it('tem acesso a usuarios:write', () => {
      expect(temPermissao('ADMIN', 'usuarios:write')).toBe(true)
    })
    it('tem acesso a projetos:approve', () => {
      expect(temPermissao('ADMIN', 'projetos:approve')).toBe(true)
    })
  })

  describe('PMO (nível 80)', () => {
    it('tem acesso a comites:manage', () => {
      expect(temPermissao('PMO', 'comites:manage')).toBe(true)
    })
    it('não tem acesso a config:write (nível 100)', () => {
      expect(temPermissao('PMO', 'config:write')).toBe(false)
    })
    it('tem acesso a projetos:create', () => {
      expect(temPermissao('PMO', 'projetos:create')).toBe(true)
    })
  })

  describe('GESTOR (nível 40)', () => {
    it('tem acesso a projetos:create', () => {
      expect(temPermissao('GESTOR', 'projetos:create')).toBe(true)
    })
    it('tem acesso a projetos:manage', () => {
      expect(temPermissao('GESTOR', 'projetos:manage')).toBe(true)
    })
    it('não tem acesso a projetos:approve (nível 60)', () => {
      expect(temPermissao('GESTOR', 'projetos:approve')).toBe(false)
    })
    it('não tem acesso a comites:manage (nível 80)', () => {
      expect(temPermissao('GESTOR', 'comites:manage')).toBe(false)
    })
  })

  describe('SOLICITANTE (nível 20)', () => {
    it('tem acesso a projetos:create', () => {
      expect(temPermissao('SOLICITANTE', 'projetos:create')).toBe(true)
    })
    it('não tem acesso a projetos:manage (nível 40)', () => {
      expect(temPermissao('SOLICITANTE', 'projetos:manage')).toBe(false)
    })
    it('não tem acesso a auditoria:view (nível 40)', () => {
      expect(temPermissao('SOLICITANTE', 'auditoria:view')).toBe(false)
    })
  })

  describe('perfil desconhecido', () => {
    it('retorna false para permissão sem nível definido (default 100)', () => {
      expect(temPermissao('UNKNOWN', 'config:write')).toBe(false)
    })
    it('retorna false mesmo para permissão de nível baixo', () => {
      expect(temPermissao('UNKNOWN', 'projetos:create')).toBe(false)
    })
  })
})
