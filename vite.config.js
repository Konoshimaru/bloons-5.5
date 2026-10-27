import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.join(__dirname, 'js', 'backups');

// Serves a tiny write endpoint so the editors can persist a config back to
// js/*.js. Every save rotates two backups first so a bad edit is always
// recoverable. Used by spriteeditor.html (SpriteConfig) and blooneditor.html
// (BloonSpriteConfig).
function configSavePlugin(route, filePath, backupPrefix, exportName) {
  return {
    name: `${backupPrefix}-save`,
    configureServer(server) {
      server.middlewares.use(route, (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('POST only');
          return;
        }
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
          try {
            const config = JSON.parse(body);
            if (!config || typeof config !== 'object' || Array.isArray(config)) {
              throw new Error('Expected a config object');
            }
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
            if (fs.existsSync(filePath)) {
              const stamp = new Date().toISOString().replace(/[:.]/g, '-');
              fs.copyFileSync(filePath, path.join(BACKUP_DIR, `${backupPrefix}.bak.${stamp}.js`));
              const backups = fs.readdirSync(BACKUP_DIR)
                .filter((f) => f.startsWith(`${backupPrefix}.bak.`) && f.endsWith('.js'))
                .sort();
              while (backups.length > 2) {
                fs.unlinkSync(path.join(BACKUP_DIR, backups.shift()));
              }
            }
            const out = `// js/${path.basename(filePath)}\nexport const ${exportName} = ` +
              JSON.stringify(config, null, 4) + ';\n';
            fs.writeFileSync(filePath, out, 'utf8');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: String(err) }));
          }
        });
      });
    }
  };
}

// Audit C-8 (v1.3.3): dev mode serves the working tree directly, so the
// missing build wiring was invisible. In production, `vite build` used to
// bundle ONLY index.html - the four editor/test pages never reached dist and
// their entry scripts dropped out of the module graph - and the sprite tree
// (served from the repo root in dev) was not copied at all: a deploy with no
// art and 404 editors. Pages are now explicit rollup inputs, and this plugin
// copies the root sprites/ tree (incl. manifest.json when present) into dist
// at bundle close. No-op on checkouts without a sprites/ dir.
function spritesCopyPlugin() {
  const SRC = path.join(__dirname, 'sprites');
  const OUT = path.join(__dirname, 'dist', 'sprites');
  return {
    name: 'copy-root-sprites',
    closeBundle() {
      if (!fs.existsSync(SRC)) return;
      fs.cpSync(SRC, OUT, { recursive: true });
    },
  };
}

// Changes every build; passed to the service worker so each deploy gets a fresh asset cache.
const BUILD_ID = Date.now().toString(36);

export default defineConfig({
  base: './', // Required for itch.io
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [
    configSavePlugin('/__save-sprite-config', path.join(__dirname, 'js', 'spriteConfig.js'), 'spriteConfig', 'SpriteConfig'),
    configSavePlugin('/__save-bloon-config', path.join(__dirname, 'js', 'bloonSpriteConfig.js'), 'bloonSpriteConfig', 'BloonSpriteConfig'),
    spritesCopyPlugin(),
  ],
  server: {
    host: '127.0.0.1', // Match Live Server's local IP
    port: 5500,        // Match Live Server's exact port
    strictPort: true,  // Force this port so your save data loads
    open: true,        // Automatically open the browser for you!
    watch: {
      // Writing js/spriteConfig.js / js/bloonSpriteConfig.js via the save
      // endpoints must NOT trigger a full-page HMR reload (that reloads the
      // editors and forces them to re-fetch every sprite). Backups churn the
      // same dir, so ignore both.
      ignored: ['**/js/spriteConfig.js', '**/js/bloonSpriteConfig.js', '**/js/backups/**']
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Audit C-8 (v1.3.3): without explicit inputs, vite build bundled only
    // index.html and the editor/test pages (and their entry scripts) never
    // reached dist. All five HTML entry points are listed here.
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, 'index.html'),
        cutsceneeditor: path.resolve(__dirname, 'cutsceneeditor.html'),
        spriteeditor: path.resolve(__dirname, 'spriteeditor.html'),
        blooneditor: path.resolve(__dirname, 'blooneditor.html'),
        tests: path.resolve(__dirname, 'tests.html'),
      },
    },
  },
  // Vitest reads this config too: keep packaging snapshots / backup scripts
  // under scripts/ out of the default **/*.test.* glob, or a stale bundled
  // copy of a suite turns the whole run red (happened 2026-10-22).
  test: {
    exclude: ['**/node_modules/**', 'scripts/**', 'js/backups/**'],
  }
});