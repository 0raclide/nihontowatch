'use client';

export type AvailabilityStatus = 'available' | 'sold' | 'all';

interface AvailabilityToggleProps {
  value: AvailabilityStatus;
  onChange: (status: AvailabilityStatus) => void;
}

const STATUS_CONFIG: Record<AvailabilityStatus, { label: string }> = {
  available: { label: 'For sale' },
  sold: { label: 'Sold' },
  all: { label: 'All' },
};

export function AvailabilityToggle({ value, onChange }: AvailabilityToggleProps) {
  return (
    <div className="inline-flex items-center bg-linen/50 p-0.5 rounded-sm">
      {(Object.keys(STATUS_CONFIG) as AvailabilityStatus[]).map((status) => (
        <button
          key={status}
          onClick={() => onChange(status)}
          className={`px-2.5 py-1 text-[10px] tracking-wider transition-all duration-200 ${
            value === status
              ? 'bg-paper text-ink shadow-sm'
              : 'text-muted hover:text-charcoal'
          }`}
        >
          {STATUS_CONFIG[status].label}
        </button>
      ))}
    </div>
  );
}
