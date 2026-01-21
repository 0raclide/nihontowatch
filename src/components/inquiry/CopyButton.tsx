'use client';

/**
 * CopyButton Component
 *
 * A reusable button that copies text to the clipboard with visual feedback.
 * Used throughout the inquiry email feature for copying dealer email,
 * subject lines, and email body.
 */

import { useState, useCallback } from 'react';

// =============================================================================
// Types
// =============================================================================

type ButtonSize = 'sm' | 'md' | 'lg';
type ButtonVariant = 'button' | 'icon';

interface CopyButtonProps {
  /** The text to copy to clipboard */
  text: string;
  /** Button label (default: "Copy") */
  label?: string;
  /** Button variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Additional CSS classes */
  className?: string;
  /** Disable the button */
  disabled?: boolean;
  /** Aria label for icon variant */
  ariaLabel?: string;
  /** Test ID for testing */
  testId?: string;
  /** Callback when copy succeeds */
  onCopy?: () => void;
  /** Callback when copy fails */
  onError?: (error: Error) => void;
}

// =============================================================================
// Size Styles
// =============================================================================

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-4 py-2 text-base',
};

const iconSizeStyles: Record<ButtonSize, string> = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

// =============================================================================
// Component
// =============================================================================

export function CopyButton({
  text,
  label = 'Copy',
  variant = 'button',
  size = 'md',
  className = '',
  disabled = false,
  ariaLabel,
  testId,
  onCopy,
  onError,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (disabled) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopy?.();

      // Reset after delay
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to copy');
      onError?.(err);
    }
  }, [text, disabled, onCopy, onError]);

  // Icon component
  const CopyIcon = () => (
    <svg
      className={iconSizeStyles[size]}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );

  const CheckIcon = () => (
    <svg
      className={iconSizeStyles[size]}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );

  // Base button styles
  const baseStyles =
    'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-all focus:outline-none focus:ring-2 focus:ring-gold/50';

  // State-based styles
  const stateStyles = disabled
    ? 'opacity-50 cursor-not-allowed bg-linen text-muted'
    : copied
    ? 'bg-green-100 text-green-700 border border-green-200'
    : 'bg-linen text-charcoal hover:bg-hover border border-border';

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleCopy}
        disabled={disabled}
        className={`${baseStyles} p-1.5 ${stateStyles} ${className}`}
        aria-label={copied ? 'Copied' : (ariaLabel || label)}
        data-testid={testId}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={disabled}
      className={`${baseStyles} ${sizeStyles[size]} ${stateStyles} ${className}`}
      data-testid={testId}
    >
      {copied ? (
        <>
          <CheckIcon />
          <span>Copied</span>
        </>
      ) : (
        <>
          <CopyIcon />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
