import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';

import { Proveedores } from '@/componentes/proveedores';

import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Parkia', template: '%s · Parkia' },
  description: 'Estacionamiento medido desde el celular: estacioná, pagá solo lo que usás.',
  applicationName: 'Parkia',
  appleWebApp: { capable: true, title: 'Parkia', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7fb' },
    { media: '(prefers-color-scheme: dark)', color: '#11152a' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-AR" className={inter.variable}>
      <body className="min-h-dvh">
        <Proveedores>{children}</Proveedores>
      </body>
    </html>
  );
}
