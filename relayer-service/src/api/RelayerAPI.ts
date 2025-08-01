/**
 * @fileoverview REST API for the Fusion+ Relayer Service
 */

import express from "express";
import cors from "cors";
import { Logger } from "../utils/Logger";

import { RelayerService } from "../services/RelayerService";

export interface RelayerAPIConfig {
  port: number;
  corsOrigin?: string;
}

/**
 * REST API server for monitoring and controlling the relayer service
 */
export class RelayerAPI {
  private app: express.Application;
  private logger = Logger.getInstance();

  private relayerService: RelayerService;
  private server?: any;

  constructor(relayerService: RelayerService) {
    this.relayerService = relayerService;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    this.app.use(
      cors({
        origin: process.env.CORS_ORIGIN || "http://localhost:3000",
      })
    );
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, _res, next) => {
      this.logger.debug(`${req.method} ${req.path}`, {
        body: req.body,
        query: req.query,
      });
      next();
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get("/health", (_req, res) => {
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || "1.0.0",
        uptime: process.uptime(),
      });
    });

    // Service status
    this.app.get("/status", (_req, res) => {
      const stats = this.relayerService.getStats();
      res.json({
        ...stats,
        timestamp: new Date().toISOString(),
      });
    });

    // Get all active swaps
    this.app.get("/swaps", (_req, res) => {
      const swaps = this.relayerService.getActiveSwaps();
      res.json({
        swaps,
        count: swaps.length,
        timestamp: new Date().toISOString(),
      });
    });

    // Get specific swap by hash lock
    this.app.get("/swaps/:hashLock", (req, res) => {
      const { hashLock } = req.params;
      const swap = this.relayerService.getSwap(hashLock);

      if (!swap) {
        return res.status(404).json({
          error: "Swap not found",
          hashLock,
        });
      }

      return res.json(swap);
    });

    // Admin endpoint: Manually trigger escrow creation
    this.app.post("/trigger-escrow", async (req, res) => {
      try {
        const { chain, hashLock, maker, taker, token, amount } = req.body;

        if (!chain || !hashLock || !maker || !taker || !token || !amount) {
          return res.status(400).json({
            error: "Missing required parameters",
          });
        }

        // This would trigger the relayer to create an escrow on the specified chain
        // Implementation depends on your specific needs
        this.logger.info("Manual escrow trigger requested", {
          chain,
          hashLock,
          maker,
        });

        return res.json({
          success: true,
          message: "Escrow creation triggered",
          hashLock,
        });
      } catch (error) {
        this.logger.error("Error triggering escrow:", error);
        return res.status(500).json({
          error: "Internal server error",
        });
      }
    });

    // Admin endpoint: Manually reveal secret
    this.app.post("/reveal-secret", async (req, res) => {
      try {
        const { hashLock, secret } = req.body;

        if (!hashLock || !secret) {
          return res.status(400).json({
            error: "Missing hashLock or secret",
          });
        }

        // This would manually reveal a secret for a swap
        const result = await this.relayerService.manualSecretReveal(
          hashLock,
          secret
        );

        return res.json({
          success: true,
          message: "Secret revealed",
          hashLock,
          result,
        });
      } catch (error) {
        this.logger.error("Error revealing secret:", error);
        return res.status(500).json({
          error:
            error instanceof Error ? error.message : "Internal server error",
        });
      }
    });

    // Error handling middleware
    this.app.use(
      (
        error: any,
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction
      ) => {
        this.logger.error("API Error:", error);
        res.status(500).json({
          error: "Internal server error",
          timestamp: new Date().toISOString(),
        });
      }
    );

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: "Not found",
        path: req.path,
      });
    });
  }

  /**
   * Start the API server
   */
  async start(port: number = 3000): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(port, () => {
        this.logger.info(`🌐 Relayer API started on port ${port}`);
        resolve();
      });

      this.server.on("error", (error: any) => {
        this.logger.error("Failed to start API server:", error);
        reject(error);
      });
    });
  }

  /**
   * Stop the API server
   */
  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          this.logger.info("API server stopped");
          resolve();
        });
      });
    }
  }
}
