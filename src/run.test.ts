import { describe, expect, it, vi } from 'vitest'
import { createLogger } from './logger.js'
import { main, type RunDeps } from './run.js'
import type { TenantConfig } from './schemas.js'

function fakeFindings(over: Record<string, unknown> = {}) {
  return {
    expiringSecrets: [],
    expiredSecrets: [],
    expiringCertificates: [],
    expiredCertificates: [],
    selfMonitoringAlerts: [],
    organizationInfo: { displayName: 'Org' },
    ...over,
  }
}

function makeDeps(over: Partial<RunDeps> = {}): RunDeps {
  return {
    getTenants: () => [
      { tenantId: 't1', clientId: 'c1', clientSecret: 's', name: 'T1' } as TenantConfig,
      { tenantId: 't2', clientId: 'c2', clientSecret: 's', name: 'T2' } as TenantConfig,
    ],
    scanTenant: vi.fn(async () => fakeFindings()),
    sendReport: vi.fn(async () => true),
    sendErrorNotification: vi.fn(async () => true),
    healthchecks: {
      start: vi.fn(async () => {}),
      success: vi.fn(async () => {}),
      fail: vi.fn(async () => {}),
    },
    logger: createLogger('silent'),
    ...over,
  } as RunDeps
}

function testEnv() {
  return {
    WARNING_DAYS: 30,
    SELF_MONITORING_WARNING_DAYS: 60,
    ALWAYS_SEND_REPORT: false,
  } as never
}

describe('main', () => {
  it('scans all tenants, pings success, exits 0 when healthy', async () => {
    const deps = makeDeps()
    const code = await main(testEnv(), deps)
    expect(code).toBe(0)
    expect(deps.scanTenant).toHaveBeenCalledTimes(2)
    expect(deps.healthchecks.success).toHaveBeenCalledTimes(1)
    expect(deps.healthchecks.fail).not.toHaveBeenCalled()
  })

  it('isolates a per-tenant failure: other tenant still emailed, exit 1, fail ping', async () => {
    const scanTenant = vi
      .fn()
      .mockRejectedValueOnce(new Error('graph down'))
      .mockResolvedValueOnce(fakeFindings({ expiredSecrets: [{}] }))
    const deps = makeDeps({ scanTenant })
    const code = await main(testEnv(), deps)
    expect(code).toBe(1)
    expect(deps.sendReport).toHaveBeenCalledTimes(1) // surviving tenant
    expect(deps.healthchecks.fail).toHaveBeenCalledTimes(1)
    expect(deps.healthchecks.success).not.toHaveBeenCalled()
  })

  it('does NOT send an error-notification email when the failure was an email failure', async () => {
    const emailErr = Object.assign(new Error('resend 500'), { emailError: true })
    const deps = makeDeps({
      sendReport: vi.fn(async () => {
        throw emailErr
      }),
      scanTenant: vi.fn(async () => fakeFindings({ expiredSecrets: [{}] })),
    })
    const code = await main(testEnv(), deps)
    expect(code).toBe(1)
    expect(deps.sendErrorNotification).not.toHaveBeenCalled()
    expect(deps.healthchecks.fail).toHaveBeenCalledTimes(1)
  })

  it('treats zero configured tenants as a hard failure', async () => {
    const deps = makeDeps({ getTenants: () => [] })
    const code = await main(testEnv(), deps)
    expect(code).toBe(1)
    expect(deps.healthchecks.fail).toHaveBeenCalledTimes(1)
  })
})
