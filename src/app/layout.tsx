import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hunt Ideas — Landing page ideas from top products',
  description: 'Get landing page design inspiration from top Product Hunt products, month by month.',
};

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0e0e0d',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ colorScheme: 'dark' }}>
      <body className="min-h-screen bg-bg font-sans text-text antialiased">{children}</body>
    </html>
  );
}
