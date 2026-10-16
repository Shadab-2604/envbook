import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In — EnvBook Secure Vault',
  description:
    'Sign in to your private EnvBook encrypted developer workspace. Authenticate and unlock your zero-knowledge secrets vault.',
  alternates: {
    canonical: 'https://envbook.vercel.app/login',
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
