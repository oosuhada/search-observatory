import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Search Observatory',
  description: 'A personal laboratory for measurable search and SEO experiments.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
