import type { SelfMonitoringAlert } from '../schemas.js'
import type { OrganizationInfo } from './formatters.js'

// Simple finding type that can accommodate various credential findings.
export interface BaseFinding {
  appId: string
  displayName: string
  keyId: string
  owners: string
  type: 'Application' | 'ServicePrincipal'
  secretId?: string
  thumbprint?: string
  expiryDate?: string
  expiredDate?: string
  daysUntilExpiry?: number
  daysExpired?: number
  tenantName?: string
  createdDate?: string
}

export interface MonitorFindings {
  expiringSecrets: BaseFinding[]
  expiredSecrets: BaseFinding[]
  expiringCertificates: BaseFinding[]
  expiredCertificates: BaseFinding[]
  selfMonitoringAlerts: SelfMonitoringAlert[]
  organizationInfo: OrganizationInfo
}

export function createEmptyFindings(organizationInfo: OrganizationInfo): MonitorFindings {
  return {
    expiringSecrets: [],
    expiredSecrets: [],
    expiringCertificates: [],
    expiredCertificates: [],
    selfMonitoringAlerts: [],
    organizationInfo,
  }
}

export interface PartialFindings {
  expiringSecrets: BaseFinding[]
  expiredSecrets: BaseFinding[]
  expiringCertificates: BaseFinding[]
  expiredCertificates: BaseFinding[]
}

export function mergeFindings(target: MonitorFindings, source: PartialFindings): void {
  target.expiringSecrets.push(...source.expiringSecrets)
  target.expiredSecrets.push(...source.expiredSecrets)
  target.expiringCertificates.push(...source.expiringCertificates)
  target.expiredCertificates.push(...source.expiredCertificates)
}
