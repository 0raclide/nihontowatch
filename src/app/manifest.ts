import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NihontoWatch',
    short_name: 'NihontoWatch',
    description: 'Japanese sword & tosogu marketplace',
    start_url: '/',
    display: 'standalone',
    background_color: '#020610',
    theme_color: '#020610',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
