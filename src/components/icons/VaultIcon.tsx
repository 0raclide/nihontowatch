export function VaultIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
    >
      {/* Vault door */}
      <rect x="3" y="3" width="18" height="18" rx="2" />
      {/* Lock dial */}
      <circle cx="12" cy="12" r="4" />
      {/* Handle crossbar */}
      <path strokeLinecap="round" d="M10 12h4" />
      {/* Hinges */}
      <path strokeLinecap="round" d="M3 8h1M3 16h1" />
    </svg>
  );
}
