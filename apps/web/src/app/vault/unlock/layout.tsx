import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Unlock Encrypted Vault — EnvBook',
  description:
    'Unlock your encrypted EnvBook workspace session with your master password. Keys are verified and held in volatile browser memory.',
  alternates: {
    canonical: 'https://envbook.vercel.app/vault/unlock',
  },
};

export default function VaultUnlockLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
