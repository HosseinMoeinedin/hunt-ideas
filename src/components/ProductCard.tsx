'use client';

import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { Product } from '@/lib/types';

type Props = {
  product: Product;
  priority: boolean;
};

export default function ProductCard({ product, priority }: Props) {
  const alt = `${product.name} landing page hero`;
  const formattedVotes = product.votes.toLocaleString('en-US');

  // `product.preview` asks thum.io to screenshot wherever Product Hunt's
  // redirect link actually leads — thum.io's own capture infrastructure
  // follows that redirect, not this app. If thum.io can't get through for
  // this particular link, fall back once to Product Hunt's own
  // launch-gallery image rather than showing a broken image.
  const [imgSrc, setImgSrc] = useState(product.preview);
  const triedFallback = imgSrc !== product.preview;

  return (
    <article className="group">
      <div className="relative aspect-[16/10] overflow-hidden rounded-[11px] border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.4)] ring-1 ring-inset ring-white/[0.03]">
        <a
          href={product.productHunt}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${product.name} on Product Hunt`}
          className="absolute inset-0 z-10 rounded-[11px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgSrc}
            alt={alt}
            loading={priority ? 'eager' : 'lazy'}
            referrerPolicy="no-referrer"
            onError={() => {
              if (!triedFallback && product.previewFallback) {
                setImgSrc(product.previewFallback);
              }
            }}
            className="h-full w-full object-cover object-top transition-[transform,filter] duration-300 ease-out group-hover:scale-[1.018] group-hover:brightness-[0.7]"
          />
        </a>

        <a
          href={product.website}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Visit ${product.name} website`}
          className="pointer-events-none absolute inset-0 z-20 hidden items-center justify-center opacity-0 transition-opacity duration-300 ease-out group-hover:pointer-events-auto group-hover:opacity-100 sm:flex"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f4f3ef] px-4 py-2 text-[13px] font-semibold text-[#0e0e0d] shadow-lg">
            Visit site
            <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
          </span>
        </a>
      </div>

      <div className="pt-3">
        <a
          href={product.productHunt}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate rounded-sm text-[16px] font-bold text-text transition-colors hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {product.name}
        </a>
        <p className="mt-1 truncate text-[12px] text-muted">{product.tagline}</p>

        <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-[11px] uppercase tracking-[0.08em] text-muted">
          <span className="truncate">{product.category}</span>
          <span className="shrink-0 text-secondary" aria-label={`${formattedVotes} upvotes`}>
            <span aria-hidden="true">▲</span> {formattedVotes}
          </span>
        </div>
      </div>

      <div className="mt-3 flex gap-2 sm:hidden">
        <a
          href={product.website}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded-lg border border-border bg-card py-2 text-center text-[12px] font-medium text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Website
        </a>
        <a
          href={product.productHunt}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 rounded-lg border border-border bg-card py-2 text-center text-[12px] font-medium text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Product Hunt
        </a>
      </div>
    </article>
  );
}
