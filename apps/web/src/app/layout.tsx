import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { VaultProvider } from '@/contexts/VaultContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

const themeInitScript = `
  (function() {
    try {
      var stored = localStorage.getItem('envbook-theme');
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var isDark = stored === 'dark' || (!stored && prefersDark) || (stored === 'system' && prefersDark);
      var theme = isDark ? 'dark' : 'light';
      var root = document.documentElement;
      root.classList.remove('dark', 'light');
      root.classList.add(theme);
      root.setAttribute('data-theme', theme);
      root.style.colorScheme = theme;
    } catch (e) {}
  })();
`;

export const metadata: Metadata = {
  metadataBase: new URL('https://envbook.vercel.app'),
  title: {
    default: 'EnvBook — Zero-Knowledge Developer Workspace & .env Manager',
    template: '%s | EnvBook',
  },
  description:
    'EnvBook (Env Book) is a private, zero-knowledge encrypted developer workspace and bulk .env secrets manager. Features a Notion-style block editor, instant dotenv parser, and client-side AES-256-GCM encryption.',
  keywords: [
    'EnvBook',
    'Env Book',
    'envbook.vercel.app',
    'environment variables manager',
    'bulk env manager',
    'developer secrets vault',
    'zero-knowledge encryption',
    'Notion-style block editor',
    'dotenv parser',
    'AES-256-GCM',
    'encrypted developer notebook',
  ],
  authors: [{ name: 'EnvBook', url: 'https://envbook.vercel.app' }],
  creator: 'EnvBook',
  publisher: 'EnvBook',
  applicationName: 'EnvBook',
  alternates: {
    canonical: 'https://envbook.vercel.app',
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    shortcut: ['/icon.svg'],
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://envbook.vercel.app',
    siteName: 'EnvBook',
    title: 'EnvBook — Zero-Knowledge Developer Workspace & .env Manager',
    description:
      'Private, zero-knowledge encrypted developer workspace and bulk .env secrets manager. Notion-style block editor and client-side AES-256-GCM encryption.',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'EnvBook — Zero-Knowledge Developer Workspace & .env Secrets Manager',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EnvBook — Zero-Knowledge Developer Workspace & .env Manager',
    description:
      'Private, zero-knowledge encrypted developer workspace and bulk .env secrets manager. Client-side AES-256-GCM encryption.',
    images: ['/opengraph-image'],
    creator: '@envbook',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-surface-canvas text-text-primary antialiased min-h-screen selection:bg-primary selection:text-surface-canvas">
        <ThemeProvider>
          <AuthProvider>
            <VaultProvider>
              {children}
            </VaultProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
