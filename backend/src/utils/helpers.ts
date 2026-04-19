import { customAlphabet } from 'nanoid';
import { PrismaClient } from '@prisma/client';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const generateCode = customAlphabet(alphabet, 8);

export function createEventCode(): string {
  return generateCode();
}

export function computeRevealAt(capturedAt: Date, revealDelayHours: number): Date {
  const revealAt = new Date(capturedAt.getTime());
  revealAt.setHours(revealAt.getHours() + revealDelayHours);
  return revealAt;
}

export function isRevealed(revealAt: Date): boolean {
  return new Date() >= revealAt;
}

export function isPhotoVisible(photo: {
  hidden: boolean;
  status: string;
  revealAt: Date;
}, moderationMode: string): boolean {
  // Hidden photos never visible to guests
  if (photo.hidden) return false;

  // In APPROVE_FIRST mode, only APPROVED photos are visible
  if (moderationMode === 'APPROVE_FIRST' && photo.status !== 'APPROVED') return false;

  // In AUTO mode, PENDING/APPROVED are visible (rejected are not)
  if (moderationMode === 'AUTO' && photo.status === 'REJECTED') return false;

  // Must be revealed (past the delay)
  if (!isRevealed(photo.revealAt)) return false;

  return true;
}

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
}

/**
 * Build a Prisma `where` clause for finding an event.
 * Admins can access any event; regular users can only access their own.
 */
export async function eventWhereForHost(
  prisma: PrismaClient,
  eventId: string,
  hostId: string
): Promise<{ id: string; hostId?: string }> {
  const host = await prisma.host.findUnique({
    where: { id: hostId },
    select: { role: true },
  });

  if (host?.role === 'admin') return { id: eventId };

  const moderator = await (prisma as any).eventModerator.findUnique({
    where: { eventId_hostId: { eventId, hostId } },
  });

  return moderator ? { id: eventId } : { id: eventId, hostId };
}
