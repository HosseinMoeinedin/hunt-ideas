export default function Hero() {
  return (
    <section aria-label="Introduction" className="border-b border-border pb-8 pt-10 sm:pt-14">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:items-end sm:gap-10">
        <div>
          <p className="mb-4 text-[12px] font-bold uppercase tracking-[0.14em] text-accent">
            Landing page ideas
          </p>
          <h1 className="text-[clamp(44px,8vw,88px)] font-semibold leading-[0.9] tracking-[-0.03em]">
            <span className="block text-text">Get design inspiration</span>
            <span className="block font-normal text-secondary">from top products.</span>
          </h1>
        </div>
        <div>
          <p className="max-w-[430px] text-[15px] leading-relaxed text-muted">
            Explore real landing pages behind products that earned attention on Product Hunt—organized
            month by month.
          </p>
        </div>
      </div>
    </section>
  );
}
