import type { ReactNode } from 'react';

import './globals.css';

export const metadata = {
  title: 'Travel research agent',
  description: 'Flights and hotels for an agent, powered by searchapi-ai-sdk.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
