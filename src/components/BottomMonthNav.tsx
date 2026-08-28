'use client';

import MonthTabList from './MonthTabList';
import type { PeriodSummary } from '@/lib/types';

type Props = {
  periods: PeriodSummary[];
  activeOffset: number;
  onSelect: (offset: number) => void;
};

export default function BottomMonthNav({ periods, activeOffset, onSelect }: Props) {
  return (
    <nav
      aria-label="Browse another month"
      className="mt-[55px] flex min-h-[88px] items-center justify-center border-y border-border py-6 sm:mt-[76px]"
    >
      <MonthTabList
        periods={periods}
        activeOffset={activeOffset}
        onSelect={onSelect}
        className="max-w-full"
        listClassName="justify-center"
      />
    </nav>
  );
}
