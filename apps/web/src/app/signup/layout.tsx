import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Account — EnvBook Zero-Knowledge Workspace',
  description:
    'Create your free private EnvBook account. Get a client-side encrypted developer notebook and bulk .env secrets vault.',
  alternates: {
    canonical: 'https://envbook.vercel.app/signup',
  },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
