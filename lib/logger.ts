import pino from 'pino'
import pretty from 'pino-pretty'

const isDev = process.env.NODE_ENV !== 'production'

// Usa o stream síncrono do pino-pretty em vez de pino.transport() (worker thread):
// dentro do bundle do Next.js o worker thread do transport não resolve o módulo
// corretamente e derruba o processo ("the worker has exited") a cada log de erro.
const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
    base: { service: 'megag-pmo' },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  isDev
    ? pretty({ colorize: true, translateTime: 'SYS:HH:MM:ss' })
    : undefined
)

export default logger

// Helpers pré-vinculados por domínio
export const authLogger    = logger.child({ module: 'auth' })
export const apiLogger     = logger.child({ module: 'api' })
export const dbLogger      = logger.child({ module: 'db' })
export const cronogramaLogger = logger.child({ module: 'cronograma' })
