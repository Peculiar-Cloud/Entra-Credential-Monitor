/**
 * Microsoft Graph API client.
 *
 * Built on the official @azure/identity + @microsoft/microsoft-graph-client
 * SDKs. The SDK's middleware chain owns token acquisition/caching, retry with
 * exponential backoff, and 429/Retry-After handling, so this class only carries
 * the domain logic: which entities to fetch, response validation, and the
 * "actionable credentials" pre-filter.
 */

import { ClientSecretCredential } from '@azure/identity'
import {
  type AuthenticationProvider,
  Client,
  type PageCollection,
  PageIterator,
} from '@microsoft/microsoft-graph-client'
import type { z } from 'zod'

const GRAPH_SCOPE = 'https://graph.microsoft.com/.default'

import {
  type Application,
  ApplicationSchema,
  type Credential,
  type ServicePrincipal,
  ServicePrincipalSchema,
} from './schemas.js'

interface GraphApiResponse<T> {
  value: T[]
}

interface CredentialBearing {
  passwordCredentials?: Credential[]
  keyCredentials?: Credential[]
}

export class GraphClient {
  private readonly client: Client

  // The optional `client` parameter is a test seam: production constructs the
  // SDK client from the credential; tests inject a fake to drive the real
  // PageIterator without real network calls.
  constructor(tenantId: string, clientId: string, clientSecret: string, client?: Client) {
    if (client) {
      this.client = client
      return
    }

    const credential = new ClientSecretCredential(tenantId, clientId, clientSecret)
    // ClientSecretCredential caches and refreshes the token internally, so a
    // plain getToken-per-request provider keeps the single-flight/caching
    // behavior without depending on the SDK's hard-to-resolve subpath module.
    const authProvider: AuthenticationProvider = {
      getAccessToken: async () => {
        const token = await credential.getToken(GRAPH_SCOPE)
        if (!token) throw new Error('Failed to acquire a Microsoft Graph access token')
        return token.token
      },
    }
    this.client = Client.initWithMiddleware({ authProvider })
  }

  /**
   * Page through a Graph list endpoint, validating every item against `schema`.
   * Items that fail validation are counted and logged, never pushed raw or
   * silently dropped — a malformed record is surfaced, not hidden.
   */
  private async collectAll<T>(
    // The SDK's GraphRequest.get() is typed Promise<any>; narrow it here to the
    // PageCollection the PageIterator consumes so this module stays any-free.
    request: { get: () => Promise<PageCollection> },
    schema: z.ZodType<T>,
    label: string,
  ): Promise<T[]> {
    const out: T[] = []
    let skipped = 0

    const firstPage = await request.get()
    const iterator = new PageIterator(this.client, firstPage, (item) => {
      const parsed = schema.safeParse(item)
      if (parsed.success) {
        out.push(parsed.data)
      } else {
        skipped++
        console.warn(`Skipping malformed ${label} from Graph: ${parsed.error.issues[0]?.message}`)
      }
      return true
    })

    await iterator.iterate()

    if (skipped > 0) {
      console.warn(`Skipped ${skipped} malformed ${label} record(s) returned by Graph`)
    }

    return out
  }

  /**
   * True if any credential expires on or before the warning horizon. An
   * unparseable endDateTime is treated as actionable so it reaches the analyzer
   * and is surfaced, rather than being silently filtered out here.
   */
  private hasActionableCredentials(creds: Credential[] | undefined, warningDate: Date): boolean {
    if (!creds) return false
    return creds.some((cred) => {
      const expiry = new Date(cred.endDateTime)
      if (Number.isNaN(expiry.getTime())) return true
      return expiry <= warningDate
    })
  }

  private filterActionable<T extends CredentialBearing>(entities: T[], warningDays: number): T[] {
    const warningDate = new Date()
    warningDate.setDate(warningDate.getDate() + warningDays)

    return entities.filter((entity) => {
      const hasCredentials =
        (entity.passwordCredentials?.length ?? 0) > 0 || (entity.keyCredentials?.length ?? 0) > 0
      if (!hasCredentials) return false
      return (
        this.hasActionableCredentials(entity.passwordCredentials, warningDate) ||
        this.hasActionableCredentials(entity.keyCredentials, warningDate)
      )
    })
  }

  async makeRequest<T>(endpoint: string): Promise<T> {
    return (await this.client.api(endpoint).get()) as T
  }

  async getApplicationsWithCredentials(warningDays = 30): Promise<GraphApiResponse<Application>> {
    const request = this.client
      .api('/applications')
      .select('id,appId,displayName,passwordCredentials,keyCredentials,createdDateTime')
      .expand('owners($select=id,displayName,userPrincipalName)')
      .top(999)

    const all = await this.collectAll(request, ApplicationSchema, 'application')
    const filtered = this.filterActionable(all, warningDays)
    console.log(
      `Filtered from ${all.length} to ${filtered.length} applications with actionable credentials`,
    )
    return { value: filtered }
  }

  async getServicePrincipalsWithCredentials(
    warningDays = 30,
  ): Promise<GraphApiResponse<ServicePrincipal>> {
    const request = this.client
      .api('/servicePrincipals')
      .select('id,appId,displayName,passwordCredentials,keyCredentials')
      .expand('owners($select=id,displayName,userPrincipalName)')
      .top(999)

    const all = await this.collectAll(request, ServicePrincipalSchema, 'service principal')
    const filtered = this.filterActionable(all, warningDays)
    console.log(
      `Filtered from ${all.length} to ${filtered.length} service principals with actionable credentials`,
    )
    return { value: filtered }
  }

  async getOrganization(): Promise<{
    value: Array<{ displayName: string; verifiedDomains: unknown[] }>
  } | null> {
    try {
      return await this.client.api('/organization').select('displayName,verifiedDomains').get()
    } catch (error) {
      console.warn('Could not get organization info:', (error as Error).message)
      return null
    }
  }
}
