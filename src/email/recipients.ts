import type { EnvConfig, Findings } from '../schemas.js'

type EmailEnv = Pick<EnvConfig, 'EMAIL_RECIPIENTS' | 'SENDER_EMAIL'>

interface Logger {
  warn?: (message: string) => void
}

export function parseRecipients(value: string | undefined): string[] {
  if (!value) {
    return []
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

export function resolveReportRecipients(
  env: EmailEnv,
  _findings: Findings,
  logger: Logger = console,
): string[] {
  const baseRecipients = parseRecipients(env.EMAIL_RECIPIENTS)

  if (baseRecipients.length === 0) {
    logger.warn?.('EMAIL_RECIPIENTS not configured - skipping report delivery')
    return []
  }

  return baseRecipients
}

export function resolveErrorRecipients(env: EmailEnv, logger: Logger = console): string[] {
  // Send errors only to sender email - no fallback
  if (env.SENDER_EMAIL && env.SENDER_EMAIL.trim().length > 0) {
    return [env.SENDER_EMAIL.trim()]
  }

  logger.warn?.('Unable to send error notification - SENDER_EMAIL not configured')
  return []
}
