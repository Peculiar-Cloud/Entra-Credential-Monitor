import { format, toZonedTime } from 'date-fns-tz'
import type { CredentialFinding, Findings } from '../../schemas.js'

interface OrganizationInfo {
  displayName?: string
}

const LOGO_URL =
  'https://peculiar.cloud/logo.avif?utm_source=entra_credential_monitor&utm_medium=email&utm_campaign=report_asset'
const BRAND_URL =
  'https://peculiar.cloud?utm_source=entra_credential_monitor&utm_medium=email&utm_campaign=report_footer'
const EST_TIMEZONE = 'America/New_York'

export function getLogoUrl(): string {
  return LOGO_URL
}

export function getBrandUrl(): string {
  return BRAND_URL
}

export function formatDateEST(date: Date): string {
  const estDate = toZonedTime(date, EST_TIMEZONE)
  return format(estDate, 'MMMM d, yyyy', { timeZone: EST_TIMEZONE })
}

export function formatTimeEST(date: Date): string {
  const estDate = toZonedTime(date, EST_TIMEZONE)
  return format(estDate, "h:mm a 'EST'", { timeZone: EST_TIMEZONE })
}

export function formatDateTimeEST(date: Date): string {
  return `${formatDateEST(date)} at ${formatTimeEST(date)}`
}

export function generateSubject(
  baseSubject: string,
  organizationInfo: OrganizationInfo | null | undefined,
): string {
  if (organizationInfo?.displayName) {
    const parts = baseSubject.split(' - ')
    if (parts.length > 1) {
      const prefix = parts.slice(0, -1).join(' - ')
      const suffix = parts[parts.length - 1]
      return `${prefix} [${organizationInfo.displayName}] - ${suffix}`
    }
    return `${baseSubject} [${organizationInfo.displayName}]`
  }

  return baseSubject
}

export function hasAnyIssues(findings: Findings): boolean {
  return (
    findings.expiringSecrets.length > 0 ||
    findings.expiredSecrets.length > 0 ||
    findings.expiringCertificates.length > 0 ||
    findings.expiredCertificates.length > 0 ||
    findings.selfMonitoringAlerts.length > 0
  )
}

export function getCriticalCount(findings: Findings): number {
  const selfCritical = findings.selfMonitoringAlerts.filter(
    (alert) => alert.type === 'CRITICAL',
  ).length
  return findings.expiredSecrets.length + findings.expiredCertificates.length + selfCritical
}

export function getWarningCount(findings: Findings): number {
  const selfWarnings = findings.selfMonitoringAlerts.filter(
    (alert) => alert.type === 'WARNING',
  ).length
  return findings.expiringSecrets.length + findings.expiringCertificates.length + selfWarnings
}

export function getTotalApps(findings: Findings): number {
  const apps = new Set<string>()
  ;[
    ...findings.expiredSecrets,
    ...findings.expiringSecrets,
    ...findings.expiredCertificates,
    ...findings.expiringCertificates,
  ].forEach((item: CredentialFinding) => {
    apps.add(item.appId)
  })
  return apps.size
}

export function onlyHasSelfMonitoringIssues(findings: Findings): boolean {
  return (
    findings.expiringSecrets.length === 0 &&
    findings.expiredSecrets.length === 0 &&
    findings.expiringCertificates.length === 0 &&
    findings.expiredCertificates.length === 0 &&
    findings.selfMonitoringAlerts.length > 0
  )
}

export function generateAzurePortalUrl(appId: string, type: string = 'Application'): string {
  if (type === 'ServicePrincipal') {
    return `https://portal.azure.com/#view/Microsoft_AAD_IAM/ManagedAppMenuBlade/~/Overview/appId/${appId}`
  }
  return `https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Overview/appId/${appId}`
}
