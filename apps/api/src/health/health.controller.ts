import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  async check() {
    const startTime = Date.now();

    try {
      await this.database.$queryRaw`SELECT 1`;
      const dbLatency = Date.now() - startTime;

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: {
          status: 'connected',
          latency: dbLatency,
        },
        memory: {
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
          heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        database: {
          status: 'disconnected',
          error: errorMessage,
        },
      };
    }
  }

  @Get('ready')
  async ready() {
    try {
      await this.database.$queryRaw`SELECT 1`;
      return { status: 'ready' };
    } catch {
      throw new Error('Service non prêt');
    }
  }

  @Get('live')
  live() {
    return { status: 'alive' };
  }
}
