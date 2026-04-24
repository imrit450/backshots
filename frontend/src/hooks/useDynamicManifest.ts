import { useEffect } from 'react';

const BASE_MANIFEST = {
  name: 'Lumora',
  short_name: 'Lumora',
  description: 'Capture and share event photos instantly',
  display: 'standalone',
  background_color: '#0e0e0e',
  theme_color: '#9146ff',
  orientation: 'portrait',
  categories: ['photo', 'social'],
  icons: [
    {
      src: '/favicon.svg',
      sizes: 'any',
      type: 'image/svg+xml',
      purpose: 'any maskable',
    },
  ],
};

/**
 * Swaps the <link rel="manifest"> to a blob URL whose start_url and scope
 * are scoped to the current event path. This ensures the installed PWA icon
 * opens directly to the event page rather than the marketing root.
 */
export function useDynamicManifest(startUrl: string) {
  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    if (!link) return;

    const manifest = {
      ...BASE_MANIFEST,
      start_url: startUrl,
      scope: startUrl,
    };

    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
    const blobUrl = URL.createObjectURL(blob);
    const prev = link.href;
    link.href = blobUrl;

    return () => {
      link.href = prev;
      URL.revokeObjectURL(blobUrl);
    };
  }, [startUrl]);
}
