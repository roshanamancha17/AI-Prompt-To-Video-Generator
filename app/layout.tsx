import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Content Studio',
  description: 'One idea in. A complete short-form content package out.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
