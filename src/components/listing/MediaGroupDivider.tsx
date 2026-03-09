/**
 * Thin centered-text divider rendered between media groups in QuickView scroller.
 *
 * ──── SAYAGAKI ────
 */

interface MediaGroupDividerProps {
  label: string;
}

export function MediaGroupDivider({ label }: MediaGroupDividerProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3" aria-label={label}>
      <div className="flex-1 h-px bg-border" />
      <span className="text-[10px] uppercase tracking-wider text-muted whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}
