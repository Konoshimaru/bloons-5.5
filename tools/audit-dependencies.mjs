// tools/audit-dependencies.mjs
// Prints an actionable summary of npm audit findings without rewriting the
// lockfile or applying automatic dependency upgrades.

import { spawnSync } from 'node:child_process';

const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(command, ['audit', '--json'], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
});

if (result.error) {
    console.error('[audit:deps] Could not start npm audit:', result.error.message);
    process.exitCode = 1;
} else {
    let report;
    try {
        report = JSON.parse(result.stdout || '');
    } catch {
        console.error('[audit:deps] npm audit did not return valid JSON.');
        if (result.stderr) console.error(result.stderr.trim());
        process.exitCode = 1;
    }

    if (report) {
        const metadata = report.metadata?.vulnerabilities || {};
        const findings = Object.entries(report.vulnerabilities || {});

        console.log(
            `Dependency audit: ${metadata.total ?? findings.length} total finding(s) ` +
            `(critical: ${metadata.critical ?? 0}, high: ${metadata.high ?? 0}, ` +
            `moderate: ${metadata.moderate ?? 0}, low: ${metadata.low ?? 0}).`
        );

        if (findings.length === 0) {
            console.log('No dependency advisories were reported.');
        }

        for (const [name, finding] of findings) {
            const via = (finding.via || []).map(item => {
                if (typeof item === 'string') return item;
                const title = item.title || item.name || 'Advisory';
                return item.url ? `${title} (${item.url})` : title;
            });
            const fix = finding.fixAvailable === true
                ? 'a fix is available'
                : finding.fixAvailable === false
                    ? 'no automatic fix is available'
                    : finding.fixAvailable
                        ? `fix available: ${finding.fixAvailable.name || name}@${finding.fixAvailable.version || 'compatible version'}`
                        : 'fix availability unknown';

            console.log(
                `- ${name}: ${finding.severity || 'unknown'} severity; ` +
                `direct: ${finding.isDirect ? 'yes' : 'no'}; ${fix}.`
            );
            for (const advisory of via) console.log(`    • ${advisory}`);
            if (finding.range) console.log(`    affected range: ${finding.range}`);
        }

        if (result.status !== 0 && findings.length === 0) {
            console.error('[audit:deps] npm audit returned a failure without a parsed advisory list.');
            if (result.stderr) console.error(result.stderr.trim());
            process.exitCode = 1;
        }
    }
}
