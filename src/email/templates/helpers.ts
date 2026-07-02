import { format, toZonedTime } from 'date-fns-tz'
import type { CredentialFinding, Findings } from '../../schemas.js'

interface OrganizationInfo {
  displayName?: string
}

export interface ReportBrand {
  name: string
  url: string
}

export interface ReportRenderOptions {
  graceDays: number
  timezone: string
  brand: ReportBrand
  generatedAt: Date
}

export type ReportRenderInput = number | Partial<ReportRenderOptions>

export const DEFAULT_REPORT_TIMEZONE = 'America/New_York'
export const DEFAULT_REPORT_BRAND_NAME = 'Peculiar Cloud'
export const DEFAULT_REPORT_BRAND_URL = 'https://peculiar.cloud'

const DEFAULT_LOGO_URL =
  'https://peculiar.cloud/logo.avif?utm_source=entra_credential_monitor&utm_medium=email&utm_campaign=report_asset'
const DEFAULT_BRAND_LINK_URL =
  'https://peculiar.cloud?utm_source=entra_credential_monitor&utm_medium=email&utm_campaign=report_footer'

export function normalizeReportOptions(input: ReportRenderInput = {}): ReportRenderOptions {
  if (typeof input === 'number') {
    return {
      graceDays: input,
      timezone: DEFAULT_REPORT_TIMEZONE,
      brand: {
        name: DEFAULT_REPORT_BRAND_NAME,
        url: DEFAULT_BRAND_LINK_URL,
      },
      generatedAt: new Date(),
    }
  }

  return {
    graceDays: input.graceDays ?? 90,
    timezone: input.timezone ?? DEFAULT_REPORT_TIMEZONE,
    brand: {
      name: input.brand?.name ?? DEFAULT_REPORT_BRAND_NAME,
      url:
        input.brand?.url === DEFAULT_REPORT_BRAND_URL || input.brand?.url === undefined
          ? DEFAULT_BRAND_LINK_URL
          : input.brand.url,
    },
    generatedAt: input.generatedAt ?? new Date(),
  }
}

export function getLogoUrl(): string {
  return DEFAULT_LOGO_URL
}

export function getBrandUrl(options: ReportRenderInput = {}): string {
  return normalizeReportOptions(options).brand.url
}

export function getBrandPlainTextUrl(options: ReportRenderInput = {}): string {
  const normalized = normalizeReportOptions(options)
  return normalized.brand.url === DEFAULT_BRAND_LINK_URL
    ? DEFAULT_REPORT_BRAND_URL
    : normalized.brand.url
}

export function getBrandName(options: ReportRenderInput = {}): string {
  return normalizeReportOptions(options).brand.name
}

export function getBrandDisplayUrl(options: ReportRenderInput = {}): string {
  const url = getBrandUrl(options)
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function formatDateInTimeZone(date: Date, timezone = DEFAULT_REPORT_TIMEZONE): string {
  const zonedDate = toZonedTime(date, timezone)
  return format(zonedDate, 'MMMM d, yyyy', { timeZone: timezone })
}

export function formatTimeInTimeZone(date: Date, timezone = DEFAULT_REPORT_TIMEZONE): string {
  const zonedDate = toZonedTime(date, timezone)
  return format(zonedDate, 'h:mm a zzz', { timeZone: timezone })
}

export function formatDateTimeInTimeZone(date: Date, timezone = DEFAULT_REPORT_TIMEZONE): string {
  return `${formatDateInTimeZone(date, timezone)} at ${formatTimeInTimeZone(date, timezone)}`
}

export function formatDateEST(date: Date): string {
  return formatDateInTimeZone(date, DEFAULT_REPORT_TIMEZONE)
}

export function formatTimeEST(date: Date): string {
  return formatTimeInTimeZone(date, DEFAULT_REPORT_TIMEZONE)
}

export function formatDateTimeEST(date: Date): string {
  return formatDateTimeInTimeZone(date, DEFAULT_REPORT_TIMEZONE)
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
