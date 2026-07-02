import { differenceInDays, format, parseISO } from 'date-fns'
import type { Application, Credential, Owner, ServicePrincipal } from '../schemas.js'
import type { PartialFindings } from './findings.js'
import { formatOwners } from './formatters.js'

interface Entity {
  appId: string
  displayName: string
  owners?: Owner[]
}

interface CredentialBearing {
  passwordCredentials?: (Credential & { customKeyIdentifier?: string })[]
  keyCredentials?: (Credential & { customKeyIdentifier?: string })[]
}

type EntityType = 'Application' | 'ServicePrincipal'
type CredentialKind = 'secret' | 'certificate'

/**
 * Classify a single credential and, if expired or expiring within the warning
 * window, push a finding into the right bucket.
 *
 * An unparseable endDateTime yields NaN from differenceInDays; rather than
 * letting it fall through both comparisons and vanish from the report, it is
 * surfaced as expired/critical with an explicit marker.
 */
function classifyCredential(
  entity: Entity,
  credential: Credential & { customKeyIdentifier?: string },
  kind: CredentialKind,
  warningDays: number,
  type: EntityType,
  findings: PartialFindings,
): void {
  const expiryDate = parseISO(credential.endDateTime)
  const daysUntilExpiry = differenceInDays(expiryDate, new Date())

  const base = {
    appId: entity.appId,
    displayName: entity.displayName,
    keyId: credential.keyId,
    owners: formatOwners(entity.owners),
    type,
    ...(kind === 'secret'
      ? { secretId: credential.keyId }
      : { thumbprint: credential.customKeyIdentifier }),
  }

  const expiredBucket = kind === 'secret' ? findings.expiredSecrets : findings.expiredCertificates
  const expiringBucket =
    kind === 'secret' ? findings.expiringSecrets : findings.expiringCertificates

  if (Number.isNaN(daysUntilExpiry)) {
    expiredBucket.push({ ...base, expiredDate: 'unparseable date' })
    return
  }

  if (daysUntilExpiry < 0) {
    expiredBucket.push({
      ...base,
      expiredDate: format(expiryDate, 'yyyy-MM-dd'),
      daysExpired: Math.abs(daysUntilExpiry),
    })
  } else if (daysUntilExpiry <= warningDays) {
    expiringBucket.push({ ...base, expiryDate: format(expiryDate, 'yyyy-MM-dd'), daysUntilExpiry })
  }
}

function analyzeEntity(entity: Entity & CredentialBearing, warningDays: number, type: EntityType) {
  const findings: PartialFindings = {
    expiringSecrets: [],
    expiredSecrets: [],
    expiringCertificates: [],
    expiredCertificates: [],
  }

  for (const secret of entity.passwordCredentials ?? []) {
    classifyCredential(entity, secret, 'secret', warningDays, type, findings)
  }
  for (const certificate of entity.keyCredentials ?? []) {
    classifyCredential(entity, certificate, 'certificate', warningDays, type, findings)
  }

  return findings
}

interface AnalyzeAppParams {
  app: Application
  warningDays: number
}

export async function analyzeApplicationCredentials({
  app,
  warningDays,
}: AnalyzeAppParams): Promise<PartialFindings> {
  return analyzeEntity(app, warningDays, 'Application')
}

interface AnalyzeSPParams {
  sp: ServicePrincipal
  warningDays: number
}

export async function analyzeServicePrincipalCredentials({
  sp,
  warningDays,
}: AnalyzeSPParams): Promise<PartialFindings> {
  return analyzeEntity(sp, warningDays, 'ServicePrincipal')
}
