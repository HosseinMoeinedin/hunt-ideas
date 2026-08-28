'use client';

import { Search } from 'lucide-react';
import MonthTabList from './MonthTabList';
import type { PeriodSummary } from '@/lib/types';

type Props = {
  periods: PeriodSummary[];
  activeOffset: number;
  onSelectMonth: (offset: number) => void;
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  categories: string[];
};

export default function Controls({
  periods,
  activeOffset,
  onSelectMonth,
  search,
  onSearchChange,
  category,
  onCategoryChange,
  categories,
}: Props) {
  return (
    <section
      aria-label="Browse controls"
      className="flex min-h-[104px] flex-col gap-4 border-b border-border py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
    >
      <nav aria-label="Select month" className="min-w-0">
        <MonthTabList periods={periods} activeOffset={activeOffset} onSelect={onSelectMonth} />
      </nav>

      <div className="flex items-center gap-3">
        <div className="relative min-w-0 flex-1 sm:w-[225px] sm:flex-none">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search products..."
            aria-label="Search products"
            className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-[13px] text-text placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </div>

        <select
          value={category}
          onChange={(event) => onCategoryChange(event.target.value)}
          aria-label="Filter by category"
          className="h-10 w-[145px] shrink-0 rounded-lg border border-border bg-card px-3 text-[13px] text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-[165px]"
        >
          <option value="all" className="bg-card text-text">
            All categories
          </option>
          {categories.map((item) => (
            <option key={item} value={item} className="bg-card text-text">
              {item}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
