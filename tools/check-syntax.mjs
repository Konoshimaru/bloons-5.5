// tools/check-syntax.mjs
// Parse JavaScript files that may not be imported by the production build.
// This catches syntax errors in development tools and less frequently used
// modules without adding a linter/type-check dependency.

import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_ROOTS = ['js', 'tests', 'tools'];
const ROOT_FILES = ['vite.config.js'];
const EXCLUDED_DIRS = new Set([
    'node_modules',
    'dist',
    '.git',
    'backups'
]);
const EXCLUDED_RELATIVE_PATHS = new Set([
    path.join('js', 'backups'),
    'scripts'
]);
const EXTENSIONS = new Set(['.js', '.mjs', '.cjs']);

async function collectJavaScriptFiles(directory, output) {
    const absolute = path.join(ROOT, directory);
    let entries;

    try {
        entries = await readdir(absolute, { withFileTypes: true });
    } catch (error) {
        if (error && error.code === 'ENOENT') return;
        throw error;
    }

    for (const entry of entries) {
        const relative = path.join(directory, entry.name);
        if (EXCLUDED_RELATIVE_PATHS.has(relative)) continue;

        const fullPath = path.join(ROOT, relative);
        if (entry.isDirectory()) {
            if (!EXCLUDED_DIRS.has(entry.name)) {
                await collectJavaScriptFiles(relative, output);
            }
            continue;
        }

        if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name))) {
            output.push(fullPath);
        }
    }
}

async function main() {
    const files = ROOT_FILES.map(file => path.join(ROOT, file));

    for (const directory of SCAN_ROOTS) {
        await collectJavaScriptFiles(directory, files);
    }

    files.sort();
    let failed = 0;

    for (const file of files) {
        const result = spawnSync(process.execPath, ['--check', file], {
            encoding: 'utf8',
            cwd: ROOT
        });

        if (result.error || result.status !== 0) {
            failed++;
            console.error(`✗ ${path.relative(ROOT, file)}`);
            if (result.error) console.error(result.error.message);
            if (result.stderr) console.error(result.stderr.trim());
        }
    }

    const passed = files.length - failed;
    console.log(`JavaScript syntax: ${passed}/${files.length} files passed.`);

    if (failed > 0) {
        process.exitCode = 1;
    }
}

main().catch(error => {
    console.error('[check:syntax] Failed to scan source files:', error);
    process.exitCode = 1;
});
