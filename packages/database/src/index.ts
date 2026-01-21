import { PrismaClient } from '@prisma/client'

// Export Prisma Client
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

// Export types
export * from '@prisma/client'
