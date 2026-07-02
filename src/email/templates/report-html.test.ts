import { describe, expect, it } from 'vitest'
import type { CredentialFinding, Findings, SelfMonitoringAlert } from '../../schemas.js'
import { renderReportHtml } from './report-html.js'

function emptyFindings(orgName = 'Acme Corp'): Findings {
  return {
    expiredSecrets: [],
    expiringSecrets: [],
    expiredCertificates: [],
    expiringCertificates: [],
    selfMonitoringAlerts: [],
    organizationInfo: { displayName: orgName },
  }
}

function expiringSecret(over: Partial<CredentialFinding> = {}): CredentialFinding {
  return {
    appId: '11111111-1111-1111-1111-111111111111',
    displayName: 'API Prod',
    keyId: 'k1',
    owners: 'Jane Doe (jane@acme.com)',
    type: 'Application',
    expiryDate: '2026-07-01',
    daysUntilExpiry: 8,
    secretId: 'abcdef012345',
    ...over,
  }
}

describe('renderReportHtml — document + all-clear', () => {
  it('emits a hardened HTML document shell', () => {
    const html = renderReportHtml(emptyFindings(), 90)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('OfficeDocumentSettings') // MSO DPI fix
    expect(html).toContain('[if mso]') // ghost-table centering
    expect(html).toContain('role="presentation"')
  })

  it('shows the all-clear state when there are no findings', () => {
    const html = renderReportHtml(emptyFindings(), 90)
    expect(html).toContain('All clear')
    expect(html).toContain('Acme Corp')
    expect(html).not.toContain('<tr class="row"')
  })

  it('escapes attacker-influenceable org names', () => {
    const html = renderReportHtml(emptyFindings('<script>alert(1)</script>'), 90)
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('uses custom report branding and timezone', () => {
    const html = renderReportHtml(emptyFindings(), {
      graceDays: 90,
      timezone: 'UTC',
      brand: { name: 'Contoso Security', url: 'https://security.contoso.example' },
    })
    expect(html).toContain('Contoso Security')
    expect(html).toContain('security.contoso.example')
    expect(html).toContain('UTC')
    expect(html).not.toContain('peculiar.cloud')
  })
})

describe('renderReportHtml — issues tables', () => {
  it('lists expiring-soon items with counts, status, and a portal link', () => {
    const f = emptyFindings()
    f.expiringSecrets = [expiringSecret()]
    const html = renderReportHtml(f, 90)
    expect(html).toContain('Expiring soon')
    expect(html).toContain('8d left')
    expect(html).toContain('API Prod')
    expect(html).toContain('portal.azure.com')
    expect(html).toContain('Review soon') // only expiring ⇒ warn severity
  })

  it('escapes a malicious application display name in a row', () => {
    const f = emptyFindings()
    f.expiringSecrets = [expiringSecret({ displayName: '<img src=x onerror=alert(1)>' })]
    const html = renderReportHtml(f, 90)
    expect(html).not.toContain('<img src=x onerror=alert(1)>')
    expect(html).toContain('&lt;img')
  })

  it('renders recently-expired (<= graceDays) in full detail with cert wording', () => {
    const f = emptyFindings()
    f.expiredCertificates = [
      {
        appId: '33333333-3333-3333-3333-333333333333',
        displayName: 'Cert App',
        keyId: 'k2',
        owners: 'No owners',
        type: 'ServicePrincipal',
        expiredDate: '2026-05-01',
        daysExpired: 20,
        thumbprint: 'AA11BB22CC33',
      },
    ]
    const html = renderReportHtml(f, 90)
    expect(html).toContain('Recently expired')
    expect(html).toContain('20d ago')
    expect(html).toContain('cert ') // certificate credential wording
    expect(html).toContain('Svc Principal')
    expect(html).toContain('Unassigned') // "No owners" → Unassigned
  })
})

describe('renderReportHtml — self-monitoring + long-expired cap', () => {
  it('renders a self-monitoring callout with an escaped action', () => {
    const f = emptyFindings()
    const alert: SelfMonitoringAlert = {
      type: 'WARNING',
      message: 'Monitor secret expiring',
      action: 'Rotate the secret',
      appName: 'Monitor App',
      appId: '22222222-2222-2222-2222-222222222222',
      daysUntilExpiry: 14,
    }
    f.selfMonitoringAlerts = [alert]
    const html = renderReportHtml(f, 90)
    expect(html).toContain('Monitor health')
    expect(html).toContain('Rotate the secret')
    expect(html).toContain('Monitor App')
  })

  it('caps the long-expired tier and shows a remainder line', () => {
    const f = emptyFindings()
    f.expiredSecrets = Array.from({ length: 40 }, (_, i) =>
      expiringSecret({
        appId: `app-${i}`,
        displayName: `Old App ${i}`,
        daysUntilExpiry: undefined,
        expiredDate: '2024-01-01',
        daysExpired: 500 + i,
      }),
    )
    const html = renderReportHtml(f, 90)
    expect(html).toContain('Long-expired')
    expect(html).toContain('15 more') // 40 − 25 cap
    expect(html).not.toContain('Old App 39') // beyond the cap
    expect(html).toContain('Old App 0')
  })
})

describe('renderReportHtml — size budget', () => {
  it("stays well under Gmail's 102KB clip threshold on a large tenant", () => {
    const f = emptyFindings()
    f.expiredSecrets = Array.from({ length: 250 }, (_, i) =>
      expiringSecret({
        appId: `a-${i}`,
        displayName: `App ${i}`,
        daysUntilExpiry: undefined,
        expiredDate: '2024-01-01',
        daysExpired: 400 + i,
      }),
    )
    const bytes = Buffer.byteLength(renderReportHtml(f, 90), 'utf8')
    expect(bytes).toBeLessThan(100_000)
  })
})
