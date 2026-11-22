import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import workerApp from './worker/index';
import { getLocalCloudflareEnv } from './worker/database/localD1Adapter';

/**
 * Cloudflare Worker + D1 (SQLite) + R2 Bridge Plugin for Vite.
 * Routes all `/api/*` requests directly through `worker/index.ts` (Hono Worker)
 * backed by local D1 SQLite (`migrations/0001_initial_schema.sql`) and local R2.
 */
function cloudflareWorkerVitePlugin(): Plugin {
  const attachMiddleware = (middlewares: {
    use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void;
  }) => {
    middlewares.use(async (req, res, next) => {
      if (!req.url || !req.url.startsWith('/api/')) {
        return next();
      }

      try {
        const env = getLocalCloudflareEnv(__dirname);
        const protocol = (req.headers['x-forwarded-proto'] as string) || 'http';
        const host = req.headers.host || 'localhost:3000';
        const fullUrl = `${protocol}://${host}${req.url}`;

        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) {
          if (Array.isArray(value)) {
            for (const v of value) headers.append(key, v);
          } else if (typeof value === 'string') {
            headers.set(key, value);
          }
        }

        const method = req.method || 'GET';
        let bodyBuffer: Buffer | undefined;
        if (method !== 'GET' && method !== 'HEAD') {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          bodyBuffer = Buffer.concat(chunks);
        }

        const webReq = new Request(fullUrl, {
          method,
          headers,
          body: bodyBuffer && bodyBuffer.length > 0 ? new Uint8Array(bodyBuffer) : undefined,
        });

        const webRes = await workerApp.fetch(webReq, env);

        res.statusCode = webRes.status;
        webRes.headers.forEach((val, key) => {
          res.setHeader(key, val);
        });

        const arrayBuf = await webRes.arrayBuffer();
        res.end(Buffer.from(arrayBuf));
      } catch (err) {
        console.error('Cloudflare Worker API Error:', err);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            error: err instanceof Error ? err.message : 'Internal Worker Execution Error',
          })
        );
      }
    });
  };

  return {
    name: 'cloudflare-worker-d1-r2-vite-plugin',
    configureServer(server) {
      attachMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      attachMiddleware(server.middlewares);
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      cloudflareWorkerVitePlugin(),
      react(),
      tailwindcss(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." still resolve in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, { recursive: true, force: true });
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
