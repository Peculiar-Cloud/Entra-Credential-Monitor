import type { Findings } from '../../schemas.js'
import { buildAllClearText } from './all-clear.js'
import { generateSubject, hasAnyIssues, onlyHasSelfMonitoringIssues } from './helpers.js'
import { buildIssuesText } from './issues-text.js'
import { renderReportHtml } from './report-html.js'

export { hasAnyIssues } from './helpers.js'

export interface EmailReport {
  subject: string
  html: string
  text: string
}

/**
 * Select the report variant (all-clear, self-monitoring-only, or full issues)
 * and render its subject, HTML, and text bodies.
 *
 * The HTML is produced by a single renderer (`renderReportHtml`) that handles
 * all three states; only the subject line and the plaintext body differ per
 * variant.
 */
export function generateReport(findings: Findings, graceDays = 90): EmailReport {
  const html = renderReportHtml(findings, graceDays)

  if (!hasAnyIssues(findings)) {
    return {
      subject: generateSubject(
        'Peculiar Cloud: Entra ID Security Report - All Clear',
        findings.organizationInfo,
      ),
      html,
      text: buildAllClearText(findings.organizationInfo),
    }
  }

  if (findings.selfMonitoringAlerts.length > 0 && onlyHasSelfMonitoringIssues(findings)) {
    return {
      subject: generateSubject(
        'Peculiar Cloud: Entra ID Security Report - Monitoring System Alert',
        findings.organizationInfo,
      ),
      html,
      text: buildIssuesText(findings, graceDays),
    }
  }

  return {
    subject: generateSubject(
      'Peculiar Cloud: Entra ID Security Report - Action Required',
      findings.organizationInfo,
    ),
    html,
    text: buildIssuesText(findings, graceDays),
  }
}
