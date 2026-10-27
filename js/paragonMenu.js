// js/paragonMenu.js
// ============================================================================
// PARAGON PRE-PURCHASE MENU (v1.4.0) - the BTD6-style confirmation dialog.
// ============================================================================
// Once every Tier 5 of a type is owned, the purple upgrade buttons open THIS
// menu instead of buying instantly. It shows exactly what the current monkeys
// on the field would produce (power + degree), and lets the player invest
// EXTRA cash before committing - every $7,500 of extra investment is +1 cash
// power (same rate as sacrificed cash), which pushes the Degree up. The total
// charge is the paragon's base cost PLUS the extra investment.
//
// Flow: engineInput.handleUpgrade / handleParagonUpgrade -> ParagonMenu.open()
//       -> confirm() -> towers/paragon_dart.createApexParagon(t, engine, extra)
// Import-lean: paragonPower (numbers) + paragon_dart (creation) + UI (menu
// toggling only). No engine import - the engine instance is passed in and
// kept for the dialog's lifetime.
// ============================================================================

import { PARAGON_POWER_RULES, computePower, degreeFromPower } from './paragonPower.js';
import { canOfferParagon, createApexParagon } from './towers/paragon_dart.js';
import { createGlaiveDominus } from './towers/paragon_boomerang.js';
import { UI } from './ui.js';

// v1.4.1: one creation entry point per paragon type, keyed by the RULES key.
// The menu stays type-generic - cfg drives everything else.
const PARAGON_CREATORS = {
    dart: createApexParagon,
    boomerang: createGlaiveDominus,
};

const MENU_ID = 'paragon-buy-menu';

const state = {
    engine: null,
    tower: null,       // the dart being converted (any tier)
    cfg: null,         // PARAGON_POWER_RULES entry
    wired: false,
};

function el(id) { return document.getElementById(id); }

const fmt$ = (n) => '$' + Math.floor(n).toLocaleString('en-US');

// Every dart-type tower that the sacrifice sweep would consume (same filter
// as createApexParagon, minus the mutation). Heroes, minions, paragons out.
function sacrificeRecords(engine, baseType) {
    return engine.towers
        .filter(t => t && t.type === baseType && !t.stats?.isHero && !t.isMinion && !t.isParagon)
        .map(t => ({
            totalSpent: t.totalSpent || 0,
            upgrades: [...(t.upgrades || [0, 0, 0])],
            damageDealt: t.damageDealt || 0,
        }));
}

// The degree preview for a given extra investment. Mirrors the creation math
// (extra joins the cash pool, capped at the cash-power cap's remaining room).
function preview(engine, cfg, extraCash) {
    const records = sacrificeRecords(engine, cfg.key);
    const power = computePower({ towers: records, totems: 0 }, cfg.key);
    const extraPower = Math.min(extraCash / cfg.cashPerPower, Math.max(0, cfg.cashPowerCap - power.cashPower));
    return {
        records,
        power,
        extraPower,
        total: power.total + extraPower,
        degree: degreeFromPower(power.total + extraPower),
    };
}

// How much extra cash still makes sense: the room left in the cash-power cap
// (money past it buys no degree) and the player's wallet (base cost reserved).
function usefulMaxExtra(engine, cfg, power) {
    const roomPower = Math.max(0, cfg.cashPowerCap - power.cashPower);
    const wallet = Math.max(0, (engine.cash || 0) - (engine.getCost ? engine.getCost(cfg.baseCost) : cfg.baseCost));
    return Math.floor(Math.min(roomPower * cfg.cashPerPower, wallet));
}

function readInput() {
    const input = el('paragon-invest');
    const v = Math.max(0, Math.floor(Number(input && input.value) || 0));
    return v;
}

// v1.4.2: the investment control is a SLIDER (owner ask). Its max always
// tracks the useful maximum (cash-power room vs wallet after the base cost),
// so every slider position is money that actually buys Degree - the old
// "past this point adds no Degree" overflow state can no longer be reached
// by dragging, only typed-over by nothing (the number box is gone).
function syncSlider(extra) {
    const input = el('paragon-invest');
    if (!input || !state.engine || !state.cfg) return;
    const pv = preview(state.engine, state.cfg, 0);
    const cap = usefulMaxExtra(state.engine, state.cfg, pv.power);
    if (input.max === '' || Number(input.max) !== cap) input.max = String(cap);
    const clamped = Math.max(0, Math.min(cap, extra));
    if (Number(input.value) !== clamped) input.value = String(clamped);
    const readout = el('paragon-invest-readout');
    if (readout) readout.innerText = fmt$(clamped);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function refresh() {
    const { engine, tower, cfg } = state;
    if (!engine || !tower || !cfg) return;

    const offer = canOfferParagon(engine, tower, cfg.key);
    if (!offer.eligible) { close(); return; }

    const extra = readInput();
    const pv = preview(engine, cfg, extra);
    const baseCost = offer.cost;
    const totalCost = baseCost + extra;
    const poor = (engine.cash || 0) < totalCost;

    // Power breakdown (mirrors the selected-paragon panel lines).
    const lines = el('paragon-buy-power');
    if (lines) {
        lines.innerHTML =
            `<div class="paragon-power-lines">` +
            `<div>Cash Power: ${Math.round(pv.power.cashPower)} / ${cfg.cashPowerCap.toLocaleString('en-US')}` +
            (pv.extraPower > 0 ? ` <span class="paragon-invest-bonus">(+${Math.round(pv.extraPower)} invested)</span>` : '') +
            `</div>` +
            `<div>Upgrade Power: ${Math.round(pv.power.upgradePower)} / ${cfg.upgradePowerCap.toLocaleString('en-US')}</div>` +
            `<div>Extra T5 Power: ${Math.round(pv.power.extraT5Power)} / ${cfg.extraT5PowerCap.toLocaleString('en-US')}</div>` +
            `<div>Pop Power: ${Math.round(pv.power.popsPower)} / ${cfg.popsPowerCap.toLocaleString('en-US')}</div>` +
            `<div class="paragon-power-total">Total Power: ${Math.round(pv.total)}</div>` +
            `</div>`;
    }

    // The degree readout, big and purple.
    const deg = el('paragon-buy-degree');
    if (deg) {
        deg.innerText = `DEGREE ${pv.degree}`;
        const nextPower = (pv.degree >= 100) ? null : (Math.floor(pv.degree) + 1);
        deg.title = nextPower ? 'Power needed for the next Degree grows with each Degree' : 'Maximum Degree';
    }

    // Investment row helpers.
    const hint = el('paragon-invest-hint');
    if (hint) {
        const cap = usefulMaxExtra(engine, cfg, pv.power);
        hint.innerText = extra >= cap
            ? 'Slider at max - past this point extra cash adds no more Degree.'
            : `Every ${fmt$(cfg.cashPerPower)} invested = +1 Power toward the Degree. Slide or use the quick buttons.`;
    }

    // v1.4.2: keep the slider's max/readout in lockstep with the live
    // wallet (cash can change while the dialog is open - e.g. round payouts).
    syncSlider(extra);

    const total = el('paragon-buy-total');
    if (total) {
        total.innerHTML = `Base cost <b>${fmt$(baseCost)}</b>` +
            (extra > 0 ? ` + investment <b>${fmt$(extra)}</b>` : '') +
            ` &nbsp;=&nbsp; <b>${fmt$(totalCost)}</b>` +
            (poor ? ` <span class="paragon-buy-poor">(not enough cash)</span>` : '');
    }

    const confirm = el('paragon-buy-confirm');
    if (confirm) {
        confirm.innerText = `Create Paragon — ${fmt$(totalCost)}`;
        confirm.disabled = poor || engine.gameState !== 'playing';
        confirm.classList.toggle('poor', poor);
    }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
function open(engine, tower) {
    if (!engine || !tower || tower.isParagon || engine.gameState !== 'playing') return;
    const cfg = PARAGON_POWER_RULES[tower.type];
    if (!cfg) return;

    // v1.4.2: the purple buttons only exist on Tier 5 monkeys, so the menu
    // only opens from one (BTD6: "available on any of the tier 5 monkeys").
    // No backdoor: a non-T5 monkey can never start the purchase.
    if (!(tower.upgrades || []).some(u => u >= 5)) {
        engine.log(`Only a Tier 5 ${tower.stats?.name || cfg.key} can become the Paragon!`);
        return;
    }

    const offer = canOfferParagon(engine, tower, cfg.key);
    if (!offer.eligible) return; // button-visible state only (v1.4.0 gate)

    state.engine = engine;
    state.tower = tower;
    state.cfg = cfg;
    ensureWired();

    const title = el('paragon-buy-title');
    if (title) title.innerText = cfg.name.toUpperCase();
    const sub = el('paragon-buy-sub');
    if (sub) sub.innerText = `Every ${tower.stats?.name || cfg.key} on the field is consumed. Their value and pops become Paragon Power - slide the investment to push the Degree higher.`;
    // v1.4.2: reset the slider (max is re-derived by refresh()/syncSlider).
    const input = el('paragon-invest');
    if (input) input.value = 0;
    const readout = el('paragon-invest-readout');
    if (readout) readout.innerText = fmt$(0);

    refresh();
    UI.toggleMenus(MENU_ID);
    engine.log(`${cfg.name}: choose your investment, then confirm.`);
}

function confirmPurchase() {
    const { engine, tower, cfg } = state;
    if (!engine || !tower || !cfg) { close(); return; }
    if (engine.gameState !== 'playing') { close(); return; }

    const extra = readInput();
    const offer = canOfferParagon(engine, tower, cfg.key);
    if (!offer.offered) { refresh(); return; } // cash changed or state moved on

    const create = PARAGON_CREATORS[cfg.key];
    if (!create) { close(); return; } // rules entry without a creator - nothing to buy
    if (create(tower, engine, extra)) {
        close();
        engine.updateUI();
    } else {
        refresh(); // re-derive why (cash, gate) and update the dialog
    }
}

function close() {
    state.engine = null;
    state.tower = null;
    state.cfg = null;
    const menu = el(MENU_ID);
    if (menu && !menu.classList.contains('hidden')) menu.classList.add('hidden');
}

// One-time DOM wiring for the static dialog markup in index.html.
function ensureWired() {
    if (state.wired) return;
    state.wired = true;

    el('paragon-buy-confirm')?.addEventListener('click', () => confirmPurchase());
    el('paragon-buy-cancel')?.addEventListener('click', () => close());
    el('paragon-buy-close')?.addEventListener('click', () => close());
    el('paragon-invest')?.addEventListener('input', () => refresh());
    // v1.4.2: slider - also refresh when the user drops the thumb anywhere
    // (change fires on release, input fires continuously while dragging).
    el('paragon-invest')?.addEventListener('change', () => refresh());

    const step = (amount) => () => {
        const input = el('paragon-invest');
        if (!input || !state.engine || !state.cfg) return;
        const pv = preview(state.engine, state.cfg, 0);
        const cap = usefulMaxExtra(state.engine, state.cfg, pv.power);
        const next = amount === 'max' ? cap : Math.min(cap, readInput() + amount);
        input.value = Math.max(0, Math.floor(next));
        refresh();
    };
    el('paragon-inv-10k')?.addEventListener('click', step(10000));
    el('paragon-inv-50k')?.addEventListener('click', step(50000));
    el('paragon-inv-max')?.addEventListener('click', step('max'));
}

export const ParagonMenu = { open, close, confirm: confirmPurchase, refresh, preview, usefulMaxExtra };
export default ParagonMenu;
