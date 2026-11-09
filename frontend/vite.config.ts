import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';

const rootEnvDir = resolve(process.cwd(), '..');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootEnvDir, '');
  const webKey = env.AMAP_WEB_KEY?.trim() ?? '';
  const securityCode = env.AMAP_SECURITY_JS_CODE?.trim() ?? '';
  const webServiceKey = env.AMAP_WEB_SERVICE_KEY?.trim() ?? '';
  const appendSecurityCode = (path: string) => {
    const url = new URL(path, 'http://localhost');
    url.searchParams.set('jscode', securityCode);
    return `${url.pathname}${url.search}`;
  };
  return {
  plugins: [react(), cesium(), {
    name: 'local-amap-config',
    configureServer(server) {
      server.middlewares.use('/__amap_config', (_request, response) => {
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        if (!webKey || !securityCode) {
          response.statusCode = 503;
          response.end(JSON.stringify({ available: false, reason: '高德本地凭证未配置完整。' }));
          return;
        }
        response.end(JSON.stringify({ available: true, key: webKey }));
      });
      server.middlewares.use('/__amap_district_probe', async (_request, response) => {
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        if (!webServiceKey) {
          response.statusCode = 503;
          response.end(JSON.stringify({ available: false, reason: 'Web 服务 Key 未配置。' }));
          return;
        }
        try {
          const url = new URL('https://restapi.amap.com/v3/config/district');
          url.searchParams.set('key', webServiceKey);
          url.searchParams.set('keywords', '福建省');
          url.searchParams.set('subdistrict', '0');
          url.searchParams.set('extensions', 'all');
          const upstream = await fetch(url, { signal: AbortSignal.timeout(10000) });
          const data = await upstream.json() as { status?: string; info?: string; districts?: Array<{ adcode?: string; polyline?: string }> };
          const district = data.districts?.find((item) => item.adcode === '350000');
          const available = upstream.ok && data.status === '1' && Boolean(district?.polyline);
          response.statusCode = available ? 200 : 502;
          response.end(JSON.stringify({ available, adcode: available ? '350000' : undefined, reason: available ? undefined : '福建省边界查询未返回有效边界。' }));
        } catch {
          response.statusCode = 502;
          response.end(JSON.stringify({ available: false, reason: '福建省边界查询网络失败或超时。' }));
        }
      });
      server.middlewares.use('/__amap_convert', async (request, response) => {
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        if (!webServiceKey) {
          response.statusCode = 503;
          response.end(JSON.stringify({ available: false, reason: 'Web 服务 Key 未配置。' }));
          return;
        }
        try {
          let body = '';
          for await (const chunk of request) {
            body += chunk.toString();
            if (body.length > 12000) throw new Error('Request body too large');
          }
          const payload = JSON.parse(body) as { points?: unknown };
          if (!Array.isArray(payload.points) || payload.points.length < 1 || payload.points.length > 40 ||
            !payload.points.every((point) => Array.isArray(point) && point.length === 2 &&
              point.every((value) => typeof value === 'number' && Number.isFinite(value)))) {
            response.statusCode = 400;
            response.end(JSON.stringify({ available: false, reason: '坐标格式无效。' }));
            return;
          }
          const coordinates = payload.points as [number, number][];
          if (!coordinates.every(([longitude, latitude]) => Math.abs(longitude) <= 180 && Math.abs(latitude) <= 90)) {
            response.statusCode = 400;
            response.end(JSON.stringify({ available: false, reason: '坐标超出有效范围。' }));
            return;
          }
          const url = new URL('https://restapi.amap.com/v3/assistant/coordinate/convert');
          url.searchParams.set('key', webServiceKey);
          url.searchParams.set('coordsys', 'gps');
          url.searchParams.set('locations', coordinates.map(([longitude, latitude]) =>
            `${longitude.toFixed(6)},${latitude.toFixed(6)}`).join('|'));
          const upstream = await fetch(url, { signal: AbortSignal.timeout(10000) });
          const data = await upstream.json() as { status?: string; info?: string; locations?: string };
          const points = data.locations?.split(';').map((pair) => pair.split(',').map(Number)) ?? [];
          const available = upstream.ok && data.status === '1' && points.length === coordinates.length &&
            points.every((point) => point.length === 2 && point.every(Number.isFinite));
          const infoCode = /^[A-Za-z0-9_-]{1,40}$/.test(data.info ?? '') ? data.info : 'UPSTREAM_ERROR';
          response.statusCode = available ? 200 : 502;
          response.end(JSON.stringify({ available, points: available ? points : undefined,
            reason: available ? undefined : `AMAP_${infoCode}` }));
        } catch {
          response.statusCode = 502;
          response.end(JSON.stringify({ available: false, reason: '高德坐标转换请求失败或超时。' }));
        }
      });
    },
  }],
  server: {
    proxy: {
      '/health': 'http://127.0.0.1:8000',
      '/api': 'http://127.0.0.1:8000',
      '/_AMapService/v4/map/styles': {
        target: 'https://webapi.amap.com',
        changeOrigin: true,
        rewrite: (path) => appendSecurityCode(path.replace(/^\/_AMapService/, '')),
      },
      '/_AMapService': {
        target: 'https://restapi.amap.com',
        changeOrigin: true,
        rewrite: (path) => appendSecurityCode(path.replace(/^\/_AMapService/, '')),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
  };
});
