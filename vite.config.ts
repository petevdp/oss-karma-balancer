import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import tsconfigPaths from 'vite-tsconfig-paths';
import * as path from 'path';
import mkcert from 'vite-plugin-mkcert';
import { viteCommonjs } from '@originjs/vite-plugin-commonjs'


export default defineConfig({
  plugins: [tsconfigPaths(), solidPlugin(), mkcert(), viteCommonjs()],
  server: {
    port: 3000,
    proxy: {
      '/registry': {
        target: 'https://registry.npmjs.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/registry/, '')
      },
      '/npmApi': {
        target: 'https://api.npmjs.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/npmApi/, '')
      }
    }
  },
  build: {
    target: 'esnext'
  },
  envDir: '.',
  resolve: {
    alias: {
      lib: path.resolve('src/lib'),
      client: path.resolve('src/client'),
      server: path.resolve('src/server'),
    }
  }
});
