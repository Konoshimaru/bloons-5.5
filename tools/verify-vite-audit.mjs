// tools/verify-vite-audit.mjs
// Fails the dependency update if npm still reports an advisory for Vite.

import { readFile } from 'node:fs/promises';
import process from 'node:process';

const reportPath = process.argv[2];
if (!reportPath) {
    console.error('Usage: node tools/verify-vite-audit.mjs <npm-audit-json>');
    process.exit(2);
}

try {
    const report = JSON.parse(await readFile(reportPath, 'utf8'));
    const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    const viteVersion = packageJson.devDependencies?.vite || packageJson.dependencies?.vite;

    if (!viteVersion || !viteVersion.includes('8.1.7')) {
        console.error(`Expected Vite 8.1.7 in package.json, found ${viteVersion || 'no Vite declaration'}.`);
        process.exit(1);
    }

    const finding = report.vulnerabilities?.vite;
    if (finding) {
        console.error('npm still reports a Vite advisory:');
        console.error(JSON.stringify(finding, null, 2));
        process.exit(1);
    }

    console.log(`Vite ${viteVersion} is present in package.json and npm audit reports no Vite advisory.`);
} catch (error) {
    console.error('[verify-vite-audit] Could not verify the npm audit report:', error.message);
    process.exit(1);
}
