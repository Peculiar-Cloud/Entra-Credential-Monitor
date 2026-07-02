import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApplicationSchema,
  CredentialFindingSchema,
  CredentialSchema,
  EnvConfigSchema,
  FindingsSchema,
  GraphErrorSchema,
  loadEnv,
  parseTenantConfigs,
  TenantConfigSchema,
  TenantsConfigSchema,
  TokenResponseSchema,
} from './schemas.js'

describe('TenantConfigSchema', () => {
  const validTenant = {
    tenantId: '12345678-1234-1234-1234-123456789012',
    clientId: '87654321-4321-4321-4321-210987654321',
    clientSecret: 'super-secret-key',
    name: 'Test Tenant',
  }

  it('accepts valid tenant configuration', () => {
    const result = TenantConfigSchema.safeParse(validTenant)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(validTenant)
    }
  })

  it('applies default name when not provided', () => {
    const { name: _name, ...tenantWithoutName } = validTenant
    const result = TenantConfigSchema.safeParse(tenantWithoutName)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Unnamed Tenant')
    }
  })

  it('rejects invalid tenant ID format', () => {
    const result = TenantConfigSchema.safeParse({
      ...validTenant,
      tenantId: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid client ID format', () => {
    const result = TenantConfigSchema.safeParse({
      ...validTenant,
      clientId: 'invalid',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty client secret', () => {
    const result = TenantConfigSchema.safeParse({
      ...validTenant,
      clientSecret: '',
    })
    expect(result.success).toBe(false)
  })
})

describe('TenantsConfigSchema', () => {
  it('accepts array of valid tenants', () => {
    const tenants = [
      {
        tenantId: '12345678-1234-1234-1234-123456789012',
        clientId: '87654321-4321-4321-4321-210987654321',
        clientSecret: 'secret1',
        name: 'Tenant 1',
      },
      {
        tenantId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        clientId: '11111111-2222-3333-4444-555555555555',
        clientSecret: 'secret2',
        name: 'Tenant 2',
      },
    ]
    const result = TenantsConfigSchema.safeParse(tenants)
    expect(result.success).toBe(true)
  })

  it('accepts empty array', () => {
    const result = TenantsConfigSchema.safeParse([])
    expect(result.success).toBe(true)
  })

  it('rejects non-array input', () => {
    const result = TenantsConfigSchema.safeParse({ notAnArray: true })
    expect(result.success).toBe(false)
  })
})

describe('EnvConfigSchema', () => {
  it('parses valid environment with defaults', () => {
    const result = EnvConfigSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.WARNING_DAYS).toBe(30)
      expect(result.data.SELF_MONITORING_WARNING_DAYS).toBe(60)
      expect(result.data.ALWAYS_SEND_REPORT).toBe(false)
    }
  })

  it('coerces string numbers to integers', () => {
    const result = EnvConfigSchema.safeParse({
      WARNING_DAYS: '45',
      SELF_MONITORING_WARNING_DAYS: '90',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.WARNING_DAYS).toBe(45)
      expect(result.data.SELF_MONITORING_WARNING_DAYS).toBe(90)
    }
  })

  it('validates email format for SENDER_EMAIL', () => {
    const result = EnvConfigSchema.safeParse({
      SENDER_EMAIL: 'invalid-email',
    })
    expect(result.success).toBe(false)
  })

  it('validates email format for TECHNICAL_CONTACT', () => {
    const result = EnvConfigSchema.safeParse({
      TECHNICAL_CONTACT: 'not-an-email',
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid email addresses', () => {
    const result = EnvConfigSchema.safeParse({
      SENDER_EMAIL: 'sender@example.com',
      TECHNICAL_CONTACT: 'admin@example.com',
    })
    expect(result.success).toBe(true)
  })

  it('transforms boolean flags from strings to booleans', () => {
    const result = EnvConfigSchema.safeParse({
      ALWAYS_SEND_REPORT: 'true',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.ALWAYS_SEND_REPORT).toBe(true)
    }
  })
})

describe('loadEnv', () => {
  it('returns a typed config for valid input', () => {
    const cfg = loadEnv({ WARNING_DAYS: '45' })
    expect(cfg.WARNING_DAYS).toBe(45)
  })

  it('throws on a non-numeric WARNING_DAYS instead of silently defaulting', () => {
    expect(() => loadEnv({ WARNING_DAYS: 'abc' })).toThrow()
  })

  it('throws on a negative WARNING_DAYS', () => {
    expect(() => loadEnv({ WARNING_DAYS: '-5' })).toThrow()
  })

  it('throws on a zero WARNING_DAYS', () => {
    expect(() => loadEnv({ WARNING_DAYS: '0' })).toThrow()
  })
})

describe('CredentialSchema', () => {
  it('accepts valid credential', () => {
    const credential = {
      keyId: 'key-123',
      displayName: 'Test Key',
      endDateTime: '2025-12-31T23:59:59Z',
      startDateTime: '2024-01-01T00:00:00Z',
    }
    const result = CredentialSchema.safeParse(credential)
    expect(result.success).toBe(true)
  })

  it('accepts credential with null displayName', () => {
    const credential = {
      keyId: 'key-123',
      displayName: null,
      endDateTime: '2025-12-31T23:59:59Z',
    }
    const result = CredentialSchema.safeParse(credential)
    expect(result.success).toBe(true)
  })

  it('accepts minimal credential', () => {
    const credential = {
      keyId: 'key-123',
      endDateTime: '2025-12-31T23:59:59Z',
    }
    const result = CredentialSchema.safeParse(credential)
    expect(result.success).toBe(true)
  })
})

describe('ApplicationSchema', () => {
  it('accepts valid application', () => {
    const app = {
      id: 'app-obj-id',
      appId: 'app-client-id',
      displayName: 'Test App',
      passwordCredentials: [],
      keyCredentials: [],
    }
    const result = ApplicationSchema.safeParse(app)
    expect(result.success).toBe(true)
  })

  it('applies default empty arrays for credentials', () => {
    const app = {
      id: 'app-obj-id',
      appId: 'app-client-id',
      displayName: 'Test App',
    }
    const result = ApplicationSchema.safeParse(app)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.passwordCredentials).toEqual([])
      expect(result.data.keyCredentials).toEqual([])
      expect(result.data.owners).toEqual([])
    }
  })
})

describe('CredentialFindingSchema', () => {
  const baseFinding = {
    appId: 'app-123',
    displayName: 'Test App',
    keyId: 'key-456',
    owners: 'owner@example.com',
    type: 'Application' as const,
  }

  it('accepts expiring credential finding', () => {
    const finding = {
      ...baseFinding,
      expiryDate: '2025-01-15',
      daysUntilExpiry: 30,
    }
    const result = CredentialFindingSchema.safeParse(finding)
    expect(result.success).toBe(true)
  })

  it('accepts expired credential finding', () => {
    const finding = {
      ...baseFinding,
      expiredDate: '2024-12-15',
      daysExpired: 30,
    }
    const result = CredentialFindingSchema.safeParse(finding)
    expect(result.success).toBe(true)
  })

  it('accepts ServicePrincipal type', () => {
    const finding = {
      ...baseFinding,
      type: 'ServicePrincipal' as const,
    }
    const result = CredentialFindingSchema.safeParse(finding)
    expect(result.success).toBe(true)
  })

  it('rejects invalid type', () => {
    const finding = {
      ...baseFinding,
      type: 'Invalid',
    }
    const result = CredentialFindingSchema.safeParse(finding)
    expect(result.success).toBe(false)
  })
})

describe('FindingsSchema', () => {
  it('accepts valid findings', () => {
    const findings = {
      expiredSecrets: [],
      expiringSecrets: [],
      expiredCertificates: [],
      expiringCertificates: [],
      selfMonitoringAlerts: [],
      organizationInfo: {
        displayName: 'Test Org',
      },
    }
    const result = FindingsSchema.safeParse(findings)
    expect(result.success).toBe(true)
  })
})

describe('TokenResponseSchema', () => {
  it('accepts valid token response', () => {
    const response = {
      access_token: 'eyJ0eXAiOiJKV1...',
      token_type: 'Bearer',
      expires_in: 3600,
    }
    const result = TokenResponseSchema.safeParse(response)
    expect(result.success).toBe(true)
  })
})

describe('GraphErrorSchema', () => {
  it('accepts valid error response', () => {
    const error = {
      error: {
        code: 'Authorization_RequestDenied',
        message: 'Insufficient privileges to complete the operation.',
        innerError: {
          date: '2024-01-01',
          'request-id': 'abc-123',
        },
      },
    }
    const result = GraphErrorSchema.safeParse(error)
    expect(result.success).toBe(true)
  })
})

describe('parseTenantConfigs', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('parses JSON array format', () => {
    const tenants = [
      {
        tenantId: '12345678-1234-1234-1234-123456789012',
        clientId: '87654321-4321-4321-4321-210987654321',
        clientSecret: 'secret1',
        name: 'Tenant 1',
      },
    ]
    const result = parseTenantConfigs({
      ENTRA_TENANTS: JSON.stringify(tenants),
    })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Tenant 1')
  })

  it('falls back to single tenant config', () => {
    const result = parseTenantConfigs({
      ENTRA_TENANT_ID: '12345678-1234-1234-1234-123456789012',
      ENTRA_CLIENT_ID: '87654321-4321-4321-4321-210987654321',
      ENTRA_CLIENT_SECRET: 'my-secret',
      ENTRA_TENANT_NAME: 'My Tenant',
    })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('My Tenant')
  })

  it('uses default name for single tenant', () => {
    const result = parseTenantConfigs({
      ENTRA_TENANT_ID: '12345678-1234-1234-1234-123456789012',
      ENTRA_CLIENT_ID: '87654321-4321-4321-4321-210987654321',
      ENTRA_CLIENT_SECRET: 'my-secret',
    })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Primary Tenant')
  })

  it('returns empty array when no config provided', () => {
    const result = parseTenantConfigs({})
    expect(result).toHaveLength(0)
  })

  it('throws on invalid ENTRA_TENANTS JSON instead of silently scanning nothing', () => {
    expect(() => parseTenantConfigs({ ENTRA_TENANTS: 'not-valid-json' })).toThrow(/ENTRA_TENANTS/)
  })

  it('throws when an ENTRA_TENANTS entry fails validation', () => {
    expect(() =>
      parseTenantConfigs({ ENTRA_TENANTS: JSON.stringify([{ invalid: true }]) }),
    ).toThrow(/ENTRA_TENANTS/)
  })

  it('does NOT fall back to single-tenant vars when ENTRA_TENANTS is set but invalid', () => {
    expect(() =>
      parseTenantConfigs({
        ENTRA_TENANTS: '{bad json',
        ENTRA_TENANT_ID: '12345678-1234-1234-1234-123456789012',
        ENTRA_CLIENT_ID: '87654321-4321-4321-4321-210987654321',
        ENTRA_CLIENT_SECRET: 'my-secret',
      }),
    ).toThrow(/ENTRA_TENANTS/)
  })

  it('prefers JSON format over single tenant', () => {
    const tenants = [
      {
        tenantId: '12345678-1234-1234-1234-123456789012',
        clientId: '87654321-4321-4321-4321-210987654321',
        clientSecret: 'json-secret',
        name: 'JSON Tenant',
      },
    ]
    const result = parseTenantConfigs({
      ENTRA_TENANTS: JSON.stringify(tenants),
      ENTRA_TENANT_ID: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      ENTRA_CLIENT_ID: '11111111-2222-3333-4444-555555555555',
      ENTRA_CLIENT_SECRET: 'single-secret',
      ENTRA_TENANT_NAME: 'Single Tenant',
    })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('JSON Tenant')
    expect(result[0].clientSecret).toBe('json-secret')
  })
})
