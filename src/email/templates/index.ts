import type { Findings } from '../../schemas.js'
import { buildAllClearText } from './all-clear.js'
import {
  generateSubject,
  getBrandName,
  hasAnyIssues,
  normalizeReportOptions,
  onlyHasSelfMonitoringIssues,
  type ReportRenderInput,
} from './helpers.js'
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
export function generateReport(
  findings: Findings,
  optionsInput: ReportRenderInput = {},
): EmailReport {
  const options = normalizeReportOptions(optionsInput)
  const html = renderReportHtml(findings, options)
  const subjectPrefix = `${getBrandName(options)}: Entra ID Security Report`

  if (!hasAnyIssues(findings)) {
    return {
      subject: generateSubject(`${subjectPrefix} - All Clear`, findings.organizationInfo),
      html,
      text: buildAllClearText(findings.organizationInfo, options),
    }
  }

  if (findings.selfMonitoringAlerts.length > 0 && onlyHasSelfMonitoringIssues(findings)) {
    return {
      subject: generateSubject(
        `${subjectPrefix} - Monitoring System Alert`,
        findings.organizationInfo,
      ),
      html,
      text: buildIssuesText(findings, options),
    }
  }

  return {
    subject: generateSubject(`${subjectPrefix} - Action Required`, findings.organizationInfo),
    html,
    text: buildIssuesText(findings, options),
  }
}
