import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import type { ReactNode } from 'react';

import { Proveedores } from '@/componentes/proveedores';

import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Parkia', template: '%s · Parkia' },
  description: 'Estacionamiento medido desde el celular: estacioná y pagá solo el tiempo que usás.',
  applicationName: 'Parkia',
  appleWebApp: { capable: true, title: 'Parkia', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f6fb' },
    { media: '(prefers-color-scheme: dark)', color: '#0a1020' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-AR" className={jakarta.variable}>
      <body className="min-h-dvh">
        <Proveedores>{children}</Proveedores>
      </body>
    </html>
  );
}
