import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminGuard } from '../src/common/guards/admin.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';

const createContext = (role?: string) => {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user: role ? { role } : undefined,
      }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
};

const createReflector = (roles?: string[]) => {
  return {
    getAllAndOverride: jest.fn().mockReturnValue(roles),
  } as unknown as Reflector;
};

describe('Guards', () => {
  it('RolesGuard laisse passer sans roles declares', () => {
    const guard = new RolesGuard(createReflector(undefined));
    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('RolesGuard valide le role requis', () => {
    const guard = new RolesGuard(createReflector(['ADMIN']));
    expect(guard.canActivate(createContext('ADMIN'))).toBe(true);
  });

  it('RolesGuard bloque un role invalide', () => {
    const guard = new RolesGuard(createReflector(['ADMIN']));
    expect(() => guard.canActivate(createContext('player'))).toThrow(ForbiddenException);
  });

  it('AdminGuard valide un admin', () => {
    const guard = new AdminGuard();
    expect(guard.canActivate(createContext('ADMIN'))).toBe(true);
  });

  it('AdminGuard bloque un joueur normal', () => {
    const guard = new AdminGuard();
    expect(() => guard.canActivate(createContext('user'))).toThrow(ForbiddenException);
  });
});
