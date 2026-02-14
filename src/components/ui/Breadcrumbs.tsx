import Link from 'next/link';

export interface BreadcrumbItem {
  name: string;
  url?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

/**
 * Visible breadcrumb navigation with semantic HTML.
 * Uses the same { name, url } shape as generateBreadcrumbJsonLd()
 * so you can pass one array to both.
 */
export function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={`mb-4 lg:mb-6 ${className}`}>
      <ol className="flex items-center gap-1.5 text-[12px] text-muted dark:text-muted-dark flex-wrap">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1.5">
              {i > 0 && (
                <svg
                  className="w-3 h-3 text-muted/40 dark:text-muted-dark/40 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
              {isLast || !item.url ? (
                <span
                  className={
                    isLast
                      ? 'text-ink dark:text-cream truncate max-w-[220px] sm:max-w-[360px]'
                      : ''
                  }
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.name}
                </span>
              ) : (
                <Link
                  href={item.url}
                  className="hover:text-gold transition-colors whitespace-nowrap"
                >
                  {item.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
