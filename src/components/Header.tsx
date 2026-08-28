import Link from 'next/link';
import Logo from './Logo';
import CreatorProfile from './CreatorProfile';

export default function Header() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-[62px] w-full max-w-[1680px] items-center justify-between px-4 sm:h-[72px] sm:px-8">
        <Link
          href="#top"
          aria-label="Hunt Ideas, back to top"
          className="flex items-center gap-2.5 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight text-text">Hunt Ideas</span>
        </Link>
        <CreatorProfile align="right" />
      </div>
    </header>
  );
}
