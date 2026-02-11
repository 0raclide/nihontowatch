'use client';

interface SetsumeiZufuBadgeProps {
  /** Compact mode for listing cards */
  compact?: boolean;
  /** Icon only — no text, just the book icon */
  iconOnly?: boolean;
  className?: string;
}

/**
 * Badge indicating a listing has English translation available.
 * Shown for Juyo/Tokubetsu Juyo items with OCR-extracted setsumei.
 */
export function SetsumeiZufuBadge({
  compact = false,
  iconOnly = false,
  className = '',
}: SetsumeiZufuBadgeProps) {
  if (iconOnly) {
    return (
      <span
        data-testid="setsumei-zufu-badge"
        className={`inline-flex items-center text-gold/70 ${className}`.trim()}
        title="English translation available"
      >
        <svg
          className="w-3.5 h-3.5 lg:w-4 lg:h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
      </span>
    );
  }

  if (compact) {
    return (
      <span
        data-testid="setsumei-zufu-badge"
        className={`
          text-[9px] uppercase tracking-wider font-medium
          px-1.5 py-0.5 rounded
          bg-gold/15 text-gold border border-gold/30
          ${className}
        `.trim()}
        title="English translation available"
      >
        English
      </span>
    );
  }

  return (
    <span
      data-testid="setsumei-zufu-badge"
      className={`
        text-[10px] uppercase tracking-wider font-semibold
        px-2 py-0.5 rounded
        bg-gold/15 text-gold border border-gold/30
        inline-flex items-center gap-1
        ${className}
      `.trim()}
      title="English translation available"
    >
      <svg
        className="w-3 h-3"
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
          clipRule="evenodd"
        />
      </svg>
      English
    </span>
  );
}

export default SetsumeiZufuBadge;
