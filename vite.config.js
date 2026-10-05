import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { Buffer } from 'node:buffer'

function assetProxyPlugin() {
  return {
    name: 'asset-proxy-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && (req.url.startsWith('/api-asset-proxy') || req.url.startsWith('/api-tripo-download'))) {
          try {
            const urlObj = new URL(req.url, 'http://localhost');
            const targetUrl = urlObj.searchParams.get('url');
            if (!targetUrl) {
              res.statusCode = 400;
              res.end('Missing url query parameter');
              return;
            }

            const response = await fetch(targetUrl);
            if (!response.ok) {
              res.statusCode = response.status;
              res.end(`Upstream download failed: ${response.statusText}`);
              return;
            }

            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
            res.setHeader('Content-Type', response.headers.get('content-type') || 'model/gltf-binary');
            const arrayBuffer = await response.arrayBuffer();
            res.end(Buffer.from(arrayBuffer));
            return;
          } catch (err) {
            console.error('Asset proxy local error:', err);
            res.statusCode = 500;
            res.end(err.message);
            return;
          }
        }
        next();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    basicSsl(),
    assetProxyPlugin(),
    tailwindcss(),
    react()
  ],
  server: {
    host: true,
    proxy: {
      '/api-3daistudio': {
        target: 'https://api.3daistudio.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api-3daistudio/, '')
      },
      '/api-tripo': {
        target: 'https://openapi.tripo3d.ai',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api-tripo/, '')
      }
    }
  }
})
