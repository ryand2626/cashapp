/**
 * Logger utility for production-safe logging
 * Replaces console statements to prevent sensitive data leaks
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  enableInProduction: boolean;
  enableInDevelopment: boolean;
  logToService: boolean;
}

class Logger {
  private config: LoggerConfig = {
    enableInProduction: false,
    enableInDevelopment: __DEV__,
    logToService: false,
  };

  private shouldLog(): boolean {
    if (__DEV__) {
      return this.config.enableInDevelopment;
    }
    return this.config.enableInProduction;
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  private log(level: LogLevel, message: string, ...args: any[]): void {
    if (!this.shouldLog()) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message, ...args);

    // In development, use console methods
    if (__DEV__) {
      switch (level) {
        case 'debug':
          // Debug logs are only shown in development
          if (this.config.enableInDevelopment) {
            console.log(formattedMessage, ...args);
          }
          break;
        case 'info':
          console.log(formattedMessage, ...args);
          break;
        case 'warn':
          console.warn(formattedMessage, ...args);
          break;
        case 'error':
          console.error(formattedMessage, ...args);
          break;
      }
    }

    // In production, send to logging service if configured
    if (this.config.logToService && !__DEV__) {
      // TODO: Implement sending to logging service (e.g., Sentry, LogRocket)
      // This prevents sensitive data from being logged to console in production
    }
  }

  debug(message: string, ...args: any[]): void {
    this.log('debug', message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.log('info', message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.log('warn', message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this.log('error', message, ...args);
  }

  // Method to configure logger behavior
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Export singleton instance
export const logger = new Logger();

// Export default for convenience
export default logger;
