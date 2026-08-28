'use client';

import type { PeriodSummary } from '@/lib/types';

type Props = {
  periods: PeriodSummary[];
  activeOffset: number;
  onSelect: (offset: number) => void;
  className?: string;
  listClassName?: string;
};

export default function MonthTabList({ periods, activeOffset, onSelect, className = '', listClassName = '' }: Props) {
  return (
    <div className={`scrollbar-hide overflow-x-auto overflow-y-hidden ${className}`}>
      <ul className={`flex items-center gap-6 whitespace-nowrap ${listClassName}`}>
        {periods.map((period) => {
          const isActive = period.offset === activeOffset;
          return (
            <li key={period.key}>
              <button
                type="button"
                onClick={() => onSelect(period.offset)}
                aria-current={isActive ? 'true' : undefined}
                className={`relative inline-block py-1 text-[14px] leading-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  isActive ? 'text-text' : 'text-muted hover:text-text'
                }`}
              >
                {period.shortLabel}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-[3px] left-0 right-0 h-[2px] rounded-full bg-accent"
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
