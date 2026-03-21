import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { customAlphabet } from 'nanoid';

const prisma = new PrismaClient();
const generateCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);

async function main() {
  console.log('Seeding database...');

  // Clean existing data
  await prisma.photo.deleteMany();
  await prisma.guestSession.deleteMany();
  await prisma.export.deleteMany();
  await prisma.event.deleteMany();
  await prisma.host.deleteMany();

  // Create demo host
  const host = await prisma.host.create({
    data: {
      email: 'demo@lumora.app',
      passwordHash: await bcrypt.hash('demo1234', 12),
      displayName: 'Demo Host',
    },
  });
  console.log(`Created host: ${host.email} (password: demo1234)`);

  // Create demo events
  const wedding = await prisma.event.create({
    data: {
      hostId: host.id,
      title: 'Sarah & Mike\'s Wedding',
      startDatetime: new Date('2026-06-15T18:00:00Z'),
      timezone: 'America/New_York',
      revealDelayHours: 1,
      maxPhotosPerGuest: 20,
      guestGalleryEnabled: true,
      moderationMode: 'AUTO',
      eventCode: generateCode(),
    },
  });
  console.log(`Created event: ${wedding.title} (code: ${wedding.eventCode})`);

  const birthday = await prisma.event.create({
    data: {
      hostId: host.id,
      title: 'Emma\'s 30th Birthday',
      startDatetime: new Date('2026-03-20T19:00:00Z'),
      timezone: 'America/Chicago',
      revealDelayHours: 0,
      maxPhotosPerGuest: 10,
      guestGalleryEnabled: true,
      moderationMode: 'APPROVE_FIRST',
      eventCode: generateCode(),
    },
  });
  console.log(`Created event: ${birthday.title} (code: ${birthday.eventCode})`);

  // Create some guest sessions for the wedding
  const guests = ['Alice', 'Bob', 'Charlie', 'Diana'];
  for (const name of guests) {
    await prisma.guestSession.create({
      data: {
        eventId: wedding.id,
        displayName: name,
        token: `seed-token-${name.toLowerCase()}`,
      },
    });
  }
  console.log(`Created ${guests.length} guest sessions`);

  console.log('\nSeed complete!');
  console.log('Login credentials: demo@lumora.app / demo1234');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
