/**
 * Render a fake-data example report for README/docs screenshots.
 *
 * This uses the production HTML renderer, but every finding is synthetic.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { format } from 'date-fns'
import { renderReportHtml } from '../src/email/templates/report-html.js'
import type { CredentialFinding, Findings } from '../src/schemas.js'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const out = join(root, 'docs', 'example-report.html')

function isoDate(daysFromNow: number): string {
  const date = new Date('2026-07-02T12:00:00.000Z')
  date.setUTCDate(date.getUTCDate() + daysFromNow)
  return format(date, 'MMMM d, yyyy')
}

function finding(overrides: Partial<CredentialFinding>): CredentialFinding {
  return {
    appId: '00000000-0000-0000-0000-000000000000',
    displayName: 'Example Application',
    keyId: '00000000-0000-0000-0000-000000000000',
    owners: 'Identity Team (identity@example.com)',
    type: 'Application',
    ...overrides,
  }
}

const findings: Findings = {
  organizationInfo: { displayName: 'Example Tenant' },
  selfMonitoringAlerts: [
    {
      type: 'WARNING',
      message: 'The monitor app credential expires soon.',
      action: 'Rotate the monitor client secret and update your scheduler secret store.',
      appName: 'Entra Credential Monitor',
      appId: '11111111-1111-1111-1111-111111111111',
      secretId: 'monitor-secret-2026',
      expiryDate: isoDate(18),
      daysUntilExpiry: 18,
    },
  ],
  expiringSecrets: [
    finding({
      appId: '22222222-2222-2222-2222-222222222222',
      displayName: 'CRM Integration',
      keyId: 'crm-secret-key',
      secretId: 'crm-secret-2026',
      expiryDate: isoDate(9),
      daysUntilExpiry: 9,
      owners: 'Revenue Operations (revops@example.com)',
    }),
    finding({
      appId: '33333333-3333-3333-3333-333333333333',
      displayName: 'Data Warehouse Loader',
      keyId: 'warehouse-loader-secret',
      secretId: 'warehouse-secret-2026',
      expiryDate: isoDate(24),
      daysUntilExpiry: 24,
      owners: 'Data Platform (data@example.com)',
    }),
  ],
  expiringCertificates: [
    finding({
      appId: '44444444-4444-4444-4444-444444444444',
      displayName: 'Payroll SSO Certificate',
      keyId: 'payroll-cert-key',
      thumbprint: 'A1B2C3D4E5F607182930',
      expiryDate: isoDate(14),
      daysUntilExpiry: 14,
      owners: 'People Systems (people@example.com)',
    }),
  ],
  expiredSecrets: [
    finding({
      appId: '55555555-5555-5555-5555-555555555555',
      displayName: 'Legacy Reporting Export',
      keyId: 'legacy-reporting-secret',
      secretId: 'legacy-reporting-2024',
      expiredDate: isoDate(-6),
      daysExpired: 6,
      owners: 'Business Intelligence (bi@example.com)',
    }),
    finding({
      appId: '66666666-6666-6666-6666-666666666666',
      displayName: 'Retired Sandbox Automation',
      keyId: 'sandbox-secret-key',
      secretId: 'sandbox-secret-2023',
      expiredDate: isoDate(-143),
      daysExpired: 143,
      owners: 'No owners assigned',
    }),
  ],
  expiredCertificates: [
    finding({
      appId: '77777777-7777-7777-7777-777777777777',
      displayName: 'Vendor API Certificate',
      keyId: 'vendor-api-cert-key',
      thumbprint: '99887766554433221100',
      expiredDate: isoDate(-2),
      daysExpired: 2,
      type: 'ServicePrincipal',
      owners: 'Platform Engineering (platform@example.com)',
    }),
  ],
}

await mkdir(dirname(out), { recursive: true })
await writeFile(out, renderReportHtml(findings, 90), 'utf8')
console.log(out)
