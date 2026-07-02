import { describe, expect, it, vi } from 'vitest'
import { createLogger } from './logger.js'

function memoryDestination() {
  const lines: string[] = []
  return {
    lines,
    destination: {
      write: vi.fn((line: string) => {
        lines.push(line)
      }),
    },
  }
}

describe('createLogger', () => {
  it('uses pino and emits structured JSON logs', () => {
    const target = memoryDestination()
    const logger = createLogger('info', target.destination)

    logger.info('hello')

    expect(target.lines).toHaveLength(1)
    expect(JSON.parse(target.lines[0] ?? '{}')).toMatchObject({
      level: 'info',
      msg: 'hello',
    })
  })

  it('respects the configured log level', () => {
    const target = memoryDestination()
    const logger = createLogger('warn', target.destination)

    logger.info('info')
    logger.warn('warn')

    expect(target.lines).toHaveLength(1)
    expect(JSON.parse(target.lines[0] ?? '{}')).toMatchObject({
      level: 'warn',
      msg: 'warn',
    })
  })
})
