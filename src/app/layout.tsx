import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Inventory Pro — Enterprise Inventory Management System',
  description: 'Production-ready full-stack enterprise inventory, supply chain, and point-of-sale platform.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}

