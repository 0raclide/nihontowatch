import { describe, it, expect } from 'vitest';
import { classifyEmailError } from '@/lib/email/errorClassifier';

describe('classifyEmailError', () => {
  describe('permanent errors', () => {
    it('should classify "invalid email address" as permanent', () => {
      expect(classifyEmailError('The email address is an invalid email address')).toBe('permanent');
    });

    it('should classify "does not exist" as permanent', () => {
      expect(classifyEmailError('Mailbox does not exist')).toBe('permanent');
    });

    it('should classify "suppression" as permanent', () => {
      expect(classifyEmailError('Email address on suppression list')).toBe('permanent');
    });

    it('should classify "unsubscribed" as permanent', () => {
      expect(classifyEmailError('Recipient has unsubscribed from this sender')).toBe('permanent');
    });

    it('should classify "sendgrid not configured" as permanent', () => {
      expect(classifyEmailError('SendGrid not configured')).toBe('permanent');
    });

    it('should classify "bounced" as permanent', () => {
      expect(classifyEmailError('Address previously bounced')).toBe('permanent');
    });

    it('should be case-insensitive', () => {
      expect(classifyEmailError('INVALID EMAIL ADDRESS')).toBe('permanent');
      expect(classifyEmailError('Does Not Exist')).toBe('permanent');
    });
  });

  describe('transient errors', () => {
    it('should classify "Unauthorized" as transient', () => {
      expect(classifyEmailError('Unauthorized')).toBe('transient');
    });

    it('should classify "Connection timeout" as transient', () => {
      expect(classifyEmailError('Connection timeout after 30000ms')).toBe('transient');
    });

    it('should classify "ECONNRESET" as transient', () => {
      expect(classifyEmailError('read ECONNRESET')).toBe('transient');
    });

    it('should classify "too many requests" as transient', () => {
      expect(classifyEmailError('429 too many requests')).toBe('transient');
    });

    it('should classify unknown errors as transient', () => {
      expect(classifyEmailError('Something completely unexpected happened')).toBe('transient');
    });

    it('should classify empty string as transient', () => {
      expect(classifyEmailError('')).toBe('transient');
    });

    it('should classify daily limit errors as transient', () => {
      expect(classifyEmailError('Daily email limit reached (100/100)')).toBe('transient');
    });
  });
});
