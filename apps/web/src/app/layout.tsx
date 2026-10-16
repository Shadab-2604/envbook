import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { VaultProvider } from '@/contexts/VaultContext';

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

export const metadata: Metadata = {
  title: 'EnvBook — Encrypted Developer Workspace & Secrets Vault',
  description: 'Private, zero-knowledge developer workspace combining block-based notes and an encrypted credentials vault.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-surface-canvas text-text-primary antialiased min-h-screen selection:bg-primary-container selection:text-on-primary-container">
        <AuthProvider>
          <VaultProvider>
            {children}
          </VaultProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
