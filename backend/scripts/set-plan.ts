import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const plan = process.argv[3];

  if (!email || !plan) {
    console.error('Usage: npx tsx scripts/set-plan.ts <email> <plan>');
    console.error('Plans: free, starter, pro, business, enterprise');
    process.exit(1);
  }

  const host = await prisma.host.findUnique({ where: { email } });
  if (!host) {
    console.error(`No host found with email: ${email}`);
    process.exit(1);
  }

  await prisma.host.update({
    where: { id: host.id },
    data: { plan },
  });

  console.log(`Set ${email} plan to: ${plan}`);
}

main()
  .catch((err) => { console.error('Error:', err.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
