import type { Owner } from '../schemas.js'

export interface OrganizationInfo {
  displayName: string
  primaryDomain: string
}

interface VerifiedDomain {
  isDefault?: boolean
  name?: string
}

type AnyOrganizationResponse =
  | { value?: Array<{ displayName?: string; verifiedDomains?: unknown[] }> }
  | null
  | undefined

function isVerifiedDomain(domain: unknown): domain is VerifiedDomain {
  return typeof domain === 'object' && domain !== null
}

export function formatOwners(owners: Owner[] | undefined | null): string {
  if (!owners || owners.length === 0) {
    return 'No owners assigned'
  }

  return owners
    .map((owner) => {
      if (owner.userPrincipalName) {
        return `${owner.displayName} (${owner.userPrincipalName})`
      }
      return owner.displayName || 'Unknown'
    })
    .join(', ')
}

export function formatOrganizationInfo(organization: AnyOrganizationResponse): OrganizationInfo {
  if (!organization?.value || organization.value.length === 0) {
    return {
      displayName: 'Unknown Organization',
      primaryDomain: 'unknown.domain',
    }
  }

  const org = organization.value[0]
  if (!org) {
    return {
      displayName: 'Unknown Organization',
      primaryDomain: 'unknown.domain',
    }
  }
  const domains = org.verifiedDomains?.filter(isVerifiedDomain) ?? []
  const primaryDomain =
    domains.find((domain) => domain.isDefault)?.name || domains[0]?.name || 'unknown.domain'

  return {
    displayName: org.displayName || 'Unknown Organization',
    primaryDomain,
  }
}
