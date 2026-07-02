import { describe, expect, it } from 'vitest'
import type { CredentialFinding, Findings } from '../../schemas.js'
import {
  generateAzurePortalUrl,
  generateSubject,
  getCriticalCount,
  getTotalApps,
  getWarningCount,
  hasAnyIssues,
  onlyHasSelfMonitoringIssues,
} from './helpers.js'

const createEmptyFindings = (): Findings => ({
  expiredSecrets: [],
  expiringSecrets: [],
  expiredCertificates: [],
  expiringCertificates: [],
  selfMonitoringAlerts: [],
  organizationInfo: { displayName: 'Test Org' },
})

const createFinding = (overrides: Partial<CredentialFinding> = {}): CredentialFinding => ({
  appId: 'app-123',
  displayName: 'Test App',
  keyId: 'key-456',
  owners: 'owner@example.com',
  type: 'Application',
  ...overrides,
})

describe('generateSubject', () => {
  it('returns base subject when no organization info', () => {
    expect(generateSubject('Alert - Issues Found', null)).toBe('Alert - Issues Found')
    expect(generateSubject('Alert - Issues Found', undefined)).toBe('Alert - Issues Found')
  })

  it('returns base subject when organization has no displayName', () => {
    expect(generateSubject('Alert - Issues Found', {})).toBe('Alert - Issues Found')
    expect(generateSubject('Alert - Issues Found', { displayName: undefined })).toBe(
      'Alert - Issues Found',
    )
  })

  it('inserts organization name before last part when subject has dashes', () => {
    const result = generateSubject('Entra ID Monitor - Issues Found', {
      displayName: 'Contoso',
    })
    expect(result).toBe('Entra ID Monitor [Contoso] - Issues Found')
  })

  it('appends organization name when subject has no dashes', () => {
    const result = generateSubject('Monitoring Alert', { displayName: 'Contoso' })
    expect(result).toBe('Monitoring Alert [Contoso]')
  })

  it('handles subjects with multiple dashes', () => {
    const result = generateSubject('Entra ID - App Monitor - Critical Alert', {
      displayName: 'Contoso',
    })
    expect(result).toBe('Entra ID - App Monitor [Contoso] - Critical Alert')
  })
})

describe('hasAnyIssues', () => {
  it('returns false for empty findings', () => {
    expect(hasAnyIssues(createEmptyFindings())).toBe(false)
  })

  it('returns true when expiringSecrets present', () => {
    const findings = createEmptyFindings()
    findings.expiringSecrets = [createFinding()]
    expect(hasAnyIssues(findings)).toBe(true)
  })

  it('returns true when expiredSecrets present', () => {
    const findings = createEmptyFindings()
    findings.expiredSecrets = [createFinding()]
    expect(hasAnyIssues(findings)).toBe(true)
  })

  it('returns true when expiringCertificates present', () => {
    const findings = createEmptyFindings()
    findings.expiringCertificates = [createFinding()]
    expect(hasAnyIssues(findings)).toBe(true)
  })

  it('returns true when expiredCertificates present', () => {
    const findings = createEmptyFindings()
    findings.expiredCertificates = [createFinding()]
    expect(hasAnyIssues(findings)).toBe(true)
  })

  it('returns true when selfMonitoringAlerts present', () => {
    const findings = createEmptyFindings()
    findings.selfMonitoringAlerts = [createFinding()]
    expect(hasAnyIssues(findings)).toBe(true)
  })
})

describe('getCriticalCount', () => {
  it('returns 0 for empty findings', () => {
    expect(getCriticalCount(createEmptyFindings())).toBe(0)
  })

  it('counts expired secrets', () => {
    const findings = createEmptyFindings()
    findings.expiredSecrets = [createFinding(), createFinding({ appId: 'app-2' })]
    expect(getCriticalCount(findings)).toBe(2)
  })

  it('counts expired certificates', () => {
    const findings = createEmptyFindings()
    findings.expiredCertificates = [createFinding()]
    expect(getCriticalCount(findings)).toBe(1)
  })

  it('counts CRITICAL self-monitoring alerts', () => {
    const findings = createEmptyFindings()
    findings.selfMonitoringAlerts = [
      { ...createFinding(), type: 'CRITICAL' } as unknown as CredentialFinding,
      { ...createFinding({ appId: 'app-2' }), type: 'WARNING' } as unknown as CredentialFinding,
    ]
    expect(getCriticalCount(findings)).toBe(1)
  })

  it('combines all critical counts', () => {
    const findings = createEmptyFindings()
    findings.expiredSecrets = [createFinding()]
    findings.expiredCertificates = [createFinding({ appId: 'app-2' })]
    findings.selfMonitoringAlerts = [
      { ...createFinding({ appId: 'app-3' }), type: 'CRITICAL' } as unknown as CredentialFinding,
    ]
    expect(getCriticalCount(findings)).toBe(3)
  })
})

describe('getWarningCount', () => {
  it('returns 0 for empty findings', () => {
    expect(getWarningCount(createEmptyFindings())).toBe(0)
  })

  it('counts expiring secrets', () => {
    const findings = createEmptyFindings()
    findings.expiringSecrets = [createFinding(), createFinding({ appId: 'app-2' })]
    expect(getWarningCount(findings)).toBe(2)
  })

  it('counts expiring certificates', () => {
    const findings = createEmptyFindings()
    findings.expiringCertificates = [createFinding()]
    expect(getWarningCount(findings)).toBe(1)
  })

  it('counts WARNING self-monitoring alerts', () => {
    const findings = createEmptyFindings()
    findings.selfMonitoringAlerts = [
      { ...createFinding(), type: 'WARNING' } as unknown as CredentialFinding,
      { ...createFinding({ appId: 'app-2' }), type: 'CRITICAL' } as unknown as CredentialFinding,
    ]
    expect(getWarningCount(findings)).toBe(1)
  })
})

describe('getTotalApps', () => {
  it('returns 0 for empty findings', () => {
    expect(getTotalApps(createEmptyFindings())).toBe(0)
  })

  it('counts unique apps across all finding types', () => {
    const findings = createEmptyFindings()
    findings.expiredSecrets = [createFinding({ appId: 'app-1' })]
    findings.expiringSecrets = [createFinding({ appId: 'app-2' })]
    findings.expiredCertificates = [createFinding({ appId: 'app-3' })]
    expect(getTotalApps(findings)).toBe(3)
  })

  it('deduplicates apps appearing in multiple categories', () => {
    const findings = createEmptyFindings()
    findings.expiredSecrets = [createFinding({ appId: 'app-1' })]
    findings.expiringSecrets = [createFinding({ appId: 'app-1' })]
    findings.expiredCertificates = [createFinding({ appId: 'app-1' })]
    expect(getTotalApps(findings)).toBe(1)
  })
})

describe('onlyHasSelfMonitoringIssues', () => {
  it('returns false for empty findings', () => {
    expect(onlyHasSelfMonitoringIssues(createEmptyFindings())).toBe(false)
  })

  it('returns true when only self-monitoring alerts present', () => {
    const findings = createEmptyFindings()
    findings.selfMonitoringAlerts = [createFinding()]
    expect(onlyHasSelfMonitoringIssues(findings)).toBe(true)
  })

  it('returns false when other issues present', () => {
    const findings = createEmptyFindings()
    findings.selfMonitoringAlerts = [createFinding()]
    findings.expiredSecrets = [createFinding({ appId: 'app-2' })]
    expect(onlyHasSelfMonitoringIssues(findings)).toBe(false)
  })

  it('returns false when only other issues present', () => {
    const findings = createEmptyFindings()
    findings.expiredSecrets = [createFinding()]
    expect(onlyHasSelfMonitoringIssues(findings)).toBe(false)
  })
})

describe('generateAzurePortalUrl', () => {
  it('generates Application URL by default', () => {
    const url = generateAzurePortalUrl('app-id-123')
    expect(url).toBe(
      'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Overview/appId/app-id-123',
    )
  })

  it('generates Application URL for explicit Application type', () => {
    const url = generateAzurePortalUrl('app-id-123', 'Application')
    expect(url).toBe(
      'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Overview/appId/app-id-123',
    )
  })

  it('generates ServicePrincipal URL', () => {
    const url = generateAzurePortalUrl('app-id-123', 'ServicePrincipal')
    expect(url).toBe(
      'https://portal.azure.com/#view/Microsoft_AAD_IAM/ManagedAppMenuBlade/~/Overview/appId/app-id-123',
    )
  })
})
