// Serves the exported Expo web app (dist/). Expo's static export writes one HTML file per route,
// e.g. /activity → activity.html.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

import type { MiddlewareHandler } from 'hono';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};

export function serveApp(rootDir: string): MiddlewareHandler {
  const root = resolve(rootDir);
  const inside = (p: string) => p === root || p.startsWith(root + sep);
  const isFile = (p: string) => existsSync(p) && statSync(p).isFile();

  return async (c, next) => {
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') return next();
    const path = decodeURIComponent(new URL(c.req.url).pathname);
    if (path.startsWith('/api/') || path === '/ingest') return next();

    const base = normalize(join(root, path));
    if (!inside(base)) return c.text('Not found', 404);

    const candidates = path.endsWith('/') ? [join(base, 'index.html')] : [base, `${base}.html`, join(base, 'index.html')];
    let file = candidates.find(isFile);
    let status = 200;
    if (!file) {
      file = join(root, '+not-found.html');
      status = 404;
      if (!isFile(file)) return c.text('Not found', 404);
    }

    const type = TYPES[extname(file)] ?? 'application/octet-stream';
    const hashed = path.startsWith('/_expo/static/') || path.startsWith('/assets/');
    return c.body(readFileSync(file), status as 200, {
      'Content-Type': type,
      // Hashed bundles never change; HTML, the manifest and the service worker must always be fresh.
      'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
  };
}
