import pino, { type DestinationStream, type Logger as PinoLogger } from 'pino'

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error', 'silent'] as const

export type LogLevel = (typeof LOG_LEVELS)[number]

export type Logger = Pick<PinoLogger, 'debug' | 'info' | 'warn' | 'error'>

export function createLogger(level: LogLevel = 'info', destination?: DestinationStream): Logger {
  const logger = pino(
    {
      level,
      base: undefined,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => ({ level: label }),
      },
    },
    destination,
  )

  return logger
}

export const consoleLogger = createLogger()
