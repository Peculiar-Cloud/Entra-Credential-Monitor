/**
 * Local preview harness for the PRODUCTION report renderer.
 *
 * Scans a real Entra tenant and writes exactly what ships (src/email/templates/
 * report-html.ts) to ~/Downloads, so the preview can never drift from the sent
 * email. With a plain local env file:
 *
 *   pnpm exec tsx --env-file=.env.local scripts/redesign-preview.mts
 *
 * Or with a secret manager that injects environment variables:
 *
 *   op run --env-file=.env.shared --env-file=.env.tenant -- \
 *     pnpm exec tsx scripts/redesign-preview.mts
 */

import { writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { getCriticalCount, getTotalApps, getWarningCount } from '../src/email/templates/helpers.js'
import { renderReportHtml } from '../src/email/templates/report-html.js'
import { GraphClient } from '../src/graph-client.js'
import { AppRegistrationMonitor } from '../src/monitor/index.js'
import type { Findings } from '../src/schemas.js'
import { loadEnv, parseTenantConfigs } from '../src/schemas.js'

async function main(): Promise<void> {
  const env = loadEnv()
  const tenants = parseTenantConfigs(env)
  if (tenants.length === 0) {
    throw new Error(
      'No tenant configured. Run under op with both env files, e.g.\n' +
        '  pnpm exec tsx --env-file=.env.local scripts/redesign-preview.mts',
    )
  }

  const [tenant] = tenants
  if (!tenant) {
    throw new Error('No tenant configured')
  }
  console.log(`Scanning tenant: ${tenant.name}`)

  const graphClient = new GraphClient(tenant.tenantId, tenant.clientId, tenant.clientSecret)
  const monitor = new AppRegistrationMonitor(graphClient, env.WARNING_DAYS)
  const findings = (await monitor.scanApplications({
    ...env,
    ENTRA_CLIENT_ID: tenant.clientId,
  })) as Findings

  const html = renderReportHtml(findings, env.EXPIRED_GRACE_DAYS)

  const slug = tenant.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  const stamp = new Date().toISOString().slice(0, 10)
  const out = join(homedir(), 'Downloads', `entra-report-redesign-${slug}-${stamp}.html`)
  await writeFile(out, html, 'utf8')

  const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1)
  console.log(`\nExpired:  ${getCriticalCount(findings)}`)
  console.log(`Expiring: ${getWarningCount(findings)}`)
  console.log(`Apps:     ${getTotalApps(findings)}`)
  console.log(`Size:     ${kb} KB (Gmail clips > ~102 KB)`)
  console.log(`\nWrote production-renderer preview to:\n  ${out}`)
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exitCode = 1
})
