'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ProductsResponse } from '@/lib/types';
import Header from './Header';
import Hero from './Hero';
import Controls from './Controls';
import ProductGrid from './ProductGrid';
import BottomMonthNav from './BottomMonthNav';
import Footer from './Footer';

const GENERIC_ERROR = 'Product Hunt could not be reached. Try again in a moment.';

type Props = {
  initialData: ProductsResponse;
  initialError: string | null;
  initialOffset: number;
};

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function HuntIdeasApp({ initialData, initialError, initialOffset }: Props) {
  const [offset, setOffset] = useState(initialOffset);
  const [data, setData] = useState<ProductsResponse>(initialData);
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const abortRef = useRef<AbortController | null>(null);
  const isFirstRun = useRef(true);
  const controlsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    fetch(`/api/products?offset=${offset}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error('request failed');
        const json = (await res.json()) as ProductsResponse;
        setData(json);
        setCategory('all');
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(GENERIC_ERROR);
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, [offset]);

  const periods = data.periods;
  const products = data.products;

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((product) => set.add(product.category));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesQuery =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.tagline.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query);
      const matchesCategory = category === 'all' || product.category === category;
      return matchesQuery && matchesCategory;
    });
  }, [products, search, category]);

  const scrollToControls = useCallback(() => {
    requestAnimationFrame(() => {
      controlsRef.current?.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'start',
      });
    });
  }, []);

  const handleSelectMonth = useCallback((newOffset: number) => {
    setOffset(newOffset);
  }, []);

  const handleSelectBottomMonth = useCallback(
    (newOffset: number) => {
      setOffset(newOffset);
      scrollToControls();
    },
    [scrollToControls]
  );

  const clearFilters = useCallback(() => {
    setSearch('');
    setCategory('all');
    setOffset(initialOffset);
  }, [initialOffset]);

  return (
    <>
      <Header />
      <main id="top" className="mx-auto w-full max-w-[1680px] px-4 sm:px-8">
        <Hero />

        <div ref={controlsRef}>
          <Controls
            periods={periods}
            activeOffset={offset}
            onSelectMonth={handleSelectMonth}
            search={search}
            onSearchChange={setSearch}
            category={category}
            onCategoryChange={setCategory}
            categories={categories}
          />
        </div>

        <section aria-label="Product gallery">
          <ProductGrid
            products={filteredProducts}
            loading={loading}
            error={error}
            onClearFilters={clearFilters}
          />
        </section>

        <BottomMonthNav periods={periods} activeOffset={offset} onSelect={handleSelectBottomMonth} />
      </main>
      <Footer sourceUrl={data.sourceUrl} />
    </>
  );
}
