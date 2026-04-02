import { dirname } from 'node:path';
import pino from 'pino';

const isDev = process.env.NODE_ENV === 'development';
const logLevel = process.env.LOG_LEVEL ?? 'info';
const logFile = process.env.LOG_FILE ?? 'logs/social-server.log';

const transport = pino.transport({
  targets: [
    {
      target: 'pino/file',
      level: logLevel,
      options: {
        destination: logFile,
        mkdir: true,
        append: true,
      },
    },
    isDev
      ? {
          target: 'pino-pretty',
          level: logLevel,
          options: {
            colorize: true,
            singleLine: true,
            translateTime: 'SYS:standard',
          },
        }
      : {
          target: 'pino/file',
          level: logLevel,
          options: {
            destination: 1,
          },
        },
  ],
});

export const logger = pino(
  {
    level: logLevel,
    base: {
      service: 'social-server',
      env: process.env.NODE_ENV ?? 'development',
      logFileDir: dirname(logFile),
    },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'authorization',
        'token',
        'password',
      ],
      remove: true,
    },
  },
  transport,
);

export function withBindings(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}