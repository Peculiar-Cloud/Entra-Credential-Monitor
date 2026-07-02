import { describe, expect, it, vi } from 'vitest'
import type { Findings } from '../schemas.js'
import { sendMonitoringReport } from './email-service.js'

// Resend is only constructed once recipients are resolved; these tests
// exercise the recipient-resolution branch before any network call, but mock
// the SDK so importing the module never reaches the real client.
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: vi.fn(async () => ({ data: { id: 'x' }, error: null })) },
  })),
}))

function emptyFindings(): Findings {
  return {
    expiredSecrets: [],
    expiringSecrets: [],
    expiredCertificates: [],
    expiringCertificates: [],
    selfMonitoringAlerts: [],
    organizationInfo: { displayName: 'Org' },
  } as unknown as Findings
}

function findingsWithIssues(): Findings {
  return {
    ...emptyFindings(),
    expiredSecrets: [
      {
        appId: 'a',
        displayName: 'd',
        keyId: 'k',
        owners: 'o',
        type: 'Application',
        expiredDate: '2020-01-01',
        daysExpired: 5,
      },
    ],
  } as unknown as Findings
}

const baseEnv = {
  RESEND_API_KEY: 're_test',
  SENDER_EMAIL: 'sender@example.com',
  EMAIL_RECIPIENTS: '',
  ALWAYS_SEND_REPORT: false,
} as never

describe('sendMonitoringReport recipient handling', () => {
  it('throws an EmailError when there are issues to deliver but no recipients', async () => {
    await expect(sendMonitoringReport(baseEnv, findingsWithIssues())).rejects.toMatchObject({
      emailError: true,
    })
  })

  it('throws when ALWAYS_SEND_REPORT is set but recipients are empty', async () => {
    const env = { ...baseEnv, ALWAYS_SEND_REPORT: true } as never
    await expect(sendMonitoringReport(env, emptyFindings())).rejects.toMatchObject({
      emailError: true,
    })
  })

  it('returns false (legitimate skip) when there is nothing to send and no recipients', async () => {
    await expect(sendMonitoringReport(baseEnv, emptyFindings())).resolves.toBe(false)
  })
})
