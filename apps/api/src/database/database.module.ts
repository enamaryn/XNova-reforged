import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Global() // Rend le service disponible dans toute l'application
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
