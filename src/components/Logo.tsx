export default function Logo({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold uppercase tracking-wide text-white ${className}`}
    >
      HI
    </span>
  );
}
