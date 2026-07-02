/**
 * Renders the full HTML body for every report state (all-clear,
 * self-monitoring-only, and issues) in the minimalist-light design.
 *
 * Email-safety model:
 *  - Hybrid styling: a <style> block of classes carries the repeated
 *    font/color/border declarations (keeps total bytes under Gmail's ~102KB
 *    clip threshold); inline styles carry Outlook-critical padding, widths,
 *    backgrounds, and per-row severity colors.
 *  - Outlook hardening: an OfficeDocumentSettings DPI block, MSO ghost-table
 *    centering, web-safe font fallbacks (see tokens), `mso-line-height-rule`,
 *    a solid-color fallback for the gradient rule, and `●` glyph status
 *    markers instead of border-radius circles. The card's rounded corners
 *    square off in Outlook by design (VML roundrect on a tall, variable-height
 *    container is fragile).
 *  - The reference-only long-expired tier is capped (see LONG_EXPIRED_CAP) with
 *    a "+N more" pointer, both to bound email size and to keep signal high.
 *
 * Entra-derived strings (names, owners, credential ids, alert text) are escaped
 * with escapeHtml at every interpolation: they are attacker-influenceable.
 */

import type { CredentialFinding, Findings, SelfMonitoringAlert } from '../../schemas.js'
import {
  COLOR,
  chip,
  dot,
  FONT_MONO,
  FONT_SANS,
  SEV,
  type Severity,
  severityFor,
} from './design/tokens.js'
import { escapeHtml } from './escape.js'
import {
  formatDateEST,
  formatTimeEST,
  generateAzurePortalUrl,
  getBrandUrl,
  getCriticalCount,
  getTotalApps,
  getWarningCount,
} from './helpers.js'
import { partitionByAge } from './partition.js'

/**
 * Cap on the collapsed long-expired reference list. These are expired beyond
 * the grace window (not actionable), so listing hundreds only bloats the email
 * toward Gmail's clip limit. The remainder is summarized with a portal pointer.
 */
const LONG_EXPIRED_CAP = 25

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

function truncateId(id: string | undefined): string {
  if (!id) return '—'
  return id.length > 8 ? `${id.substring(0, 8)}…` : id
}

function typeLabel(type: string): string {
  return type === 'ServicePrincipal' ? 'Svc Principal' : 'App'
}

function statusText(item: CredentialFinding): string {
  if (item.daysExpired !== undefined) return `${item.daysExpired}d ago`
  if (item.daysUntilExpiry !== undefined) return `${item.daysUntilExpiry}d left`
  return ''
}

function credentialText(item: CredentialFinding): string {
  if (item.secretId !== undefined) return `secret ${truncateId(item.secretId)}`
  if (item.thumbprint !== undefined) return `cert ${truncateId(item.thumbprint)}`
  return '—'
}

/** Display-name-only owner (strip parenthetical UPNs/emails), truncated. */
function ownerText(owners: string | undefined): string {
  if (!owners || owners.includes('No owners')) return ''
  const noEmail = owners.replace(/\s*\([^)]*\)/g, '').trim()
  return noEmail.length > 24 ? `${noEmail.substring(0, 24)}…` : noEmail
}

function leadSentence(findings: Findings): string {
  const expired = getCriticalCount(findings)
  const expiring = getWarningCount(findings)
  const apps = getTotalApps(findings)
  if (expired === 0 && expiring === 0) {
    return 'All application credentials are healthy. No expired or expiring secrets or certificates were found in this tenant.'
  }
  const parts: string[] = []
  if (expired > 0) {
    parts.push(
      `<span style="color:${SEV.danger.color};font-weight:600;">${expired}</span> ${plural(expired, 'credential has', 'credentials have')} expired`,
    )
  }
  if (expiring > 0) {
    parts.push(
      `<span style="color:${SEV.warn.color};font-weight:600;">${expiring}</span> ${plural(expiring, 'is', 'are')} approaching expiry`,
    )
  }
  const scope = apps > 0 ? ` across ${apps} ${plural(apps, 'application', 'applications')}` : ''
  return `${parts.join(' and ')}${scope}. Ordered most-actionable first.`
}

function preheader(findings: Findings): string {
  const expired = getCriticalCount(findings)
  const expiring = getWarningCount(findings)
  if (expired === 0 && expiring === 0) return 'All application credentials are healthy.'
  return `${expired} expired, ${expiring} expiring credential(s) need attention.`
}

// ---------------------------------------------------------------------------
// Section fragments
// ---------------------------------------------------------------------------

/** Section eyebrow: severity dot + mono label + count chip. */
function eyebrow(label: string, count: number, sev: Severity): string {
  return `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:36px 0 14px;"><tr>
              <td style="padding-right:9px;vertical-align:middle;">${dot(sev)}</td>
              <td class="mono" style="padding-right:12px;vertical-align:middle;font-size:11px;font-weight:500;letter-spacing:1.4px;text-transform:uppercase;color:${COLOR.text};">${label}</td>
              <td style="vertical-align:middle;">${chip(String(count), sev)}</td>
            </tr></table>`
}

function dataRow(item: CredentialFinding, sev: Severity): string {
  const url = generateAzurePortalUrl(item.appId, item.type)
  const name = escapeHtml(item.displayName || 'Unknown application')
  const owner = ownerText(item.owners)
  return `
                  <tr class="row">
                    <td class="t-td" style="padding:13px 12px;"><a class="app" href="${url}">${name}</a></td>
                    <td class="t-td mono" style="padding:13px 12px;font-size:11px;color:${COLOR.text3};white-space:nowrap;">${typeLabel(item.type)}</td>
                    <td class="t-td mono" style="padding:13px 12px;font-size:11px;color:${COLOR.text3};white-space:nowrap;">${escapeHtml(credentialText(item))}</td>
                    <td class="t-td" style="padding:13px 12px;white-space:nowrap;">${dot(sev)} <span class="mono" style="font-size:12px;font-weight:500;color:${SEV[sev].color};">${statusText(item)}</span></td>
                    <td class="t-td" style="padding:13px 12px;">${
                      owner
                        ? `<span style="color:${COLOR.text2};">${escapeHtml(owner)}</span>`
                        : `<span style="color:${COLOR.text3};">Unassigned</span>`
                    }</td>
                  </tr>`
}

function dataTable(items: CredentialFinding[], sev: Severity): string {
  return `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;">
              <thead><tr>
                <th class="t-th" style="padding:0 12px 11px;">Application</th>
                <th class="t-th" style="padding:0 12px 11px;">Type</th>
                <th class="t-th" style="padding:0 12px 11px;">Credential</th>
                <th class="t-th" style="padding:0 12px 11px;">Status</th>
                <th class="t-th" style="padding:0 12px 11px;">Owner</th>
              </tr></thead>
              <tbody>${items.map((i) => dataRow(i, sev)).join('')}
              </tbody>
            </table>`
}

function longExpiredTable(items: CredentialFinding[]): string {
  const shown = items.slice(0, LONG_EXPIRED_CAP)
  const remainder = items.length - shown.length
  const rows = shown
    .map((item) => {
      const url = generateAzurePortalUrl(item.appId, item.type)
      const name = escapeHtml(item.displayName || 'Unknown application')
      const age = item.daysExpired !== undefined ? `${item.daysExpired}d ago` : '—'
      return `
                  <tr class="row">
                    <td class="t-td" style="padding:11px 12px;"><a class="app" href="${url}" style="color:${COLOR.text2};">${name}</a></td>
                    <td class="t-td mono" style="padding:11px 12px;font-size:11px;color:${COLOR.text3};white-space:nowrap;">${typeLabel(item.type)}</td>
                    <td class="t-td mono" style="padding:11px 12px;font-size:11px;color:${COLOR.text3};white-space:nowrap;">${escapeHtml(item.expiredDate || '—')}</td>
                    <td class="t-td mono" style="padding:11px 12px;font-size:11px;color:${COLOR.text3};white-space:nowrap;">${age}</td>
                  </tr>`
    })
    .join('')
  const more =
    remainder > 0
      ? `
            <p style="margin:14px 0 0;font-family:${FONT_MONO};font-size:11px;color:${COLOR.text3};">+ ${remainder} more — view in the Azure portal.</p>`
      : ''
  return `
            ${eyebrow('Long-expired', items.length, 'danger')}
            <p style="margin:0 0 16px;font-family:${FONT_SANS};font-size:12px;line-height:1.5;color:${COLOR.text3};">Expired beyond the grace window and unlikely to be in use. Listed for reference — open an application to manage it in the Azure portal.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;">
              <thead><tr>
                <th class="t-th" style="padding:0 12px 11px;">Application</th>
                <th class="t-th" style="padding:0 12px 11px;">Type</th>
                <th class="t-th" style="padding:0 12px 11px;">Expired</th>
                <th class="t-th" style="padding:0 12px 11px;">Age</th>
              </tr></thead>
              <tbody>${rows}
              </tbody>
            </table>${more}`
}

function calloutCard(sev: Severity, label: string, bodyHtml: string): string {
  const s = SEV[sev]
  return `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:separate;margin:8px 0 0;border:1px solid ${s.border};border-radius:12px;background:${s.tint};"><tr>
              <td style="padding:20px 22px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px;"><tr>
                  <td style="padding-right:9px;vertical-align:middle;">${dot(sev)}</td>
                  <td class="mono" style="vertical-align:middle;font-size:11px;font-weight:500;letter-spacing:1.4px;text-transform:uppercase;color:${s.color};">${label}</td>
                </tr></table>
                <p style="margin:0;font-family:${FONT_SANS};font-size:14px;line-height:1.65;color:${COLOR.text2};">${bodyHtml}</p>
              </td>
            </tr></table>`
}

function selfMonitoringBlock(alerts: SelfMonitoringAlert[]): string {
  if (alerts.length === 0) return ''
  const critical = alerts.some((a) => a.type === 'CRITICAL' || a.type === 'ERROR')
  const sev: Severity = critical ? 'danger' : 'warn'
  const lines = alerts
    .map((a) => {
      const link =
        a.appName && a.appId
          ? `<a href="${generateAzurePortalUrl(a.appId)}" style="color:${SEV[sev].color};font-weight:600;text-decoration:none;">${escapeHtml(a.appName)}</a>`
          : '<b>this monitoring application</b>'
      const when =
        a.daysUntilExpiry !== undefined
          ? `expires in ${a.daysUntilExpiry} ${plural(a.daysUntilExpiry, 'day', 'days')}`
          : a.daysExpired !== undefined
            ? `expired ${a.daysExpired} ${plural(a.daysExpired, 'day', 'days')} ago`
            : 'needs attention'
      return `The credential for ${link} ${when}. ${escapeHtml(a.action)}`
    })
    .join('<br><br>')
  return `<div style="margin-top:32px;">${calloutCard(sev, 'Monitor health', lines)}</div>`
}

function statCell(num: number, label: string, color: string, withBorder: boolean): string {
  const border = withBorder ? `border-left:1px solid ${COLOR.border};` : ''
  return `
                <td width="33.33%" style="width:33.33%;padding:24px 26px;${border}vertical-align:top;">
                  <div class="stat-num" style="font-family:${FONT_SANS};font-size:44px;font-weight:600;line-height:1;letter-spacing:-2px;color:${color};mso-line-height-rule:exactly;">${num}</div>
                  <div class="mono" style="font-size:10px;font-weight:500;letter-spacing:1.4px;text-transform:uppercase;color:${COLOR.text3};margin-top:12px;">${label}</div>
                </td>`
}

function statusPill(sev: Severity): string {
  const s = SEV[sev]
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0;"><tr><td style="border:1px solid ${s.border};border-radius:999px;padding:6px 13px;background:${s.tint};">
                ${dot(sev)} <span class="mono" style="font-size:11px;font-weight:500;letter-spacing:0.5px;color:${s.color};">${s.label}</span>
              </td></tr></table>`
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export function renderReportHtml(findings: Findings, graceDays: number): string {
  const expired = getCriticalCount(findings)
  const expiring = getWarningCount(findings)
  const sev = severityFor(expired, expiring)
  const now = new Date()
  const org = findings.organizationInfo?.displayName ?? ''
  const orgSafe = escapeHtml(org)
  const { expiringSoon, recentlyExpired, longExpired } = partitionByAge(findings, graceDays)
  const hasIssues =
    expiringSoon.length + recentlyExpired.length + longExpired.length > 0 ||
    findings.selfMonitoringAlerts.length > 0
  const dateLabel = formatDateEST(now)

  let body = ''
  if (!hasIssues) {
    body = calloutCard(
      'ok',
      'All clear',
      'Every application credential is healthy. No expired or expiring secrets or certificates were found.',
    )
  } else {
    body += selfMonitoringBlock(findings.selfMonitoringAlerts)
    if (expiringSoon.length > 0) {
      body += eyebrow('Expiring soon', expiringSoon.length, 'warn')
      body += dataTable(expiringSoon, 'warn')
    }
    if (recentlyExpired.length > 0) {
      body += eyebrow('Recently expired', recentlyExpired.length, 'danger')
      body += dataTable(recentlyExpired, 'danger')
    }
    if (longExpired.length > 0) {
      body += longExpiredTable(longExpired)
    }
  }

  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Entra ID Security Report — ${orgSafe}</title>
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap');
    body { margin:0; padding:0; background:${COLOR.page}; -webkit-text-size-adjust:100%; }
    table { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }
    .t-td { font-family:${FONT_SANS}; font-size:13px; color:${COLOR.text2}; border-bottom:1px solid ${COLOR.borderSoft}; vertical-align:middle; }
    .t-th { font-family:${FONT_MONO}; font-size:10px; font-weight:500; letter-spacing:1px; text-transform:uppercase; color:${COLOR.text3}; text-align:left; border-bottom:1px solid ${COLOR.border}; }
    .mono { font-family:${FONT_MONO}; }
    .app { color:${COLOR.text}; font-weight:500; text-decoration:none; }
    .app:hover { color:${COLOR.link} !important; }
    .row:hover td { background:#F7F7F8 !important; }
    @media (max-width:620px) {
      .card { width:100% !important; border-radius:0 !important; }
      .pad { padding-left:22px !important; padding-right:22px !important; }
      .stat-num { font-size:34px !important; }
      .title { font-size:26px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${COLOR.page};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader(findings))}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;background:${COLOR.page};">
    <tr>
      <td align="center" style="padding:44px 18px;">
        <!--[if mso]><table role="presentation" width="640" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" class="card" style="width:640px;max-width:640px;background:${COLOR.card};border:1px solid ${COLOR.border};border-radius:14px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,0.03), 0 12px 32px -8px rgba(0,0,0,0.08);">

          <!-- severity rule (solid bgcolor fallback for Outlook; gradient enhances elsewhere) -->
          <tr><td height="3" bgcolor="${SEV[sev].color}" style="height:3px;font-size:0;line-height:0;background:linear-gradient(90deg, transparent, ${SEV[sev].color}, transparent);">&nbsp;</td></tr>

          <!-- Header -->
          <tr>
            <td class="pad" style="padding:34px 40px 30px;border-bottom:1px solid ${COLOR.border};">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;"><tr>
                <td class="mono" style="vertical-align:middle;font-size:11px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:${COLOR.text2};">
                  <span style="display:inline-block;width:8px;height:8px;background:${COLOR.text};vertical-align:middle;margin-right:9px;">&nbsp;</span>Peculiar Cloud
                </td>
                <td align="right" class="mono" style="vertical-align:middle;font-size:11px;color:${COLOR.text3};">${dateLabel}</td>
              </tr></table>
              <h1 class="title" style="margin:22px 0 0;font-family:${FONT_SANS};font-size:30px;font-weight:600;letter-spacing:-1px;line-height:1.08;color:${COLOR.text};mso-line-height-rule:exactly;">Entra ID Security Report</h1>
              ${org ? `<p style="margin:9px 0 0;font-family:${FONT_SANS};font-size:15px;color:${COLOR.text2};">${orgSafe}</p>` : ''}
              ${statusPill(sev)}
            </td>
          </tr>

          <!-- Lead -->
          <tr>
            <td class="pad" style="padding:22px 40px;border-bottom:1px solid ${COLOR.border};">
              <p style="margin:0;font-family:${FONT_SANS};font-size:15px;line-height:1.6;color:${COLOR.text2};">${leadSentence(findings)}</p>
            </td>
          </tr>

          <!-- Stats -->
          <tr>
            <td style="background:${COLOR.raised};border-bottom:1px solid ${COLOR.border};">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;"><tr>
                ${statCell(expired, 'Expired', SEV.danger.color, false)}
                ${statCell(expiring, 'Expiring', SEV.warn.color, true)}
                ${statCell(getTotalApps(findings), plural(getTotalApps(findings), 'Application', 'Applications'), COLOR.text, true)}
              </tr></table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td class="pad" style="padding:6px 40px 36px;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="pad" style="padding:24px 40px 30px;border-top:1px solid ${COLOR.border};background:${COLOR.raised};">
              <span class="mono" style="font-size:11px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:${COLOR.text2};">
                <span style="display:inline-block;width:7px;height:7px;background:${COLOR.text3};vertical-align:middle;margin-right:8px;">&nbsp;</span>Peculiar Cloud
              </span>
              <p style="margin:12px 0 0;font-family:${FONT_SANS};font-size:12px;line-height:1.6;color:${COLOR.text3};">Automated Entra ID security monitoring</p>
              <p class="mono" style="margin:4px 0 0;font-size:11px;color:${COLOR.text3};">Generated ${dateLabel} at ${formatTimeEST(now)} · <a href="${getBrandUrl()}" style="color:${COLOR.text2};text-decoration:none;">peculiar.cloud</a></p>
            </td>
          </tr>

        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`
}
