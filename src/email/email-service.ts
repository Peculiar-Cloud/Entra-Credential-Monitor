import { Resend } from 'resend'
import { consoleLogger, type Logger } from '../logger.js'
import type { EnvConfig, Findings } from '../schemas.js'
import { resolveErrorRecipients, resolveReportRecipients } from './recipients.js'
import { generateReport, hasAnyIssues } from './templates/index.js'

/**
 * Marks a failure as originating in the email layer. The top-level error path
 * checks this flag and skips trying to email a notification about a failed
 * email. A real Error subclass so `instanceof EmailError` narrows correctly.
 */
export class EmailError extends Error {
  readonly emailError = true

  constructor(message: string) {
    super(message)
    this.name = 'EmailError'
  }
}

type EmailEnv = Pick<
  EnvConfig,
  | 'RESEND_API_KEY'
  | 'SENDER_EMAIL'
  | 'EMAIL_RECIPIENTS'
  | 'ALWAYS_SEND_REPORT'
  | 'EXPIRED_GRACE_DAYS'
  | 'REPORT_TIMEZONE'
  | 'REPORT_BRAND_NAME'
  | 'REPORT_BRAND_URL'
>

function createEmailError(message: string): EmailError {
  return new EmailError(message)
}

function ensureSenderEmail(env: EmailEnv): string {
  const sender = env.SENDER_EMAIL?.trim()
  if (!sender) {
    throw createEmailError('SENDER_EMAIL is not configured')
  }
  return sender
}

function createResendClient(env: EmailEnv): Resend {
  if (!env.RESEND_API_KEY) {
    throw createEmailError('RESEND_API_KEY is not configured')
  }
  return new Resend(env.RESEND_API_KEY)
}

export async function sendMonitoringReport(
  env: EmailEnv,
  findings: Findings,
  logger: Logger = consoleLogger,
): Promise<boolean> {
  const recipients = resolveReportRecipients(env, findings, logger)
  if (recipients.length === 0) {
    // An empty recipient list is only a legitimate skip when there was nothing
    // to send. If the report carries issues (or ALWAYS_SEND_REPORT is set),
    // having no recipients is a misconfiguration that must fail loudly rather
    // than letting expired credentials go undelivered on a green run.
    if (hasAnyIssues(findings) || env.ALWAYS_SEND_REPORT) {
      throw createEmailError('EMAIL_RECIPIENTS is empty but the report has issues to deliver')
    }
    return false
  }

  const sender = ensureSenderEmail(env)
  const resend = createResendClient(env)
  const emailContent = generateReport(findings, {
    graceDays: env.EXPIRED_GRACE_DAYS,
    timezone: env.REPORT_TIMEZONE,
    brand: {
      name: env.REPORT_BRAND_NAME,
      url: env.REPORT_BRAND_URL,
    },
  })

  logger.info(`Sending email to ${recipients.length} recipient(s)`)
  logger.info(`Subject: ${emailContent.subject}`)

  const { error } = await resend.emails.send({
    from: sender,
    to: recipients,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
  })

  if (error) {
    throw createEmailError(`Failed to send report: ${error.message}`)
  }

  return true
}

export async function sendErrorNotification(
  env: EmailEnv,
  subject: string,
  htmlBody: string,
  textBody: string,
  logger: Logger = consoleLogger,
): Promise<boolean> {
  const recipients = resolveErrorRecipients(env, logger)
  if (recipients.length === 0) {
    return false
  }

  const sender = ensureSenderEmail(env)
  const resend = createResendClient(env)
  logger.info('Sending error notification')

  const { error } = await resend.emails.send({
    from: sender,
    to: recipients,
    subject,
    html: htmlBody,
    text: textBody,
  })

  if (error) {
    throw createEmailError(`Failed to send error notification: ${error.message}`)
  }

  return true
}
