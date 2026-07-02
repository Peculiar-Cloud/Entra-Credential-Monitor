import { describe, expect, it } from 'vitest'
import {
  type BaseFinding,
  createEmptyFindings,
  type MonitorFindings,
  mergeFindings,
  type PartialFindings,
} from './findings.js'

describe('createEmptyFindings', () => {
  it('creates findings with empty arrays and organization info', () => {
    const orgInfo = { displayName: 'Test Org', primaryDomain: 'test.com' }
    const findings = createEmptyFindings(orgInfo)

    expect(findings).toEqual({
      expiringSecrets: [],
      expiredSecrets: [],
      expiringCertificates: [],
      expiredCertificates: [],
      selfMonitoringAlerts: [],
      organizationInfo: orgInfo,
    })
  })
})

describe('mergeFindings', () => {
  const createBaseFinding = (id: string): BaseFinding => ({
    appId: id,
    displayName: `App ${id}`,
    keyId: `key-${id}`,
    owners: 'owner@example.com',
    type: 'Application',
  })

  it('merges source findings into target', () => {
    const target: MonitorFindings = createEmptyFindings({
      displayName: 'Org',
      primaryDomain: 'org.com',
    })
    target.expiredSecrets.push(createBaseFinding('existing'))

    const source: PartialFindings = {
      expiringSecrets: [createBaseFinding('new1')],
      expiredSecrets: [createBaseFinding('new2')],
      expiringCertificates: [],
      expiredCertificates: [createBaseFinding('new3')],
    }

    mergeFindings(target, source)

    expect(target.expiredSecrets).toHaveLength(2)
    expect(target.expiringSecrets).toHaveLength(1)
    expect(target.expiredCertificates).toHaveLength(1)
  })

  it('preserves existing findings when merging empty source', () => {
    const target: MonitorFindings = createEmptyFindings({
      displayName: 'Org',
      primaryDomain: 'org.com',
    })
    target.expiredSecrets.push(createBaseFinding('existing'))

    const source: PartialFindings = {
      expiringSecrets: [],
      expiredSecrets: [],
      expiringCertificates: [],
      expiredCertificates: [],
    }

    mergeFindings(target, source)

    expect(target.expiredSecrets).toHaveLength(1)
  })
})
