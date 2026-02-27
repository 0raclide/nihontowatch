/**
 * Feedback Admin Email Template Tests
 *
 * Tests the HTML and text email templates for admin feedback notifications.
 * Verifies correct content, escaping, target links, and conditional sections.
 */

import { describe, it, expect } from 'vitest';
import {
  generateFeedbackAdminHtml,
  generateFeedbackAdminText,
} from '@/lib/email/templates/feedback-admin';

// =============================================================================
// HTML TEMPLATE TESTS
// =============================================================================

describe('generateFeedbackAdminHtml', () => {
  it('renders feedback type label', () => {
    const html = generateFeedbackAdminHtml({
      feedback_type: 'bug',
      message: 'Test bug',
      user_display_name: 'Alice',
    });

    expect(html).toContain('Bug Report');
    expect(html).toContain('Alice');
  });

  it('renders all feedback type labels correctly', () => {
    const types = {
      data_report: 'Data Report',
      bug: 'Bug Report',
      feature_request: 'Feature Request',
      other: 'Other',
    } as const;

    for (const [type, label] of Object.entries(types)) {
      const html = generateFeedbackAdminHtml({
        feedback_type: type as keyof typeof types,
        message: 'Test',
        user_display_name: 'User',
      });
      expect(html).toContain(label);
    }
  });

  it('renders message content', () => {
    const html = generateFeedbackAdminHtml({
      feedback_type: 'bug',
      message: 'The search is broken',
      user_display_name: 'Alice',
    });

    expect(html).toContain('The search is broken');
  });

  it('includes target section for listing reports', () => {
    const html = generateFeedbackAdminHtml({
      feedback_type: 'data_report',
      message: 'Wrong cert',
      user_display_name: 'Bob',
      target_type: 'listing',
      target_id: '42',
      target_label: 'Katana by Masamune',
    });

    expect(html).toContain('Target');
    expect(html).toContain('Katana by Masamune');
    expect(html).toContain('/listing/42');
  });

  it('includes target section for artist reports', () => {
    const html = generateFeedbackAdminHtml({
      feedback_type: 'data_report',
      message: 'Wrong era',
      user_display_name: 'Bob',
      target_type: 'artist',
      target_id: 'MAS590',
      target_label: 'Masamune',
    });

    expect(html).toContain('/artists/MAS590');
    expect(html).toContain('Masamune');
  });

  it('omits target section when no target', () => {
    const html = generateFeedbackAdminHtml({
      feedback_type: 'bug',
      message: 'General bug',
      user_display_name: 'Alice',
    });

    // Should not have the Target label row
    expect(html).not.toContain('>Target<');
  });

  it('includes page URL when provided', () => {
    const html = generateFeedbackAdminHtml({
      feedback_type: 'bug',
      message: 'Bug on this page',
      user_display_name: 'Alice',
      page_url: 'https://nihontowatch.com/browse?type=katana',
    });

    expect(html).toContain('Page');
    expect(html).toContain('https://nihontowatch.com/browse?type=katana');
  });

  it('omits page URL section when not provided', () => {
    const html = generateFeedbackAdminHtml({
      feedback_type: 'bug',
      message: 'Test',
      user_display_name: 'Alice',
    });

    // The word "Page" only appears in the conditional section
    // Should not have the Page label
    expect(html).not.toContain('>Page<');
  });

  it('includes View in Dashboard link', () => {
    const html = generateFeedbackAdminHtml({
      feedback_type: 'bug',
      message: 'Test',
      user_display_name: 'Alice',
    });

    expect(html).toContain('View in Dashboard');
    expect(html).toContain('/admin/feedback');
  });

  it('escapes HTML in user-provided content', () => {
    const html = generateFeedbackAdminHtml({
      feedback_type: 'bug',
      message: '<script>alert("xss")</script>',
      user_display_name: '<b>Hacker</b>',
      target_label: 'Item <with> special & chars',
      target_type: 'listing',
      target_id: '1',
    });

    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;b&gt;Hacker&lt;/b&gt;');
    expect(html).toContain('special &amp; chars');
  });

  it('escapes HTML in page_url', () => {
    const html = generateFeedbackAdminHtml({
      feedback_type: 'bug',
      message: 'Test',
      user_display_name: 'Alice',
      page_url: 'https://example.com/path?a=1&b="2"',
    });

    expect(html).toContain('a=1&amp;b=&quot;2&quot;');
  });

  it('uses target_id as label fallback when target_label is null', () => {
    const html = generateFeedbackAdminHtml({
      feedback_type: 'data_report',
      message: 'Test',
      user_display_name: 'Alice',
      target_type: 'listing',
      target_id: '42',
      target_label: null,
    });

    // The link text should fall back to the ID
    expect(html).toContain('>42</a>');
  });

  it('is valid HTML with DOCTYPE', () => {
    const html = generateFeedbackAdminHtml({
      feedback_type: 'bug',
      message: 'Test',
      user_display_name: 'Alice',
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html>');
    expect(html).toContain('</html>');
  });
});

// =============================================================================
// TEXT TEMPLATE TESTS
// =============================================================================

describe('generateFeedbackAdminText', () => {
  it('renders type label and user name', () => {
    const text = generateFeedbackAdminText({
      feedback_type: 'bug',
      message: 'Found a bug',
      user_display_name: 'Alice',
    });

    expect(text).toContain('New Bug Report from Alice');
  });

  it('renders all feedback type labels', () => {
    const types = {
      data_report: 'Data Report',
      bug: 'Bug Report',
      feature_request: 'Feature Request',
      other: 'Other',
    } as const;

    for (const [type, label] of Object.entries(types)) {
      const text = generateFeedbackAdminText({
        feedback_type: type as keyof typeof types,
        message: 'Test',
        user_display_name: 'User',
      });
      expect(text).toContain(`New ${label}`);
    }
  });

  it('includes message', () => {
    const text = generateFeedbackAdminText({
      feedback_type: 'bug',
      message: 'Search is broken on mobile',
      user_display_name: 'Alice',
    });

    expect(text).toContain('Message: Search is broken on mobile');
  });

  it('includes target label when provided', () => {
    const text = generateFeedbackAdminText({
      feedback_type: 'data_report',
      message: 'Wrong cert',
      user_display_name: 'Bob',
      target_type: 'listing',
      target_id: '42',
      target_label: 'Katana by Masamune',
    });

    expect(text).toContain('Target: Katana by Masamune');
  });

  it('omits target when not provided', () => {
    const text = generateFeedbackAdminText({
      feedback_type: 'bug',
      message: 'Test',
      user_display_name: 'Alice',
    });

    expect(text).not.toContain('Target:');
  });

  it('includes page URL when provided', () => {
    const text = generateFeedbackAdminText({
      feedback_type: 'bug',
      message: 'Test',
      user_display_name: 'Alice',
      page_url: 'https://nihontowatch.com/browse',
    });

    expect(text).toContain('Page: https://nihontowatch.com/browse');
  });

  it('omits page URL when not provided', () => {
    const text = generateFeedbackAdminText({
      feedback_type: 'bug',
      message: 'Test',
      user_display_name: 'Alice',
    });

    expect(text).not.toContain('Page:');
  });

  it('includes dashboard link', () => {
    const text = generateFeedbackAdminText({
      feedback_type: 'bug',
      message: 'Test',
      user_display_name: 'Alice',
    });

    expect(text).toContain('View:');
    expect(text).toContain('/admin/feedback');
  });
});
