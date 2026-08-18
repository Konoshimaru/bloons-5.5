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

export default defineConfig({
  base: './', // Required for itch.io
  plugins: [
    configSavePlugin('/__save-sprite-config', path.join(__dirname, 'js', 'spriteConfig.js'), 'spriteConfig', 'SpriteConfig'),
    configSavePlugin('/__save-bloon-config', path.join(__dirname, 'js', 'bloonSpriteConfig.js'), 'bloonSpriteConfig', 'BloonSpriteConfig'),
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
  }
});