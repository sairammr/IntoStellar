/**
 * @fileoverview Logging utility for the Fusion+ Relayer Service
 */

import winston from "winston";
import { Config } from "../config/Config";

/**
 * Singleton logger class using Winston
 */
export class Logger {
  private static instance: Logger;
  private logger: winston.Logger;

  private constructor() {
    const config = Config.getInstance().logging;

    const formats = [
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
    ];

    if (config.format === "json") {
      formats.push(winston.format.json());
    } else {
      formats.push(winston.format.colorize(), winston.format.simple());
    }

    this.logger = winston.createLogger({
      level: config.level,
      format: winston.format.combine(...formats),
      defaultMeta: { service: "fusion-plus-relayer" },
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({
          filename: "logs/error.log",
          level: "error",
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
        new winston.transports.File({
          filename: "logs/combined.log",
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
      ],
    });

    // Create logs directory if it doesn't exist
    const fs = require("fs");
    if (!fs.existsSync("logs")) {
      fs.mkdirSync("logs");
    }
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Log debug message
   */
  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  /**
   * Log info message
   */
  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  /**
   * Log warning message
   */
  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  /**
   * Log error message
   */
  error(message: string, error?: any): void {
    if (error instanceof Error) {
      this.logger.error(message, {
        error: error.message,
        stack: error.stack,
      });
    } else {
      this.logger.error(message, { error });
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, any>): winston.Logger {
    return this.logger.child(context);
  }

  /**
   * Set log level at runtime
   */
  setLevel(level: string): void {
    this.logger.level = level;
  }
}
