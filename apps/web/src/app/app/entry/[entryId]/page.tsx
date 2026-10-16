'use client';

import React, { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGetEntryById } from '@/lib/api';

export default function GenericEntryPage() {
  const params = useParams();
  const entryId = params?.entryId as string;
  const router = useRouter();

  useEffect(() => {
    if (!entryId) return;

    apiGetEntryById(entryId)
      .then((res) => {
        const type = res.entry.type;
        if (type === 'folder') {
          router.replace(`/app/folder/${entryId}`);
        } else if (type === 'credential') {
          router.replace('/app/credentials');
        } else if (type === 'environment') {
          router.replace('/app/environments');
        } else if (type === 'idea') {
          router.replace('/app/ideas');
        } else {
          router.replace(`/app/page/${entryId}`);
        }
      })
      .catch((err) => {
        console.error('Failed to resolve entry type:', err);
        router.replace('/app');
      });
  }, [entryId, router]);

  return (
    <div className="flex-1 flex items-center justify-center h-full bg-surface-canvas text-text-muted font-label-mono text-xs">
      <span className="w-2 h-2 rounded-full bg-accent-emerald animate-ping mr-2" />
      Redirecting to entry workspace...
    </div>
  );
}
