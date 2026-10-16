import React from 'react';
import Link from 'next/link';
import {
  Terminal,
  Shield,
  FileCode,
  Lock,
  Layers,
  ArrowRight,
  CheckCircle2,
  Key,
  Copy,
  Eye,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'EnvBook — Zero-Knowledge Developer Workspace & .env Manager',
  description:
    'EnvBook (Env Book) is the secure, zero-knowledge developer workspace uniting Notion-style block notes and bulk .env credential management with AES-256-GCM encryption.',
  alternates: {
    canonical: 'https://envbook.vercel.app',
  },
};

export default function LandingPage() {
  // Schema.org structured data for SEO, ranking "envbook" and "env book" top on Google
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: 'EnvBook',
        alternateName: ['Env Book', 'EnvBook Vault', 'EnvBook Developer Workspace'],
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Web, Cross-platform',
        url: 'https://envbook.vercel.app',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        description:
          'Private, zero-knowledge encrypted developer workspace and bulk .env secrets manager with Notion-style inline block editor and AES-256-GCM encryption.',
        featureList: [
          'Zero-knowledge AES-256-GCM client-side encryption',
          'Notion-style inline WYSIWYG block editor with slash commands',
          'Bulk .env variable parser and credential manager',
          'Environment Parity Matrix and Diff View',
          'Dynamic hierarchical workspace tree',
          'Per-variable mask, reveal, copy, edit, and search controls',
        ],
      },
      {
        '@type': 'Organization',
        name: 'EnvBook',
        alternateName: 'Env Book',
        url: 'https://envbook.vercel.app',
        logo: 'https://envbook.vercel.app/icon.svg',
        sameAs: ['https://github.com/Shadab-2604/envbook'],
        description:
          'EnvBook develops private zero-knowledge encryption tooling and developer workspace applications.',
      },
      {
        '@type': 'WebSite',
        name: 'EnvBook',
        alternateName: 'Env Book',
        url: 'https://envbook.vercel.app',
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'What is EnvBook (Env Book)?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'EnvBook is a private, zero-knowledge developer workspace that combines a Notion-style inline block editor with a bulk .env environment variable manager. All notes and secrets are encrypted client-side using AES-256-GCM before persistent storage.',
            },
          },
          {
            '@type': 'Question',
            name: 'How does EnvBook protect my .env secrets?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'EnvBook implements true zero-knowledge architecture. Your Master Password derives a Key Encryption Key (KEK) using PBKDF2/Argon2id entirely in your browser. All secrets are encrypted with AES-256-GCM with unique 96-bit nonces. The server only ever stores encrypted ciphertexts and never sees plaintext credentials.',
            },
          },
          {
            '@type': 'Question',
            name: 'Can I import entire multi-line .env files into EnvBook?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes. EnvBook features a dedicated bulk .env parser. Simply paste your complete .env configuration, and EnvBook parses, validates, and resolves duplicates and collisions into independent encrypted entries that can be managed individually.',
            },
          },
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen bg-surface-canvas text-text-primary selection:bg-primary-container selection:text-on-primary-container font-sans flex flex-col justify-between">
      {/* Structured Data Script */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Top Header Navigation */}
      <header className="border-b border-border-muted/50 backdrop-blur-md sticky top-0 z-50 bg-surface-canvas/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-surface-panel border border-border-muted flex items-center justify-center text-accent-emerald group-hover:border-accent-emerald transition-colors">
              <Terminal className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold tracking-tight text-text-primary text-base flex items-center gap-1.5">
                EnvBook
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary-container/20 text-accent-emerald border border-accent-emerald/30">
                  v1.0
                </span>
              </span>
              <span className="text-[10px] text-text-muted font-mono tracking-tight hidden sm:inline">
                Zero-Knowledge Workspace
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-3 sm:gap-6">
            <Link
              href="#features"
              className="text-xs text-text-secondary hover:text-text-primary transition-colors hidden md:inline"
            >
              Features
            </Link>
            <Link
              href="#security"
              className="text-xs text-text-secondary hover:text-text-primary transition-colors hidden md:inline"
            >
              Security
            </Link>
            <Link
              href="#faq"
              className="text-xs text-text-secondary hover:text-text-primary transition-colors hidden md:inline"
            >
              FAQ
            </Link>
            <Link
              href="/login"
              className="px-3.5 py-1.5 rounded text-xs font-medium text-text-secondary hover:text-text-primary border border-border-muted hover:border-border-subtle bg-surface-panel/50 transition-all"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="px-3.5 py-1.5 rounded text-xs font-semibold bg-accent-emerald text-surface-canvas hover:bg-accent-emerald-bright transition-all shadow-sm flex items-center gap-1.5"
            >
              <span>Get Started</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="flex-1 flex flex-col">
        <section className="relative overflow-hidden py-16 sm:py-24 border-b border-border-muted/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
            <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-panel border border-border-muted text-xs font-mono text-accent-emerald mb-6 shadow-inner">
                <Shield className="w-3.5 h-3.5" />
                <span>AES-256-GCM Zero-Knowledge Encryption</span>
              </div>

              {/* H1 - Exactly One Main Semantic H1 */}
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-text-primary leading-[1.15] mb-6">
                The Zero-Knowledge Developer Workspace &amp; <span className="text-accent-emerald">.env</span> Manager
              </h1>

              {/* Subtitle with targeted keywords */}
              <p className="text-sm sm:text-lg text-text-secondary leading-relaxed mb-8 max-w-2xl">
                <strong>EnvBook (Env Book)</strong> gives engineering teams a private, Notion-style
                block editor for architecture notes paired with a high-performance bulk <code>.env</code>{' '}
                secrets manager. Your master keys and plaintext data never leave your browser.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                <Link
                  href="/signup"
                  className="w-full sm:w-auto px-6 py-3 rounded-lg bg-accent-emerald text-surface-canvas hover:bg-accent-emerald-bright font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-accent-emerald/10"
                >
                  <Lock className="w-4 h-4" />
                  <span>Create Free Encrypted Vault</span>
                </Link>
                <Link
                  href="/login"
                  className="w-full sm:w-auto px-6 py-3 rounded-lg bg-surface-panel hover:bg-surface-elevated text-text-primary border border-border-muted font-medium text-sm flex items-center justify-center gap-2 transition-all"
                >
                  <span>Open Existing Vault</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Live Feature Checkmarks */}
              <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mt-8 text-xs text-text-muted font-mono">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent-emerald" />
                  No Server-Side Plaintext
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent-emerald" />
                  Paste Multi-line .env Blocks
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent-emerald" />
                  Inline Slash Commands (/)
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent-emerald" />
                  Auto-Masking Secrets
                </span>
              </div>
            </div>

            {/* Interactive Terminal Mockup Visualizing Bulk .env & Editor */}
            <div className="mt-12 sm:mt-16 max-w-4xl mx-auto rounded-xl border border-border-muted bg-surface-panel shadow-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border-muted bg-surface-elevated flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-status-danger/80" />
                  <div className="w-3 h-3 rounded-full bg-status-warning/80" />
                  <div className="w-3 h-3 rounded-full bg-accent-emerald/80" />
                  <span className="ml-2 font-mono text-xs text-text-muted">
                    envbook://vault/production.env
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-mono text-accent-emerald bg-surface-canvas px-2.5 py-0.5 rounded border border-border-muted">
                  <Lock className="w-3 h-3" />
                  <span>VAULT_UNLOCKED // ZERO_KNOWLEDGE</span>
                </div>
              </div>

              <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
                {/* Left: Notion-Style Block Notes Preview */}
                <div className="flex flex-col gap-3 border-b md:border-b-0 md:border-r border-border-muted pb-6 md:pb-0 md:pr-6">
                  <div className="flex items-center justify-between text-text-muted pb-2 border-b border-border-muted/50">
                    <span className="font-semibold text-text-primary flex items-center gap-1.5">
                      <FileCode className="w-3.5 h-3.5 text-accent-emerald" />
                      Block Editor
                    </span>
                    <span className="text-[10px]">Autosave: Active</span>
                  </div>
                  <div className="space-y-2 text-text-secondary">
                    <p className="text-text-primary font-bold text-sm"># API Microservice Deployment</p>
                    <p className="text-text-muted">
                      Configured with client-side zero-knowledge encryption and rotating keys.
                    </p>
                    <div className="p-2 rounded bg-surface-canvas border border-border-muted/60 text-[11px] text-accent-emerald">
                      <code>/section Kubernetes Pods</code>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-text-muted text-[11px]">
                      <li>Multi-tenant encryption boundaries</li>
                      <li>Automated 15s secret re-masking</li>
                    </ul>
                  </div>
                </div>

                {/* Right: Bulk .env Table Preview */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-text-muted pb-2 border-b border-border-muted/50">
                    <span className="font-semibold text-text-primary flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-accent-emerald" />
                      Bulk .env Parsed Variables
                    </span>
                    <span className="text-[10px] text-accent-emerald">3 Synced</span>
                  </div>

                  <div className="space-y-2">
                    <div className="p-2 rounded bg-surface-canvas border border-border-muted flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-text-primary font-semibold">MONGODB_URI</span>
                        <span className="text-text-muted font-mono">••••••••••••••••••••••••</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-text-muted">
                        <Eye className="w-3.5 h-3.5 hover:text-text-primary cursor-pointer" />
                        <Copy className="w-3.5 h-3.5 hover:text-text-primary cursor-pointer" />
                      </div>
                    </div>

                    <div className="p-2 rounded bg-surface-canvas border border-border-muted flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-text-primary font-semibold">JWT_SECRET</span>
                        <span className="text-text-muted font-mono">••••••••••••••••••••••••</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-text-muted">
                        <Eye className="w-3.5 h-3.5 hover:text-text-primary cursor-pointer" />
                        <Copy className="w-3.5 h-3.5 hover:text-text-primary cursor-pointer" />
                      </div>
                    </div>

                    <div className="p-2 rounded bg-surface-canvas border border-border-muted flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-text-primary font-semibold">PORT</span>
                        <span className="text-accent-emerald font-mono">3000</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-text-muted">
                        <Copy className="w-3.5 h-3.5 hover:text-text-primary cursor-pointer" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid Section */}
        <section id="features" className="py-16 sm:py-20 border-b border-border-muted/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary mb-3">
                Engineered for High-Security Software Workflows
              </h2>
              <p className="text-xs sm:text-sm text-text-secondary">
                Everything software developers need to organize code docs and manage sensitive <code>.env</code> files without risk of data leaks.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Feature 1 */}
              <div className="p-6 rounded-xl border border-border-muted bg-surface-panel flex flex-col gap-3">
                <div className="w-10 h-10 rounded-lg bg-surface-elevated border border-border-muted flex items-center justify-center text-accent-emerald">
                  <FileCode className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-text-primary">Notion-Style Block Canvas</h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Real-time inline WYSIWYG editor with keyboard slash commands (<code>/</code>), markdown shortcuts, formatted checklists, tables, code blocks, and automatic debounced saving.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="p-6 rounded-xl border border-border-muted bg-surface-panel flex flex-col gap-3">
                <div className="w-10 h-10 rounded-lg bg-surface-elevated border border-border-muted flex items-center justify-center text-accent-emerald">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-text-primary">Bulk .env Parser &amp; Importer</h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Paste entire multi-line dotenv files at once. EnvBook validates keys, preserves complex URL parameters, resolves duplicate variables, and encrypts each record independently.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="p-6 rounded-xl border border-border-muted bg-surface-panel flex flex-col gap-3">
                <div className="w-10 h-10 rounded-lg bg-surface-elevated border border-border-muted flex items-center justify-center text-accent-emerald">
                  <Shield className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-text-primary">Client-Side Zero-Knowledge</h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Military-grade AES-256-GCM encryption with Argon2id/PBKDF2 key derivation. Your master password decrypts data solely inside your browser memory.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="p-6 rounded-xl border border-border-muted bg-surface-panel flex flex-col gap-3">
                <div className="w-10 h-10 rounded-lg bg-surface-elevated border border-border-muted flex items-center justify-center text-accent-emerald">
                  <Layers className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-text-primary">Custom Dynamic Hierarchy</h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Build flexible project trees with pages, sections, environment configurations, and notes containers. No rigid content categories or forced schemas.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="p-6 rounded-xl border border-border-muted bg-surface-panel flex flex-col gap-3">
                <div className="w-10 h-10 rounded-lg bg-surface-elevated border border-border-muted flex items-center justify-center text-accent-emerald">
                  <Eye className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-text-primary">Per-Secret Reveal &amp; Copy</h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Variables remain safely masked by default (<code>••••••••••••</code>). Reveal single items with an automatic 15-second re-masking timeout or copy safely to clipboard.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="p-6 rounded-xl border border-border-muted bg-surface-panel flex flex-col gap-3">
                <div className="w-10 h-10 rounded-lg bg-surface-elevated border border-border-muted flex items-center justify-center text-accent-emerald">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-text-primary">Environment Parity Matrix</h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Compare variable definitions across development, staging, and production environments side by side to instantly spot missing configuration values.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Security Section */}
        <section id="security" className="py-16 sm:py-20 border-b border-border-muted/30 bg-surface-panel/30">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary mb-3">
                Zero-Knowledge Security Architecture
              </h2>
              <p className="text-xs sm:text-sm text-text-secondary max-w-xl mx-auto">
                How EnvBook guarantees that no cloud provider, database admin, or eavesdropper can ever read your encrypted credentials.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-border-muted bg-surface-canvas space-y-4 font-mono text-xs">
              <div className="flex items-start gap-3">
                <span className="px-2 py-0.5 rounded bg-surface-panel border border-border-muted text-accent-emerald font-bold">
                  01
                </span>
                <div>
                  <h4 className="font-bold text-text-primary font-sans text-sm mb-1">
                    Master Password Key Derivation
                  </h4>
                  <p className="text-text-muted font-sans text-xs">
                    Your password never crosses the network. It passes through PBKDF2/Argon2id with 100,000 rounds of SHA-256 and a cryptographically random salt to derive your Key Encryption Key (KEK).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="px-2 py-0.5 rounded bg-surface-panel border border-border-muted text-accent-emerald font-bold">
                  02
                </span>
                <div>
                  <h4 className="font-bold text-text-primary font-sans text-sm mb-1">
                    AES-256-GCM Authenticated Encryption
                  </h4>
                  <p className="text-text-muted font-sans text-xs">
                    Every document, folder title, and environment variable is encrypted with unique 96-bit initialization vectors (IVs) and 128-bit authentication tags to prevent replay attacks or ciphertext tampering.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="px-2 py-0.5 rounded bg-surface-panel border border-border-muted text-accent-emerald font-bold">
                  03
                </span>
                <div>
                  <h4 className="font-bold text-text-primary font-sans text-sm mb-1">
                    Memory Zeroing &amp; Auto-Lock
                  </h4>
                  <p className="text-text-muted font-sans text-xs">
                    When you lock your vault or remain idle, decryption keys are zeroed out in memory. Decrypted secret views automatically re-mask after 15 seconds.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="py-16 sm:py-20 border-b border-border-muted/30">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary mb-3">
                Frequently Asked Questions
              </h2>
              <p className="text-xs sm:text-sm text-text-secondary">
                Learn more about EnvBook (Env Book), its deployment, and privacy controls.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-border-muted bg-surface-panel">
                <h3 className="font-semibold text-text-primary text-sm mb-1">
                  How does EnvBook compare to traditional secret managers?
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Traditional managers store secrets on centralized servers that hold the decryption keys. EnvBook is zero-knowledge: encryption and decryption happen strictly in your browser via Web Crypto APIs before sending ciphertext to the database.
                </p>
              </div>

              <div className="p-4 rounded-lg border border-border-muted bg-surface-panel">
                <h3 className="font-semibold text-text-primary text-sm mb-1">
                  Can I export my decrypted .env variables?
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Yes. Once your vault is unlocked, you can export your decrypted variables in clean dotenv format with one click, or copy individual secrets to your clipboard.
                </p>
              </div>

              <div className="p-4 rounded-lg border border-border-muted bg-surface-panel">
                <h3 className="font-semibold text-text-primary text-sm mb-1">
                  Is EnvBook open source and self-hostable?
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Yes, EnvBook can be deployed directly on Vercel or any containerized Node.js/MongoDB environment. Visit our GitHub repository for deployment configurations.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom CTA Banner */}
        <section className="py-16 sm:py-20 bg-gradient-to-b from-surface-canvas to-surface-panel">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-text-primary tracking-tight mb-4">
              Secure Your Development Stack with EnvBook
            </h2>
            <p className="text-xs sm:text-sm text-text-secondary max-w-xl mx-auto mb-8">
              Join developers protecting their API keys, database credentials, and engineering notes with zero-knowledge encryption.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/signup"
                className="w-full sm:w-auto px-6 py-3 rounded-lg bg-accent-emerald text-surface-canvas hover:bg-accent-emerald-bright font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg"
              >
                <span>Get Started Now</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto px-6 py-3 rounded-lg bg-surface-panel hover:bg-surface-elevated text-text-primary border border-border-muted font-medium text-sm transition-all"
              >
                <span>Sign In to Vault</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer with SEO Internal Links */}
      <footer className="border-t border-border-muted/60 py-8 bg-surface-canvas">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-accent-emerald" />
            <span className="font-semibold text-text-primary">EnvBook</span>
            <span>— The Zero-Knowledge Developer Workspace</span>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <Link href="/login" className="hover:text-text-primary transition-colors">
              Sign In
            </Link>
            <Link href="/signup" className="hover:text-text-primary transition-colors">
              Create Account
            </Link>
            <Link href="/llms.txt" className="hover:text-text-primary transition-colors">
              llms.txt
            </Link>
            <Link href="/sitemap.xml" className="hover:text-text-primary transition-colors">
              Sitemap
            </Link>
            <Link href="/robots.txt" className="hover:text-text-primary transition-colors">
              Robots
            </Link>
            <a
              href="https://github.com/Shadab-2604/envbook"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-text-primary transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
