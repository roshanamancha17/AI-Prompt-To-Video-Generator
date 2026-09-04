import { PrismaClient } from '@prisma/client';

// Standard Next.js dev-mode singleton pattern — prevents exhausting the
// Postgres connection pool from hot-reload creating a new client per edit.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
