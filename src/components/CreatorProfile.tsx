import LinkedInIcon from './LinkedInIcon';

const LINKEDIN_URL = 'https://www.linkedin.com/in/moeinhossein/';

type Props = {
  align?: 'right' | 'center';
  className?: string;
};

export default function CreatorProfile({ align = 'right', className = '' }: Props) {
  return (
    <a
      href={LINKEDIN_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="By Hossein Moeinedin, Product designer — open LinkedIn profile in a new tab"
      className={`group flex items-center gap-2.5 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        align === 'center' ? 'flex-col text-center sm:flex-row sm:text-left' : ''
      } ${className}`}
    >
      <LinkedInIcon className="h-5 w-5 shrink-0 text-muted transition-colors group-hover:text-accent" />
      <span className="leading-tight">
        <span className="block text-[12px] font-medium text-text sm:text-[13px]">By Hossein Moeinedin</span>
        <span className="block text-[10px] text-muted sm:text-[11px]">Product designer</span>
      </span>
    </a>
  );
}
