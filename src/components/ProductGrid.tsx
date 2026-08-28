'use client';

import type { Product } from '@/lib/types';
import ProductCard from './ProductCard';
import SkeletonCard from './SkeletonCard';

type Props = {
  products: Product[];
  loading: boolean;
  error: string | null;
  onClearFilters: () => void;
};

const GRID_CLASSES = 'mt-[22px] grid grid-cols-1 gap-x-[18px] gap-y-[34px] sm:grid-cols-2 lg:grid-cols-3';

export default function ProductGrid({ products, loading, error, onClearFilters }: Props) {
  if (loading) {
    return (
      <div className={GRID_CLASSES} aria-busy="true" aria-live="polite" aria-label="Loading products">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="mt-[22px] flex min-h-[240px] flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card px-6 py-16 text-center"
      >
        <p className="max-w-sm text-[14px] text-muted">{error}</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="mt-[22px] flex min-h-[240px] flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card px-6 py-16 text-center">
        <p className="max-w-sm text-[14px] text-muted">No launches match those filters.</p>
        <button
          type="button"
          onClick={onClearFilters}
          className="rounded-lg border border-border px-4 py-2 text-[13px] font-medium text-text transition-colors hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <div className={GRID_CLASSES}>
      {products.map((product, index) => (
        <ProductCard key={product.id} product={product} priority={index < 6} />
      ))}
    </div>
  );
}
