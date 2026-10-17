import React from 'react';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  isCurrent?: boolean;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  const fullItems: BreadcrumbItem[] = [
    { label: 'Workspace', href: '/app' },
    ...items,
  ];

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-1.5 text-xs text-text-muted font-mono select-none ${className}`}
    >
      <Link
        href="/app"
        className="flex items-center gap-1 hover:text-primary transition-colors"
        title="Workspace Dashboard"
      >
        <Home className="w-3.5 h-3.5" />
      </Link>

      {fullItems.slice(1).map((item, idx) => {
        const isLast = idx === fullItems.length - 2;

        return (
          <React.Fragment key={`${item.label}-${idx}`}>
            <ChevronRight className="w-3 h-3 text-text-muted/60 shrink-0" />
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="hover:text-text-primary transition-colors truncate max-w-[140px] sm:max-w-[200px]"
              >
                {item.label}
              </Link>
            ) : (
              <span
                aria-current={isLast ? 'page' : undefined}
                className="text-text-primary font-medium truncate max-w-[160px] sm:max-w-[240px]"
              >
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
