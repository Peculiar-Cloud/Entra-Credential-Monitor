/**
 * GitHub Actions logging utilities
 * Provides nice output formatting when running in GitHub Actions
 */

import { appendFileSync } from 'node:fs'

const isGitHubActions = !!process.env.GITHUB_ACTIONS

/**
 * GitHub Actions workflow commands for nice output
 */
export const actions = {
  /**
   * Start a collapsible group in the log
   */
  startGroup(name: string): void {
    if (isGitHubActions) {
      console.log(`::group::${name}`)
    } else {
      console.log(`\n${'─'.repeat(50)}`)
      console.log(`▶ ${name}`)
      console.log(`${'─'.repeat(50)}`)
    }
  },

  /**
   * End a collapsible group
   */
  endGroup(): void {
    if (isGitHubActions) {
      console.log('::endgroup::')
    }
  },

  /**
   * Create a notice annotation
   */
  notice(message: string, title?: string): void {
    if (isGitHubActions) {
      const titlePart = title ? `title=${title}::` : ''
      console.log(`::notice ${titlePart}${message}`)
    } else {
      console.log(`ℹ️  ${title ? `[${title}] ` : ''}${message}`)
    }
  },

  /**
   * Create a warning annotation
   */
  warning(message: string, title?: string): void {
    if (isGitHubActions) {
      const titlePart = title ? `title=${title}::` : ''
      console.log(`::warning ${titlePart}${message}`)
    } else {
      console.log(`⚠️  ${title ? `[${title}] ` : ''}${message}`)
    }
  },

  /**
   * Create an error annotation
   */
  error(message: string, title?: string): void {
    if (isGitHubActions) {
      const titlePart = title ? `title=${title}::` : ''
      console.log(`::error ${titlePart}${message}`)
    } else {
      console.log(`❌ ${title ? `[${title}] ` : ''}${message}`)
    }
  },

  /**
   * Write to the GitHub Actions step summary
   */
  writeSummary(markdown: string): void {
    const summaryFile = process.env.GITHUB_STEP_SUMMARY
    if (summaryFile) {
      appendFileSync(summaryFile, `${markdown}\n`)
    }
  },
}
