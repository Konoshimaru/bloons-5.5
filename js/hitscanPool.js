// Per-tower hitscan records are short-lived but can be created dozens of
// times per second by fast Snipers. Recycle records instead of allocating a
// fresh object for every shot; the bounded free list prevents one unusual burst
// from retaining an unbounded number of objects for the lifetime of a tower.
export const MAX_RETAINED_HITSCAN_RECORDS = 32;

export function addHitscan(tower, x1, y1, x2, y2, life) {
    const free = tower._hitscanPool || (tower._hitscanPool = []);
    const hitscan = free.pop() || {};
    hitscan.x1 = x1;
    hitscan.y1 = y1;
    hitscan.x2 = x2;
    hitscan.y2 = y2;
    hitscan.life = life;
    tower.hitscans.push(hitscan);
    return hitscan;
}

export function updateHitscans(tower, dt) {
    const hitscans = tower.hitscans;
    if (!hitscans || hitscans.length === 0) return;

    const free = tower._hitscanPool || (tower._hitscanPool = []);
    for (let i = hitscans.length - 1; i >= 0; i--) {
        const hitscan = hitscans[i];
        hitscan.life -= dt;
        if (hitscan.life > 0) continue;

        const last = hitscans.pop();
        if (i < hitscans.length) hitscans[i] = last;
        if (free.length < MAX_RETAINED_HITSCAN_RECORDS) free.push(hitscan);
    }
}
