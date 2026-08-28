import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import Logo from './Logo';
import CreatorProfile from './CreatorProfile';

type Props = {
  sourceUrl: string;
};

export default function Footer({ sourceUrl }: Props) {
  return (
    <footer className="border-t border-border bg-bg">
      <div className="mx-auto flex min-h-[130px] w-full max-w-[1680px] flex-col items-center gap-8 px-4 py-7 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-8">
        <Link
          href="#top"
          aria-label="Hunt Ideas, back to top"
          className="flex items-center gap-2.5 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Logo />
          <span className="text-[14px] font-semibold text-text">Hunt Ideas</span>
        </Link>

        <CreatorProfile align="center" />

        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-sm text-[13px] text-muted transition-colors hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Product data from Product Hunt
          <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
        </a>
      </div>
    </footer>
  );
}
