import winston from 'winston';
import path from 'path';
import fs from 'fs';

const logDir = process.env.LOG_DIR || './logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logLevel = process.env.LOG_LEVEL || 'info';

const { combine, timestamp, colorize, printf, json } = winston.format;

const consoleFormat = printf(({ level, message, timestamp: ts, module: mod, ...meta }) => {
  const modStr = mod ? `[${mod}] ` : '';
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${ts} ${level}: ${modStr}${message}${metaStr}`;
});

const logger = winston.createLogger({
  level: logLevel,
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), json()),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'HH:mm:ss' }),
        consoleFormat
      ),
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'app.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});

const auditLogger = winston.createLogger({
  level: 'info',
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), json()),
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'audit.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 10,
    }),
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), consoleFormat),
    }),
  ],
  defaultMeta: { module: 'audit' },
});

const moderationLogger = winston.createLogger({
  level: 'info',
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), json()),
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'moderation.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 10,
    }),
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), consoleFormat),
    }),
  ],
  defaultMeta: { module: 'moderation' },
});

const contentLogger = winston.createLogger({
  level: 'info',
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), json()),
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'content.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 10,
    }),
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), consoleFormat),
    }),
  ],
  defaultMeta: { module: 'content' },
});

const appLogger = logger.child({ module: 'app' });

export { logger, appLogger, auditLogger, moderationLogger, contentLogger };
export default logger;
