import { describe, it, expect } from 'vitest';

describe('Status Transitions', () => {
  type PhotoStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
  type ModerationMode = 'AUTO' | 'APPROVE_FIRST';

  function getInitialStatus(mode: ModerationMode): PhotoStatus {
    return mode === 'AUTO' ? 'APPROVED' : 'PENDING';
  }

  const validTransitions: Record<PhotoStatus, PhotoStatus[]> = {
    PENDING: ['APPROVED', 'REJECTED'],
    APPROVED: ['REJECTED'],
    REJECTED: ['APPROVED'],
  };

  function isValidTransition(from: PhotoStatus, to: PhotoStatus): boolean {
    return validTransitions[from]?.includes(to) ?? false;
  }

  describe('Initial status based on moderation mode', () => {
    it('should be APPROVED in AUTO mode', () => {
      expect(getInitialStatus('AUTO')).toBe('APPROVED');
    });

    it('should be PENDING in APPROVE_FIRST mode', () => {
      expect(getInitialStatus('APPROVE_FIRST')).toBe('PENDING');
    });
  });

  describe('Valid status transitions', () => {
    it('should allow PENDING -> APPROVED', () => {
      expect(isValidTransition('PENDING', 'APPROVED')).toBe(true);
    });

    it('should allow PENDING -> REJECTED', () => {
      expect(isValidTransition('PENDING', 'REJECTED')).toBe(true);
    });

    it('should allow APPROVED -> REJECTED', () => {
      expect(isValidTransition('APPROVED', 'REJECTED')).toBe(true);
    });

    it('should allow REJECTED -> APPROVED', () => {
      expect(isValidTransition('REJECTED', 'APPROVED')).toBe(true);
    });
  });

  describe('Invalid status transitions', () => {
    it('should not allow PENDING -> PENDING', () => {
      expect(isValidTransition('PENDING', 'PENDING')).toBe(false);
    });

    it('should not allow APPROVED -> APPROVED', () => {
      expect(isValidTransition('APPROVED', 'APPROVED')).toBe(false);
    });

    it('should not allow REJECTED -> REJECTED', () => {
      expect(isValidTransition('REJECTED', 'REJECTED')).toBe(false);
    });

    it('should not allow APPROVED -> PENDING', () => {
      expect(isValidTransition('APPROVED', 'PENDING')).toBe(false);
    });
  });

  describe('Hide/unhide is independent of status', () => {
    it('hidden photos keep their status', () => {
      const photo = { status: 'APPROVED' as PhotoStatus, hidden: false };
      // Hiding just changes the hidden flag
      const hiddenPhoto = { ...photo, hidden: true };
      expect(hiddenPhoto.status).toBe('APPROVED');
      expect(hiddenPhoto.hidden).toBe(true);
    });

    it('unhiding preserves status', () => {
      const photo = { status: 'PENDING' as PhotoStatus, hidden: true };
      const unhiddenPhoto = { ...photo, hidden: false };
      expect(unhiddenPhoto.status).toBe('PENDING');
      expect(unhiddenPhoto.hidden).toBe(false);
    });
  });
});
