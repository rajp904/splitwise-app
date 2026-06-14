// Single PrismaClient instance shared across the app.
// Prisma recommends one instance to avoid connection pool exhaustion.

import { PrismaClient } from '@prisma/client';
// PrismaClient reads from the generated client in node_modules/@prisma/client

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export default prisma;
