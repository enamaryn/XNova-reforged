import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const role = request?.user?.role;

    if (!role || String(role).toUpperCase() !== 'ADMIN') {
      throw new ForbiddenException('Acces admin requis');
    }

    return true;
  }
}
