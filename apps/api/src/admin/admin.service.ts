import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ServerConfigService } from '../server-config/server-config.service';
import { UpdateConfigDto } from './dto/update-config.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly database: DatabaseService,
    private readonly serverConfig: ServerConfigService,
  ) {}

  async getConfig() {
    return this.serverConfig.getConfig();
  }

  async updateConfig(userId: string, dto: UpdateConfigDto) {
    return this.serverConfig.updateConfig(userId, dto);
  }

  async getOverview() {
    const onlineLimit = new Date(Date.now() - 15 * 60 * 1000);

    const [players, alliances, planets, onlinePlayers] = await Promise.all([
      this.database.user.count(),
      this.database.alliance.count(),
      this.database.planet.count(),
      this.database.user.count({ where: { lastActive: { gte: onlineLimit } } }),
    ]);

    return {
      players,
      alliances,
      planets,
      onlinePlayers,
      serverTime: new Date(),
    };
  }
}
