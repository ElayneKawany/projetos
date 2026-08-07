import pino from 'pino'

const isDev = process.env.NODE_ENV !== 'production'

const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
    base: { service: 'megag-pmo' },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  isDev
    ? pino.transport({ target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } })
    : undefined
)

export default logger

// Helpers pré-vinculados por domínio
export const authLogger    = logger.child({ module: 'auth' })
export const apiLogger     = logger.child({ module: 'api' })
export const dbLogger      = logger.child({ module: 'db' })
export const cronogramaLogger = logger.child({ module: 'cronograma' })
