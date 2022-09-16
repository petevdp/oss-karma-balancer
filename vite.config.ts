import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import tsconfigPaths from 'vite-tsconfig-paths';
import * as path from 'path';
import mkcert from 'vite-plugin-mkcert';


export default defineConfig({
  plugins: [tsconfigPaths(), solidPlugin(), mkcert()],
  server: {
    port: 3000
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
