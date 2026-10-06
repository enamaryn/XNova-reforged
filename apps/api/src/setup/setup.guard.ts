import { CanActivate, ExecutionContext, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { SetupDb, isSetupCompleted, verifySetupToken } from './setup-core';

/**
 * Protège les routes du parcours d'installation : code d'installation dans l'en-tête `x-setup-token`.
 * Une fois l'installation terminée, les routes n'existent plus (404) : le parcours est verrouillé.
 */
@Injectable()
export class SetupGuard implements CanActivate {
  constructor(private readonly database: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const db = this.database as unknown as SetupDb;
    if (await isSetupCompleted(db)) {
      throw new NotFoundException();
    }
    const request = context.switchToHttp().getRequest();
    const header = request.headers?.['x-setup-token'];
    const token = Array.isArray(header) ? header[0] : header;
    if (!(await verifySetupToken(db, token))) {
      throw new UnauthorizedException("Code d'installation invalide ou expiré");
    }
    return true;
  }
}
