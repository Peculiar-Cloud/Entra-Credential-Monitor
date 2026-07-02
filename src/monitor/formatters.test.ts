import { describe, expect, it } from 'vitest'
import type { Owner } from '../schemas.js'
import { formatOrganizationInfo, formatOwners } from './formatters.js'

describe('formatOwners', () => {
  it("returns 'No owners assigned' for undefined", () => {
    expect(formatOwners(undefined)).toBe('No owners assigned')
  })

  it("returns 'No owners assigned' for null", () => {
    expect(formatOwners(null)).toBe('No owners assigned')
  })

  it("returns 'No owners assigned' for empty array", () => {
    expect(formatOwners([])).toBe('No owners assigned')
  })

  it('formats single owner with displayName and userPrincipalName', () => {
    const owners: Owner[] = [
      {
        id: 'user-1',
        displayName: 'John Doe',
        userPrincipalName: 'john@example.com',
      },
    ]
    expect(formatOwners(owners)).toBe('John Doe (john@example.com)')
  })

  it('formats owner with only displayName', () => {
    const owners: Owner[] = [
      {
        id: 'user-1',
        displayName: 'John Doe',
        userPrincipalName: null,
      },
    ]
    expect(formatOwners(owners)).toBe('John Doe')
  })

  it("returns 'Unknown' for owner without displayName", () => {
    const owners: Owner[] = [
      {
        id: 'user-1',
        displayName: null,
      },
    ]
    expect(formatOwners(owners)).toBe('Unknown')
  })

  it('formats multiple owners with comma separator', () => {
    const owners: Owner[] = [
      {
        id: 'user-1',
        displayName: 'Alice',
        userPrincipalName: 'alice@example.com',
      },
      {
        id: 'user-2',
        displayName: 'Bob',
        userPrincipalName: 'bob@example.com',
      },
    ]
    expect(formatOwners(owners)).toBe('Alice (alice@example.com), Bob (bob@example.com)')
  })
})

describe('formatOrganizationInfo', () => {
  it('returns defaults for undefined organization', () => {
    const result = formatOrganizationInfo(undefined)
    expect(result).toEqual({
      displayName: 'Unknown Organization',
      primaryDomain: 'unknown.domain',
    })
  })

  it('returns defaults for null organization', () => {
    const result = formatOrganizationInfo(null)
    expect(result).toEqual({
      displayName: 'Unknown Organization',
      primaryDomain: 'unknown.domain',
    })
  })

  it('returns defaults for empty value array', () => {
    const result = formatOrganizationInfo({ value: [] })
    expect(result).toEqual({
      displayName: 'Unknown Organization',
      primaryDomain: 'unknown.domain',
    })
  })

  it('extracts displayName from organization', () => {
    const result = formatOrganizationInfo({
      value: [{ displayName: 'Contoso Ltd' }],
    })
    expect(result.displayName).toBe('Contoso Ltd')
  })

  it('returns default displayName when not provided', () => {
    const result = formatOrganizationInfo({
      value: [{ verifiedDomains: [] }],
    })
    expect(result.displayName).toBe('Unknown Organization')
  })

  it('extracts default domain from verifiedDomains', () => {
    const result = formatOrganizationInfo({
      value: [
        {
          displayName: 'Contoso',
          verifiedDomains: [
            { name: 'contoso.onmicrosoft.com', isDefault: false },
            { name: 'contoso.com', isDefault: true },
          ],
        },
      ],
    })
    expect(result.primaryDomain).toBe('contoso.com')
  })

  it('uses first domain when no default is set', () => {
    const result = formatOrganizationInfo({
      value: [
        {
          displayName: 'Contoso',
          verifiedDomains: [{ name: 'contoso.onmicrosoft.com', isDefault: false }],
        },
      ],
    })
    expect(result.primaryDomain).toBe('contoso.onmicrosoft.com')
  })

  it('returns unknown.domain when no domains available', () => {
    const result = formatOrganizationInfo({
      value: [
        {
          displayName: 'Contoso',
          verifiedDomains: [],
        },
      ],
    })
    expect(result.primaryDomain).toBe('unknown.domain')
  })
})
