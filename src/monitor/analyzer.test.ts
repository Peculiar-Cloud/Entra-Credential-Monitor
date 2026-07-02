import { addDays, subDays } from 'date-fns'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Application, ServicePrincipal } from '../schemas.js'
import { analyzeApplicationCredentials, analyzeServicePrincipalCredentials } from './analyzer.js'

describe('analyzeApplicationCredentials', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-15'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const createApp = (overrides: Partial<Application> = {}): Application => ({
    id: 'app-obj-id',
    appId: 'app-client-id',
    displayName: 'Test App',
    passwordCredentials: [],
    keyCredentials: [],
    owners: [
      {
        id: 'owner-1',
        displayName: 'Test Owner',
        userPrincipalName: 'owner@example.com',
      },
    ],
    ...overrides,
  })

  it('returns empty findings for app with no credentials', async () => {
    const findings = await analyzeApplicationCredentials({ app: createApp(), warningDays: 30 })

    expect(findings.expiredSecrets).toHaveLength(0)
    expect(findings.expiringSecrets).toHaveLength(0)
    expect(findings.expiredCertificates).toHaveLength(0)
    expect(findings.expiringCertificates).toHaveLength(0)
  })

  it('detects expired secrets', async () => {
    const app = createApp({
      passwordCredentials: [
        { keyId: 'secret-1', endDateTime: subDays(new Date(), 10).toISOString() },
      ],
    })

    const findings = await analyzeApplicationCredentials({ app, warningDays: 30 })

    expect(findings.expiredSecrets).toHaveLength(1)
    expect(findings.expiredSecrets[0].daysExpired).toBe(10)
  })

  it('detects expiring secrets within warning period', async () => {
    const app = createApp({
      passwordCredentials: [
        { keyId: 'secret-1', endDateTime: addDays(new Date(), 15).toISOString() },
      ],
    })

    const findings = await analyzeApplicationCredentials({ app, warningDays: 30 })

    expect(findings.expiringSecrets).toHaveLength(1)
    expect(findings.expiringSecrets[0].daysUntilExpiry).toBe(15)
  })

  it('ignores secrets expiring beyond warning period', async () => {
    const app = createApp({
      passwordCredentials: [
        { keyId: 'secret-1', endDateTime: addDays(new Date(), 60).toISOString() },
      ],
    })

    const findings = await analyzeApplicationCredentials({ app, warningDays: 30 })

    expect(findings.expiringSecrets).toHaveLength(0)
    expect(findings.expiredSecrets).toHaveLength(0)
  })

  it('detects expired certificates', async () => {
    const app = createApp({
      keyCredentials: [{ keyId: 'cert-1', endDateTime: subDays(new Date(), 5).toISOString() }],
    })

    const findings = await analyzeApplicationCredentials({ app, warningDays: 30 })

    expect(findings.expiredCertificates).toHaveLength(1)
    expect(findings.expiredCertificates[0].daysExpired).toBe(5)
  })

  it('detects expiring certificates within warning period', async () => {
    const app = createApp({
      keyCredentials: [{ keyId: 'cert-1', endDateTime: addDays(new Date(), 20).toISOString() }],
    })

    const findings = await analyzeApplicationCredentials({ app, warningDays: 30 })

    expect(findings.expiringCertificates).toHaveLength(1)
    expect(findings.expiringCertificates[0].daysUntilExpiry).toBe(20)
  })

  it('formats owner information', async () => {
    const app = createApp({
      passwordCredentials: [
        { keyId: 'secret-1', endDateTime: subDays(new Date(), 5).toISOString() },
      ],
    })

    const findings = await analyzeApplicationCredentials({ app, warningDays: 30 })

    expect(findings.expiredSecrets[0].owners).toBe('Test Owner (owner@example.com)')
  })

  it('handles multiple credentials', async () => {
    const app = createApp({
      passwordCredentials: [
        { keyId: 'secret-expired', endDateTime: subDays(new Date(), 5).toISOString() },
        { keyId: 'secret-expiring', endDateTime: addDays(new Date(), 10).toISOString() },
        { keyId: 'secret-ok', endDateTime: addDays(new Date(), 60).toISOString() },
      ],
    })

    const findings = await analyzeApplicationCredentials({ app, warningDays: 30 })

    expect(findings.expiredSecrets).toHaveLength(1)
    expect(findings.expiringSecrets).toHaveLength(1)
  })

  it('classifies a credential expiring exactly at the warning boundary as expiring', async () => {
    const app = createApp({
      passwordCredentials: [
        { keyId: 'secret-1', endDateTime: addDays(new Date(), 30).toISOString() },
      ],
    })

    const findings = await analyzeApplicationCredentials({ app, warningDays: 30 })

    expect(findings.expiringSecrets).toHaveLength(1)
    expect(findings.expiringSecrets[0].daysUntilExpiry).toBe(30)
  })
})

describe('analyzeServicePrincipalCredentials', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-15'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const createSP = (overrides: Partial<ServicePrincipal> = {}): ServicePrincipal => ({
    id: 'sp-obj-id',
    appId: 'sp-app-id',
    displayName: 'Test Service Principal',
    passwordCredentials: [],
    keyCredentials: [],
    owners: [],
    ...overrides,
  })

  it('returns empty findings for SP with no credentials', async () => {
    const findings = await analyzeServicePrincipalCredentials({ sp: createSP(), warningDays: 30 })

    expect(findings.expiredSecrets).toHaveLength(0)
    expect(findings.expiringSecrets).toHaveLength(0)
  })

  it('sets type to ServicePrincipal', async () => {
    const sp = createSP({
      passwordCredentials: [
        { keyId: 'secret-1', endDateTime: subDays(new Date(), 5).toISOString() },
      ],
    })

    const findings = await analyzeServicePrincipalCredentials({ sp, warningDays: 30 })

    expect(findings.expiredSecrets[0].type).toBe('ServicePrincipal')
  })

  it('detects expiring SP secrets', async () => {
    const sp = createSP({
      passwordCredentials: [
        { keyId: 'secret-1', endDateTime: addDays(new Date(), 15).toISOString() },
      ],
    })

    const findings = await analyzeServicePrincipalCredentials({ sp, warningDays: 30 })

    expect(findings.expiringSecrets).toHaveLength(1)
    expect(findings.expiringSecrets[0].daysUntilExpiry).toBe(15)
  })
})
