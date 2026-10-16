import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Initialize Master Key — EnvBook Secure Vault',
  description:
    'Set up your zero-knowledge Master Password for your EnvBook encrypted vault. All cryptographic keys are derived client-side.',
  alternates: {
    canonical: 'https://envbook.vercel.app/vault/setup',
  },
};

export default function VaultSetupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
