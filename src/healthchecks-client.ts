/**
 * Healthchecks.io client.
 *
 * Sends start/success/fail pings to monitor the cron job. Pings never throw:
 * healthchecks.io being unreachable must not fail the monitoring run.
 */

import { consoleLogger, type Logger } from './logger.js'

const MAX_FAIL_BODY_LENGTH = 500
const PING_TIMEOUT_MS = 10_000

export class HealthchecksClient {
  private readonly enabled: boolean
  private readonly pingUrl: string | undefined
  private readonly logger: Logger

  constructor(slug: string | undefined, logger: Logger = consoleLogger) {
    this.logger = logger
    this.enabled = !!slug && slug.trim().length > 0
    if (this.enabled && slug) {
      // Slug can be a bare UUID/slug or a full URL.
      this.pingUrl =
        slug.startsWith('http://') || slug.startsWith('https://')
          ? slug
          : `https://hc-ping.com/${slug}`
    }
  }

  /**
   * Send a ping. Resolves (never rejects) even if healthchecks.io is down, so a
   * monitoring outage in the pinger can't fail the monitoring job itself.
   */
  async ping(endpoint: string = '', body: string | null = null): Promise<void> {
    if (!this.enabled || !this.pingUrl) {
      return
    }

    try {
      const response = await fetch(`${this.pingUrl}${endpoint}`, {
        method: body ? 'POST' : 'GET',
        headers: body ? { 'Content-Type': 'text/plain' } : undefined,
        body: body ?? undefined,
        signal: AbortSignal.timeout(PING_TIMEOUT_MS),
      })
      if (!response.ok) {
        this.logger.warn(`Healthchecks.io ping failed with status ${response.status}`)
      }
    } catch (error) {
      this.logger.warn({ err: error }, 'Healthchecks.io ping error')
    }
  }

  async start(): Promise<void> {
    if (!this.enabled) return
    this.logger.info('Sending start ping to healthchecks.io...')
    await this.ping('/start')
  }

  async success(): Promise<void> {
    if (!this.enabled) return
    this.logger.info('Sending success ping to healthchecks.io...')
    await this.ping('')
  }

  /**
   * Signal failure. Sends only a truncated error message, never the stack, to
   * this third-party endpoint; the full stack stays in runner logs.
   */
  async fail(error: Error | null): Promise<void> {
    if (!this.enabled) return
    this.logger.info('Sending failure ping to healthchecks.io...')
    const message = error?.message ? error.message.slice(0, MAX_FAIL_BODY_LENGTH) : 'Unknown error'
    await this.ping('/fail', message)
  }
}
