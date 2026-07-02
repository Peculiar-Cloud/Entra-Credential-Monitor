import {
  formatDateInTimeZone,
  formatTimeInTimeZone,
  getBrandName,
  getBrandPlainTextUrl,
  normalizeReportOptions,
  type ReportRenderInput,
} from './helpers.js'

interface OrganizationInfo {
  displayName?: string
}

export function buildAllClearText(
  organizationInfo: OrganizationInfo | null = null,
  optionsInput: ReportRenderInput = {},
): string {
  const options = normalizeReportOptions(optionsInput)
  const now = options.generatedAt

  return `
Entra ID Security Report - ${formatDateInTimeZone(now, options.timezone)}
${organizationInfo?.displayName ? `${organizationInfo.displayName}\n` : ''}
All Clear!

Your Entra ID app registrations are healthy. No immediate action required.

This automated scan successfully checked for:
- Expiring or expired app secrets and certificates
- App registrations and service principals with credentials in the warning window
- The monitor app's own credentials, when it can be identified in the tenant

Continue following security best practices by regularly rotating credentials and reviewing application permissions.

--
${getBrandName(options)} - Entra ID Security Monitoring
Generated ${formatDateInTimeZone(now, options.timezone)} at ${formatTimeInTimeZone(now, options.timezone)}
Visit: ${getBrandPlainTextUrl(options)}
`
}
