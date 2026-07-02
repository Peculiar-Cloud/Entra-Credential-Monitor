import { describe, expect, it } from 'vitest'
import type { Findings } from '../../schemas.js'
import { partitionByAge } from './partition.js'

function findings(over: Partial<Findings> = {}): Findings {
  return {
    expiredSecrets: [],
    expiringSecrets: [],
    expiredCertificates: [],
    expiringCertificates: [],
    selfMonitoringAlerts: [],
    organizationInfo: { displayName: 'Org' },
    ...over,
  } as Findings
}

const cred = (over: Record<string, unknown>) =>
  ({
    appId: 'a',
    displayName: 'App',
    keyId: 'k',
    owners: 'none',
    type: 'Application',
    ...over,
  }) as never

describe('partitionByAge', () => {
  it('routes expiring credentials to expiringSoon', () => {
    const result = partitionByAge(
      findings({ expiringSecrets: [cred({ daysUntilExpiry: 5, expiryDate: '2025-02-01' })] }),
      90,
    )
    expect(result.expiringSoon).toHaveLength(1)
    expect(result.recentlyExpired).toHaveLength(0)
    expect(result.longExpired).toHaveLength(0)
  })

  it('separates recently expired from long expired at the grace boundary', () => {
    const result = partitionByAge(
      findings({
        expiredSecrets: [
          cred({ daysExpired: 30, expiredDate: 'x' }),
          cred({ daysExpired: 90, expiredDate: 'y' }), // exactly grace -> recent
          cred({ daysExpired: 91, expiredDate: 'z' }), // beyond grace -> long
        ],
      }),
      90,
    )
    expect(result.recentlyExpired).toHaveLength(2)
    expect(result.longExpired).toHaveLength(1)
  })

  it('surfaces an unparseable-age finding (no daysExpired) as recently expired, not collapsed', () => {
    const result = partitionByAge(
      findings({ expiredSecrets: [cred({ expiredDate: 'unparseable date' })] }),
      90,
    )
    expect(result.recentlyExpired).toHaveLength(1)
    expect(result.longExpired).toHaveLength(0)
  })
})
