import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'EnvBook — Zero-Knowledge Developer Workspace & .env Secrets Manager';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          backgroundColor: '#090d16',
          backgroundImage:
            'radial-gradient(circle at 25px 25px, #1e293b 2%, transparent 0%), radial-gradient(circle at 75px 75px, #1e293b 2%, transparent 0%)',
          backgroundSize: '100px 100px',
          padding: '80px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#f8fafc',
          border: '1px solid #1e293b',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              backgroundColor: '#0f172a',
              border: '2px solid #10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 25px rgba(16, 185, 129, 0.3)',
            }}
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                backgroundColor: '#10b981',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '36px', fontWeight: 800, letterSpacing: '-1px' }}>
              EnvBook
            </span>
            <span style={{ fontSize: '16px', color: '#10b981', fontFamily: 'monospace' }}>
              // ZERO-KNOWLEDGE DEVELOPER WORKSPACE
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h1
            style={{
              fontSize: '56px',
              fontWeight: 800,
              lineHeight: 1.15,
              maxWidth: '960px',
              letterSpacing: '-1.5px',
            }}
          >
            Encrypted Notes & Bulk <span style={{ color: '#34d399' }}>.env</span> Manager
          </h1>
          <p
            style={{
              fontSize: '24px',
              color: '#94a3b8',
              maxWidth: '850px',
              lineHeight: 1.4,
            }}
          >
            Private, client-side AES-256-GCM encrypted developer notebook. Paste full .env blocks,
            instant syntax validation, Notion-style block editor, and per-key secrets control.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
            fontSize: '18px',
            color: '#64748b',
            fontFamily: 'monospace',
          }}
        >
          <span>envbook.vercel.app</span>
          <span>•</span>
          <span>AES-256-GCM Zero-Knowledge</span>
          <span>•</span>
          <span>Notion-Style Block Editor</span>
          <span>•</span>
          <span>Bulk .env Parser</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
