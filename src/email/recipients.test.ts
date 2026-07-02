import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Findings } from '../schemas.js'
import { parseRecipients, resolveErrorRecipients, resolveReportRecipients } from './recipients.js'

const createEmptyFindings = (): Findings => ({
  expiredSecrets: [],
  expiringSecrets: [],
  expiredCertificates: [],
  expiringCertificates: [],
  selfMonitoringAlerts: [],
  organizationInfo: { displayName: 'Test Org' },
})

describe('parseRecipients', () => {
  it('returns empty array for undefined', () => {
    expect(parseRecipients(undefined)).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(parseRecipients('')).toEqual([])
  })

  it('parses single recipient', () => {
    expect(parseRecipients('user@example.com')).toEqual(['user@example.com'])
  })

  it('parses multiple comma-separated recipients', () => {
    expect(parseRecipients('a@example.com,b@example.com')).toEqual([
      'a@example.com',
      'b@example.com',
    ])
  })

  it('trims whitespace from recipients', () => {
    expect(parseRecipients('  a@example.com , b@example.com  ')).toEqual([
      'a@example.com',
      'b@example.com',
    ])
  })

  it('filters out empty entries', () => {
    expect(parseRecipients('a@example.com,,b@example.com')).toEqual([
      'a@example.com',
      'b@example.com',
    ])
  })
})

describe('resolveReportRecipients', () => {
  let mockLogger: { warn: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    mockLogger = { warn: vi.fn() }
  })

  it('returns empty array when EMAIL_RECIPIENTS not configured', () => {
    const findings = createEmptyFindings()
    const result = resolveReportRecipients({}, findings, mockLogger)
    expect(result).toEqual([])
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'EMAIL_RECIPIENTS not configured - skipping report delivery',
    )
  })

  it('returns base recipients when no self-monitoring issues', () => {
    const env = { EMAIL_RECIPIENTS: 'user@example.com' }
    const findings = createEmptyFindings()
    findings.expiringSecrets = [
      {
        appId: 'app-1',
        displayName: 'App',
        keyId: 'key-1',
        owners: '',
        type: 'Application',
      },
    ]
    const result = resolveReportRecipients(env, findings, mockLogger)
    expect(result).toEqual(['user@example.com'])
  })

  it('sends to EMAIL_RECIPIENTS for self-monitoring-only issues', () => {
    const env = {
      EMAIL_RECIPIENTS: 'users@example.com',
    }
    const findings = createEmptyFindings()
    findings.selfMonitoringAlerts = [
      {
        appId: 'app-1',
        displayName: 'Monitor App',
        keyId: 'key-1',
        owners: '',
        type: 'Application',
      },
    ]
    const result = resolveReportRecipients(env, findings, mockLogger)
    expect(result).toEqual(['users@example.com'])
  })

  it('returns EMAIL_RECIPIENTS for self-monitoring issues', () => {
    const env = { EMAIL_RECIPIENTS: 'users@example.com' }
    const findings = createEmptyFindings()
    findings.selfMonitoringAlerts = [
      {
        appId: 'app-1',
        displayName: 'Monitor App',
        keyId: 'key-1',
        owners: '',
        type: 'Application',
      },
    ]
    const result = resolveReportRecipients(env, findings, mockLogger)
    expect(result).toEqual(['users@example.com'])
  })

  it('returns EMAIL_RECIPIENTS when both self-monitoring and other issues exist', () => {
    const env = {
      EMAIL_RECIPIENTS: 'users@example.com',
    }
    const findings = createEmptyFindings()
    findings.selfMonitoringAlerts = [
      {
        appId: 'app-1',
        displayName: 'Monitor',
        keyId: 'key-1',
        owners: '',
        type: 'Application',
      },
    ]
    findings.expiredSecrets = [
      {
        appId: 'app-2',
        displayName: 'Other App',
        keyId: 'key-2',
        owners: '',
        type: 'Application',
      },
    ]
    const result = resolveReportRecipients(env, findings, mockLogger)
    expect(result).toEqual(['users@example.com'])
  })

  it('returns all EMAIL_RECIPIENTS', () => {
    const env = {
      EMAIL_RECIPIENTS: 'admin@example.com,user@example.com',
    }
    const findings = createEmptyFindings()
    findings.selfMonitoringAlerts = [
      {
        appId: 'app-1',
        displayName: 'Monitor',
        keyId: 'key-1',
        owners: '',
        type: 'Application',
      },
    ]
    findings.expiredSecrets = [
      {
        appId: 'app-2',
        displayName: 'Other',
        keyId: 'key-2',
        owners: '',
        type: 'Application',
      },
    ]
    const result = resolveReportRecipients(env, findings, mockLogger)
    expect(result).toHaveLength(2)
    expect(result).toContain('admin@example.com')
    expect(result).toContain('user@example.com')
  })
})

describe('resolveErrorRecipients', () => {
  let mockLogger: { warn: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    mockLogger = { warn: vi.fn() }
  })

  it('returns SENDER_EMAIL when set', () => {
    const env = {
      EMAIL_RECIPIENTS: 'users@example.com',
      SENDER_EMAIL: 'sender@example.com',
    }
    const result = resolveErrorRecipients(env, mockLogger)
    expect(result).toEqual(['sender@example.com'])
  })

  it('trims SENDER_EMAIL', () => {
    const env = { SENDER_EMAIL: '  sender@example.com  ' }
    const result = resolveErrorRecipients(env, mockLogger)
    expect(result).toEqual(['sender@example.com'])
  })

  it('returns empty when SENDER_EMAIL not set (no fallback)', () => {
    const env = { EMAIL_RECIPIENTS: 'users@example.com' }
    const result = resolveErrorRecipients(env, mockLogger)
    expect(result).toEqual([])
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Unable to send error notification - SENDER_EMAIL not configured',
    )
  })

  it('warns when SENDER_EMAIL not configured', () => {
    const result = resolveErrorRecipients({}, mockLogger)
    expect(result).toEqual([])
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Unable to send error notification - SENDER_EMAIL not configured',
    )
  })

  it('ignores empty SENDER_EMAIL and returns empty (no fallback)', () => {
    const env = {
      EMAIL_RECIPIENTS: 'users@example.com',
      SENDER_EMAIL: '  ',
    }
    const result = resolveErrorRecipients(env, mockLogger)
    expect(result).toEqual([])
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Unable to send error notification - SENDER_EMAIL not configured',
    )
  })
})
