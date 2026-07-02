import type { CredentialFinding, Findings } from '../../schemas.js'

export interface TieredFindings {
  /** Credentials expiring within the warning window (most actionable). */
  expiringSoon: CredentialFinding[]
  /** Credentials expired within the grace window (still worth full detail). */
  recentlyExpired: CredentialFinding[]
  /** Credentials expired longer ago than the grace window (collapsed in the report). */
  longExpired: CredentialFinding[]
}

/**
 * Split findings into actionable tiers by age. Long-expired credentials (older
 * than `graceDays`) are separated so the report can collapse them into a
 * compact reference table instead of burying the few actionable items.
 *
 * A finding with no parseable expiry age (daysExpired undefined, e.g. an
 * unparseable endDateTime) is treated as recently expired so it is surfaced in
 * full rather than hidden in the collapsed tier.
 */
export function partitionByAge(findings: Findings, graceDays: number): TieredFindings {
  const expiringSoon = [...findings.expiringSecrets, ...findings.expiringCertificates]
  const expired = [...findings.expiredSecrets, ...findings.expiredCertificates]

  const recentlyExpired = expired.filter((f) => (f.daysExpired ?? 0) <= graceDays)
  const longExpired = expired.filter((f) => (f.daysExpired ?? 0) > graceDays)

  return { expiringSoon, recentlyExpired, longExpired }
}
