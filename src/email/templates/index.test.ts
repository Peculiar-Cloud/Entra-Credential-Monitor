import { describe, expect, it } from 'vitest'
import type { Findings } from '../../schemas.js'
import { generateReport } from './index.js'

const base: Findings = {
  expiredSecrets: [],
  expiringSecrets: [],
  expiredCertificates: [],
  expiringCertificates: [],
  selfMonitoringAlerts: [],
  organizationInfo: { displayName: 'Acme Corp' },
}

describe('generateReport', () => {
  it('all-clear: subject + html + text', () => {
    const r = generateReport(base, 90)
    expect(r.subject).toContain('Peculiar Cloud')
    expect(r.subject).toContain('All Clear')
    expect(r.subject).toContain('[Acme Corp]')
    expect(r.html).toContain('All clear')
    expect(r.text).toContain('All Clear')
  })

  it('issues: action-required subject and rendered html', () => {
    const r = generateReport(
      {
        ...base,
        expiredSecrets: [
          {
            appId: 'a',
            displayName: 'X',
            keyId: 'k',
            owners: 'No owners',
            type: 'Application',
            expiredDate: '2026-01-01',
            daysExpired: 10,
            secretId: 's1',
          },
        ],
      },
      90,
    )
    expect(r.subject).toContain('Action Required')
    expect(r.html).toContain('Recently expired')
    expect(r.text).toContain('ACTION REQUIRED')
  })

  it('self-monitoring only: monitoring-alert subject and callout', () => {
    const r = generateReport(
      { ...base, selfMonitoringAlerts: [{ type: 'CRITICAL', message: 'm', action: 'a' }] },
      90,
    )
    expect(r.subject).toContain('Monitoring System Alert')
    expect(r.html).toContain('Monitor health')
  })

  it('uses configured brand name in the subject', () => {
    const r = generateReport(base, {
      graceDays: 90,
      timezone: 'UTC',
      brand: { name: 'Contoso Security', url: 'https://security.contoso.example' },
    })

    expect(r.subject).toContain('Contoso Security')
    expect(r.subject).not.toContain('Peculiar Cloud')
  })
})
