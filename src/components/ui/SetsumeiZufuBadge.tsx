'use client';

interface SetsumeiZufuBadgeProps {
  /** Compact mode for listing cards */
  compact?: boolean;
  className?: string;
}

/**
 * Badge indicating a listing has NBTHK Zufu translation available.
 * Shown for Juyo/Tokubetsu Juyo items with OCR-extracted setsumei.
 */
export function SetsumeiZufuBadge({
  compact = false,
  className = '',
}: SetsumeiZufuBadgeProps) {
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
        title="Official NBTHK evaluation translated"
      >
        Zufu
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
      title="Official NBTHK evaluation translated"
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
      NBTHK Zufu
    </span>
  );
}

export default SetsumeiZufuBadge;
