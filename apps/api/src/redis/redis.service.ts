import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: RedisClientType | null = null;
  private enabled = false;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('REDIS_URL');
    if (!url) {
      this.logger.warn('REDIS_URL manquant, cache Redis desactive.');
      return;
    }

    this.client = createClient({ url });
    this.enabled = true;
  }

  async onModuleInit() {
    if (!this.enabled || !this.client) {
      return;
    }

    this.client.on('error', (error) => {
      this.logger.error('Erreur Redis', error);
    });

    try {
      await this.client.connect();
      this.logger.log('Redis connecte');
    } catch (error) {
      this.logger.error('Connexion Redis impossible, cache desactive.', error);
      this.enabled = false;
      this.client = null;
    }
  }

  async onModuleDestroy() {
    if (!this.client || !this.client.isOpen) return;
    await this.client.quit();
  }

  async get(key: string) {
    if (!this.client || !this.client.isOpen) return null;
    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger.warn(`Redis GET impossible: ${key}`);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    if (!this.client || !this.client.isOpen) return;
    try {
      if (ttlSeconds) {
        await this.client.set(key, value, { EX: ttlSeconds });
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      this.logger.warn(`Redis SET impossible: ${key}`);
    }
  }

  async del(key: string) {
    if (!this.client || !this.client.isOpen) return;
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.warn(`Redis DEL impossible: ${key}`);
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      this.logger.warn(`Redis JSON invalide: ${key}`);
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds?: number) {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }
}
