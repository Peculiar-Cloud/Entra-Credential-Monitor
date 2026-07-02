import { formatDateEST, formatTimeEST } from './helpers.js'

interface OrganizationInfo {
  displayName?: string
}

export function buildAllClearText(organizationInfo: OrganizationInfo | null = null): string {
  const now = new Date()

  return `
Entra ID Security Report - ${formatDateEST(now)}
${organizationInfo?.displayName ? `${organizationInfo.displayName}\n` : ''}
All Clear!

Your Entra ID app registrations are healthy. No immediate action required.

This automated scan successfully checked for:
- Expiring or expired app secrets and certificates
- App registrations and service principals with credentials in the warning window
- The monitor app's own credentials, when it can be identified in the tenant

Continue following security best practices by regularly rotating credentials and reviewing application permissions.

--
Peculiar Cloud - Entra ID Security Monitoring
Generated ${formatDateEST(now)} at ${formatTimeEST(now)}
Visit: https://peculiar.cloud
`
}
