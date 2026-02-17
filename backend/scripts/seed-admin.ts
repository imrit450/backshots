/**
 * Promote a host to admin by email.
 *
 * Usage:
 *   npx tsx scripts/seed-admin.ts admin@example.com
 */
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error('Usage: npx tsx scripts/seed-admin.ts <email>');
    process.exit(1);
  }

  const host = await prisma.host.findUnique({ where: { email } });

  if (!host) {
    console.error(`No host found with email: ${email}`);
    process.exit(1);
  }

  if (host.role === 'admin') {
    console.log(`${email} is already an admin.`);
    process.exit(0);
  }

  await prisma.host.update({
    where: { id: host.id },
    data: { role: 'admin', canCreateEvents: true },
  });

  console.log(`Successfully promoted ${email} to admin.`);
}

main()
  .catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
