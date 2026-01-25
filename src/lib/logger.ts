/**
 * Structured Logger
 *
 * Environment-aware logging utility that provides consistent log formatting
 * and can be easily extended with external services (e.g., Sentry, LogTail).
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *
 *   logger.info('User action', { userId, action: 'favorite_add' });
 *   logger.warn('Rate limit approaching', { current: 95, max: 100 });
 *   logger.error('Database query failed', { error, query });
 *
 * Log Levels:
 *   - debug: Development only, verbose debugging
 *   - info: General information (shown in production for server-side)
 *   - warn: Warning conditions (always shown)
 *   - error: Error conditions (always shown)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
}

// Environment detection
const isDevelopment = process.env.NODE_ENV === 'development';
const isServer = typeof window === 'undefined';
const isProduction = process.env.NODE_ENV === 'production';

// Log level priorities (higher = more severe)
const LOG_PRIORITIES: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Minimum log level based on environment
// In production: only warn and error on client, info+ on server
// In development: all logs
function getMinLogLevel(): LogLevel {
  if (isDevelopment) return 'debug';
  if (isServer) return 'info';
  return 'warn';
}

/**
 * Format log entry for console output
 */
function formatLogEntry(entry: LogEntry): string {
  const { level, message, timestamp, context } = entry;
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

  if (context && Object.keys(context).length > 0) {
    return `${prefix} ${message} ${JSON.stringify(context)}`;
  }

  return `${prefix} ${message}`;
}

/**
 * Determine if a log entry should be output based on current environment
 */
function shouldLog(level: LogLevel): boolean {
  const minLevel = getMinLogLevel();
  return LOG_PRIORITIES[level] >= LOG_PRIORITIES[minLevel];
}

/**
 * Serialize error objects for logging
 */
function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: isDevelopment ? error.stack : undefined,
    };
  }
  return { value: String(error) };
}

/**
 * Process context to ensure it's serializable
 */
function processContext(context?: LogContext): LogContext | undefined {
  if (!context) return undefined;

  const processed: LogContext = {};

  for (const [key, value] of Object.entries(context)) {
    if (value instanceof Error) {
      processed[key] = serializeError(value);
    } else if (typeof value === 'function') {
      processed[key] = '[Function]';
    } else if (value === undefined) {
      // Skip undefined values
      continue;
    } else {
      processed[key] = value;
    }
  }

  return Object.keys(processed).length > 0 ? processed : undefined;
}

/**
 * Core logging function
 */
function log(level: LogLevel, message: string, context?: LogContext): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context: processContext(context),
  };

  // Use appropriate console method
  const formattedMessage = formatLogEntry(entry);

  switch (level) {
    case 'debug':
      // eslint-disable-next-line no-console
      console.debug(formattedMessage);
      break;
    case 'info':
      // eslint-disable-next-line no-console
      console.info(formattedMessage);
      break;
    case 'warn':
      // eslint-disable-next-line no-console
      console.warn(formattedMessage);
      break;
    case 'error':
      // eslint-disable-next-line no-console
      console.error(formattedMessage);
      break;
  }

  // Future: Send to external logging service in production
  // if (isProduction && level === 'error') {
  //   sendToErrorTracking(entry);
  // }
}

/**
 * Structured logger instance
 */
export const logger = {
  /**
   * Debug level - Development only, verbose debugging
   * Use for detailed debugging information that's not needed in production
   */
  debug(message: string, context?: LogContext): void {
    log('debug', message, context);
  },

  /**
   * Info level - General information
   * Use for normal application flow events
   */
  info(message: string, context?: LogContext): void {
    log('info', message, context);
  },

  /**
   * Warn level - Warning conditions
   * Use for recoverable issues or unexpected but handled conditions
   */
  warn(message: string, context?: LogContext): void {
    log('warn', message, context);
  },

  /**
   * Error level - Error conditions
   * Use for errors that need attention
   */
  error(message: string, context?: LogContext): void {
    log('error', message, context);
  },

  /**
   * Log with automatic error extraction
   * Convenience method for catching errors in try/catch blocks
   */
  logError(message: string, error: unknown, additionalContext?: LogContext): void {
    log('error', message, {
      ...additionalContext,
      error: serializeError(error),
    });
  },

  /**
   * Create a child logger with preset context
   * Useful for request-scoped or component-scoped logging
   */
  child(baseContext: LogContext) {
    return {
      debug: (message: string, context?: LogContext) =>
        log('debug', message, { ...baseContext, ...context }),
      info: (message: string, context?: LogContext) =>
        log('info', message, { ...baseContext, ...context }),
      warn: (message: string, context?: LogContext) =>
        log('warn', message, { ...baseContext, ...context }),
      error: (message: string, context?: LogContext) =>
        log('error', message, { ...baseContext, ...context }),
      logError: (message: string, error: unknown, context?: LogContext) =>
        log('error', message, { ...baseContext, ...context, error: serializeError(error) }),
    };
  },
};

// Export utilities for testing
export { shouldLog, formatLogEntry, serializeError, LOG_PRIORITIES };
export type { LogLevel, LogContext, LogEntry };
