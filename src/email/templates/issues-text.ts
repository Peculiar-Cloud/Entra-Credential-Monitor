import { format } from 'date-fns'
import type { CredentialFinding, Findings } from '../../schemas.js'
import {
  generateAzurePortalUrl,
  getBrandUrl,
  getCriticalCount,
  getTotalApps,
  getWarningCount,
} from './helpers.js'
import { partitionByAge } from './partition.js'

interface AppItem extends CredentialFinding {
  secretId?: string
  thumbprint?: string
  createdDate?: string
  expiredDate?: string
  daysExpired?: number
}

export function buildIssuesText(findings: Findings, graceDays: number = 90): string {
  const criticalCount = getCriticalCount(findings)
  const warningCount = getWarningCount(findings)
  const totalApps = getTotalApps(findings)
  const organizationInfo = findings.organizationInfo

  let text = `
Entra ID Security Report - ${format(new Date(), 'MMMM d, yyyy')}
${organizationInfo ? `${organizationInfo.displayName}\n` : ''}
ACTION REQUIRED

Summary: ${criticalCount} critical issues, ${warningCount} warnings (${totalApps} total apps)

`

  if (findings.selfMonitoringAlerts && findings.selfMonitoringAlerts.length > 0) {
    const alerts = findings.selfMonitoringAlerts
    const criticalSelfAlerts = alerts.filter((alert) => alert.type === 'CRITICAL')
    const warningSelfAlerts = alerts.filter((alert) => alert.type === 'WARNING')
    const errorSelfAlerts = alerts.filter((alert) => alert.type === 'ERROR')

    if (criticalSelfAlerts.length > 0) {
      text += `CRITICAL: MONITORING SYSTEM ISSUES (${criticalSelfAlerts.length}):\n`
      criticalSelfAlerts.forEach((alert) => {
        text += `- ${alert.message}\n`
        if (alert.appName) text += `  App: ${alert.appName} (${alert.appId})\n`
        if (alert.secretId) text += `  Secret ID: ${alert.secretId}\n`
        if (alert.thumbprint) text += `  Certificate: ${alert.thumbprint}\n`
        if (alert.expiredDate)
          text += `  Expired: ${alert.expiredDate} (${alert.daysExpired} days ago)\n`
        if (alert.expiryDate)
          text += `  Expires: ${alert.expiryDate} (${alert.daysUntilExpiry} days)\n`
        text += `  Action: ${alert.action}\n`
        if (alert.appId) text += `  Portal: ${generateAzurePortalUrl(alert.appId)}\n`
        text += `\n`
      })
    }

    if (warningSelfAlerts.length > 0) {
      text += `MONITORING SYSTEM WARNINGS (${warningSelfAlerts.length}):\n`
      warningSelfAlerts.forEach((alert) => {
        text += `- ${alert.message}\n`
        if (alert.appName) text += `  App: ${alert.appName} (${alert.appId})\n`
        if (alert.secretId) text += `  Secret ID: ${alert.secretId}\n`
        if (alert.thumbprint) text += `  Certificate: ${alert.thumbprint}\n`
        if (alert.expiryDate)
          text += `  Expires: ${alert.expiryDate} (${alert.daysUntilExpiry} days)\n`
        text += `  Action: ${alert.action}\n`
        if (alert.appId) text += `  Portal: ${generateAzurePortalUrl(alert.appId)}\n`
        text += `\n`
      })
    }

    if (errorSelfAlerts.length > 0) {
      text += `MONITORING SYSTEM ERRORS (${errorSelfAlerts.length}):\n`
      errorSelfAlerts.forEach((alert) => {
        text += `- ${alert.message}\n`
        text += `  Action: ${alert.action}\n\n`
      })
    }
  }

  const { expiringSoon, recentlyExpired, longExpired } = partitionByAge(findings, graceDays)

  const warningItems = expiringSoon as AppItem[]
  if (warningItems.length > 0) {
    text += `UPCOMING EXPIRATIONS (${warningItems.length}):\n`
    warningItems.forEach((item) => {
      const isSecret = item.secretId !== undefined
      const portalUrl = generateAzurePortalUrl(item.appId, item.type)
      text += `- ${item.displayName} (${item.appId})\n`
      if (isSecret) {
        text += `  Secret expires: ${item.expiryDate} (${item.daysUntilExpiry} days)\n`
      } else {
        text += `  Certificate expires: ${item.expiryDate} (${item.daysUntilExpiry} days)\n`
      }
      text += `  Owners: ${item.owners}\n`
      text += `  Portal: ${portalUrl}\n\n`
    })
  }

  const recentItems = recentlyExpired as AppItem[]
  if (recentItems.length > 0) {
    text += `RECENTLY EXPIRED (${recentItems.length}):\n`
    recentItems.forEach((item) => {
      const isSecret = item.secretId !== undefined
      const portalUrl = generateAzurePortalUrl(item.appId, item.type)
      const daysAgo = item.daysExpired !== undefined ? `${item.daysExpired} days ago` : 'unknown'
      text += `- ${item.displayName} (${item.appId})\n`
      text += `  ${isSecret ? 'Secret' : 'Certificate'} expired: ${item.expiredDate || item.expiryDate} (${daysAgo})\n`
      text += `  Owners: ${item.owners}\n`
      text += `  Portal: ${portalUrl}\n\n`
    })
  }

  const longItems = longExpired as AppItem[]
  if (longItems.length > 0) {
    text += `LONG-EXPIRED (${longItems.length}) - expired more than ${graceDays} days ago, listed for reference:\n`
    longItems.forEach((item) => {
      text += `- ${item.displayName} (${item.appId}) - expired ${item.expiredDate} (${item.daysExpired ?? '?'} days ago)\n`
    })
    text += `\n`
  }

  text += `
--
Peculiar Cloud • Entra ID Security Monitoring
This automated security report helps maintain application security across your organization.
Generated on ${format(new Date(), 'MMMM d, yyyy')} at ${format(new Date(), 'HH:mm')} UTC
Visit: ${getBrandUrl()}
`

  return text
}
