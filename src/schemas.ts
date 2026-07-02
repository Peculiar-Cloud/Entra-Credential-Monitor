/**
 * Zod schemas for configuration and data validation
 */

import { z } from 'zod'

// Tenant configuration schema
// Using z.guid() for permissive UUID validation (Zod v4 z.uuid() is RFC-strict)
export const TenantConfigSchema = z.object({
  tenantId: z.guid('Invalid tenant ID format'),
  clientId: z.guid('Invalid client ID format'),
  clientSecret: z.string().min(1, 'Client secret is required'),
  name: z.string().default('Unnamed Tenant'),
})

export type TenantConfig = z.infer<typeof TenantConfigSchema>

// Multi-tenant configuration (JSON array)
export const TenantsConfigSchema = z.array(TenantConfigSchema)

// Environment configuration schema
export const EnvConfigSchema = z.object({
  // Multi-tenant (preferred)
  ENTRA_TENANTS: z.string().optional(),

  // Single tenant (legacy)
  ENTRA_TENANT_ID: z.string().optional(),
  ENTRA_CLIENT_ID: z.string().optional(),
  ENTRA_CLIENT_SECRET: z.string().optional(),
  ENTRA_TENANT_NAME: z.string().optional(),

  // Email configuration
  RESEND_API_KEY: z.string().optional(),
  SENDER_EMAIL: z.email().optional(),
  EMAIL_RECIPIENTS: z.string().optional(),
  TECHNICAL_CONTACT: z.email().optional(),

  // Monitoring configuration
  WARNING_DAYS: z.coerce.number().int().positive().default(30),
  SELF_MONITORING_WARNING_DAYS: z.coerce.number().int().positive().default(60),
  // Credentials expired longer than this are collapsed into a compact reference
  // table in the report rather than listed in full, so actionable items lead.
  EXPIRED_GRACE_DAYS: z.coerce.number().int().positive().default(90),
  // Accept the string form ("true"/"false") that arrives from the environment
  // and expose a real boolean, so consumers never reinvent truthiness tests.
  ALWAYS_SEND_REPORT: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // Healthchecks.io
  HEALTHCHECKS_PING_URL: z.string().optional(),
})

export type EnvConfig = z.infer<typeof EnvConfigSchema>

/**
 * Parse and validate the process environment once, at startup.
 *
 * Uses `.parse` (not `.safeParse`) deliberately: a malformed config — a
 * non-numeric WARNING_DAYS, a bad email — must abort the run loudly rather than
 * silently fall back to a default that could filter every credential out of the
 * report and produce a false "all clear".
 */
export function loadEnv(raw: Record<string, unknown> = process.env): EnvConfig {
  return EnvConfigSchema.parse(raw)
}

// Graph API response schemas.
//
// Validation is strict on the fields the analyzer consumes (keyId, endDateTime)
// and lenient on the rest: Microsoft Graph routinely returns null for optional
// string fields like `hint`, `usage`, `type`, and `startDateTime`, so those are
// nullable to avoid dropping otherwise-valid credentials over fields we ignore.
export const CredentialSchema = z.object({
  keyId: z.string(),
  displayName: z.string().nullable().optional(),
  endDateTime: z.string(),
  startDateTime: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  usage: z.string().nullable().optional(),
  hint: z.string().nullable().optional(),
})

export type Credential = z.infer<typeof CredentialSchema>

export const OwnerSchema = z.object({
  id: z.string(),
  displayName: z.string().nullable().optional(),
  userPrincipalName: z.string().nullable().optional(),
})

export type Owner = z.infer<typeof OwnerSchema>

export const ApplicationSchema = z.object({
  id: z.string(),
  appId: z.string(),
  displayName: z.string(),
  passwordCredentials: z.array(CredentialSchema).default([]),
  keyCredentials: z.array(CredentialSchema).default([]),
  createdDateTime: z.string().optional(),
  owners: z.array(OwnerSchema).default([]),
})

export type Application = z.infer<typeof ApplicationSchema>

export const ServicePrincipalSchema = z.object({
  id: z.string(),
  appId: z.string(),
  displayName: z.string(),
  passwordCredentials: z.array(CredentialSchema).default([]),
  keyCredentials: z.array(CredentialSchema).default([]),
  owners: z.array(OwnerSchema).default([]),
})

export type ServicePrincipal = z.infer<typeof ServicePrincipalSchema>

// A single expiring/expired credential finding, as produced by the analyzer.
export const CredentialFindingSchema = z.object({
  appId: z.string(),
  displayName: z.string(),
  keyId: z.string(),
  owners: z.string(),
  type: z.enum(['Application', 'ServicePrincipal']),
  // Date fields - expired findings carry expiredDate/daysExpired, expiring ones
  // carry expiryDate/daysUntilExpiry.
  expiryDate: z.string().optional(),
  expiredDate: z.string().optional(),
  daysUntilExpiry: z.number().optional(),
  daysExpired: z.number().optional(),
  // Secret vs certificate discriminators.
  secretId: z.string().optional(),
  thumbprint: z.string().optional(),
  createdDate: z.string().optional(),
  tenantName: z.string().optional(),
})

export type CredentialFinding = z.infer<typeof CredentialFindingSchema>

// Self-monitoring alerts about the monitor's own credentials. Kept in sync with
// the SelfMonitoringAlert interface produced in monitor/self-monitoring.ts.
export const SelfMonitoringAlertSchema = z.object({
  type: z.enum(['CRITICAL', 'WARNING', 'ERROR']),
  message: z.string(),
  action: z.string(),
  appName: z.string().optional(),
  appId: z.string().optional(),
  secretId: z.string().optional(),
  thumbprint: z.string().optional(),
  expiredDate: z.string().optional(),
  expiryDate: z.string().optional(),
  daysExpired: z.number().optional(),
  daysUntilExpiry: z.number().optional(),
})

export type SelfMonitoringAlert = z.infer<typeof SelfMonitoringAlertSchema>

export const FindingsSchema = z.object({
  expiredSecrets: z.array(CredentialFindingSchema),
  expiringSecrets: z.array(CredentialFindingSchema),
  expiredCertificates: z.array(CredentialFindingSchema),
  expiringCertificates: z.array(CredentialFindingSchema),
  selfMonitoringAlerts: z.array(SelfMonitoringAlertSchema),
  organizationInfo: z.object({
    displayName: z.string(),
  }),
})

export type Findings = z.infer<typeof FindingsSchema>

// Graph API Token Response
export const TokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
})

export type TokenResponse = z.infer<typeof TokenResponseSchema>

// Graph API error response
export const GraphErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    innerError: z.record(z.string(), z.unknown()).optional(),
  }),
})

export type GraphError = z.infer<typeof GraphErrorSchema>

/**
 * Helper to parse tenant configs from environment
 */
export function parseTenantConfigs(env: Partial<EnvConfig>): TenantConfig[] {
  const tenants: TenantConfig[] = []

  // JSON array format takes precedence. If the operator explicitly set
  // ENTRA_TENANTS, a parse or validation failure is fatal: silently falling
  // back to the single-tenant vars would scan a different (smaller) set of
  // tenants than configured and still report success.
  if (env.ENTRA_TENANTS) {
    let parsed: unknown
    try {
      parsed = JSON.parse(env.ENTRA_TENANTS)
    } catch (error) {
      throw new Error(
        `ENTRA_TENANTS is set but is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      )
    }
    const validated = TenantsConfigSchema.safeParse(parsed)
    if (!validated.success) {
      throw new Error(`ENTRA_TENANTS is set but failed validation: ${validated.error.message}`)
    }
    return validated.data
  }

  // Fall back to single tenant only when ENTRA_TENANTS was not provided at all.
  if (env.ENTRA_TENANT_ID && env.ENTRA_CLIENT_ID && env.ENTRA_CLIENT_SECRET) {
    const singleTenant = TenantConfigSchema.safeParse({
      tenantId: env.ENTRA_TENANT_ID,
      clientId: env.ENTRA_CLIENT_ID,
      clientSecret: env.ENTRA_CLIENT_SECRET,
      name: env.ENTRA_TENANT_NAME || 'Primary Tenant',
    })

    if (singleTenant.success) {
      tenants.push(singleTenant.data)
    } else {
      console.error('Invalid single tenant config:', singleTenant.error.message)
    }
  }

  return tenants
}
