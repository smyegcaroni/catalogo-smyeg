'use strict';

const VERSION = '__PWA_BUILD_ID__';
const PREFIX = 'caroni-geodatos-pwa-';
const SHELL_CACHE = `${PREFIX}shell-${VERSION}`;
const RESOURCE_CACHE = `${PREFIX}resources-${VERSION}`;
const CORE_ASSETS = [
  '/',
  '/offline.html',
  '/pwa-offline.css',
  '/manifest.webmanifest',
  '/app-icon-192.png',
  '/app-icon-512.png',
  '/app-icon-maskable-192.png',
  '/app-icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/favicon-16.png',
  '/favicon-32.png',
  '/favicon-64.png',
  '/favicon.ico',
  '/favicon.svg',
  '/theme-init.js',
  '/asset-guard.js'
];

function cacheable(response) {
  return response.ok &&
    response.type !== 'opaque' &&
    !/no-store|private/i.test(response.headers.get('Cache-Control') || '');
}

function isStaticAsset(pathname) {
  return pathname.startsWith('/assets/') ||
    /^\/(?:theme-init|asset-guard|env-config)\.js$/.test(pathname) ||
    /^\/(?:app-icon(?:-maskable)?-(?:192|512)|apple-touch-icon|favicon-(?:16|32|64))\.png$/.test(pathname) ||
    /^\/favicon\.(?:ico|svg)$/.test(pathname);
}

async function buildAssets() {
  const response = await fetch('/pwa-assets.json', { cache: 'reload' });
  if (VERSION === '__PWA_BUILD_ID__' &&
      !response.headers.get('Content-Type')?.includes('application/json')) return [];
  if (!cacheable(response)) throw new Error('No se pudo leer la lista PWA');
  const data = await response.json();
  if (!Array.isArray(data.assets) ||
      data.assets.some((path) => typeof path !== 'string' || !path.startsWith('/assets/'))) {
    throw new Error('La lista PWA no es válida');
  }
  return ['/pwa-assets.json', ...data.assets];
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    const assets = [...CORE_ASSETS, ...await buildAssets()];
    for (let index = 0; index < assets.length; index += 12) {
      await Promise.all(assets.slice(index, index + 12).map(async (path) => {
        const request = new Request(path, { cache: 'reload' });
        const response = await fetch(request);
        if (!cacheable(response)) throw new Error(`No se pudo almacenar ${path}`);
        await cache.put(request, response);
      }));
    }
    await cache.put('/env-config.js', new Response(
      'window.__ENV__ = { API_BASE_URL: "/api", TILE_BASE_URL: "/api" };',
      { headers: { 'Content-Type': 'application/javascript' } }
    ));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith(PREFIX) && ![SHELL_CACHE, RESOURCE_CACHE].includes(key))
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function navigationResponse(request) {
  try {
    const response = await fetch(request);
    if (cacheable(response) && new URL(request.url).pathname === '/') {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put('/', response.clone());
    }
    return response;
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    return (await cache.match('/')) || (await cache.match('/offline.html')) || Response.error();
  }
}

async function resourceResponse(request) {
  const cache = await caches.open(RESOURCE_CACHE);
  const shell = await caches.open(SHELL_CACHE);
  const hashedAsset = new URL(request.url).pathname.startsWith('/assets/');
  const cached = (await shell.match(request, { ignoreSearch: !hashedAsset })) ||
    (await cache.match(request));
  if (hashedAsset && cached) return cached;

  try {
    const response = await fetch(request);
    if (cacheable(response)) {
      await cache.put(request, response.clone());
      const keys = await cache.keys();
      if (keys.length > 150) {
        await Promise.all(keys.slice(0, keys.length - 150).map((key) => cache.delete(key)));
      }
    }
    return response;
  } catch {
    return cached || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (/^\/(api|health|raster-tiles|tiles|ogc)(\/|$)/i.test(url.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigationResponse(request));
    return;
  }

  if (isStaticAsset(url.pathname) &&
      ['script', 'style', 'font', 'image', 'worker'].includes(request.destination)) {
    event.respondWith(resourceResponse(request));
  }
});
