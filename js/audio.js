// js/audio.js
import { Config } from './config.js';

const SFX_VOLUME_MODIFIER = 0.1;
const MIN_VOLUME = 0.0001;
const POP_THROTTLE_MS = 50;
const SHOOT_THROTTLE_MS = 30;
const HIT_THROTTLE_MS = 100; // Prevents hit sounds from queueing up
const MOAB_DESTROY_THROTTLE_MS = 200; // FIX: Prevents explosion sounds from queueing up
const DEFAULT_GAME_PLAYLIST = ['music/music1.mp3', 'music/music2.mp3', 'music/music3.mp3'];
const MENU_PLAYLIST = ['music/mainmenu_1.mp3', 'music/mainmenu_2.mp3'];

// FIX: Added knight_slash_moab to the map
const SFX_ASSET_MAP = {
    pop: ['pop1.mp3', 'pop2.mp3', 'pop3.mp3', 'pop4.mp3'],
    moab_destroy: ['moab_destroy1.mp3', 'moab_destroy2.mp3', 'moab_destroy3.mp3'],
    moab_hit: ['moab_hit1.mp3', 'moab_hit2.mp3', 'moab_hit3.mp3'],
    ceramic_hit: ['ceramic_hit.mp3'],
    frozen_hit: ['frozen_hit.mp3'],
    lead_hit: ['lead_hit.mp3'],
    knight_slash_moab: ['knight_slash_moab.mp3'], // FIX: Added slash sound
    sauda_attack: ['Sauda_attack_1.mp3', 'Sauda_attack_2.mp3', 'Sauda_attack_3.mp3', 'Sauda_attack_4.mp3', 'Sauda_attack_5.mp3'],
    sauda_leap_activate: ['LeapingSword_activate.mp3'],
    sauda_leap_landing: ['LeapingSword_landing.mp3'],
    sauda_charge: ['SwordCharge.mp3']
};

let ctx = null;
let musicAudio = null;
let sfxVolume = 0.5;
let gamePlaylist = [];
let activePlaylist = MENU_PLAYLIST; // Start with menu music
let history = [];
let currentTrack = 0;
let isPlaying = false;
let lastPopTime = 0;
let lastShootTime = 0;
let lastHitTime = 0;
let lastMoabDestroyTime = 0;

const sfxBufferCache = new Map();

async function _loadPlaylistInternal() {
    try {
        const manifestRes = await fetch('./music/manifest.json');
        if (manifestRes.ok) {
            const manifest = await manifestRes.json();
            if (manifest?.songs?.length > 0) {
                gamePlaylist = manifest.songs.map(s => s.startsWith('music/') ? s : `music/${s}`);
                return;
            }
        }
        
        const response = await fetch('./music/');
        if (!response.ok) throw new Error("Directory listing blocked");
        
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const links = doc.querySelectorAll('a');
        const mp3s = [];
        const baseUrl = new URL('./music/', window.location.href);
        
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (href && href.toLowerCase().endsWith('.mp3')) {
                mp3s.push(new URL(href, baseUrl).href);
            }
        });
        
        if (mp3s.length > 0) {
            gamePlaylist = mp3s;
        } else {
            throw new Error("No mp3s found");
        }
    } catch (e) {
        gamePlaylist = [...DEFAULT_GAME_PLAYLIST];
    }
}

function _loadTrackInternal(index) {
    if (index < 0 || index >= activePlaylist.length) return;
    currentTrack = index;
    if (musicAudio) {
        musicAudio.src = activePlaylist[index];
        if (isPlaying) AudioEngine.play();
    }
}

export function getSfxAssetChoices(type) {
    return SFX_ASSET_MAP[type] ?? [];
}

export function resolveSfxAsset(type) {
    const choices = getSfxAssetChoices(type);
    if (choices.length === 0) return null;
    const file = choices[Math.floor(Math.random() * choices.length)];
    return new URL(`../sfx/${file}`, import.meta.url).href;
}

export const AudioEngine = {
    async init() {
        if (ctx) return;
        
        try {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            musicAudio = document.getElementById('bg-music');
            sfxVolume = Config.data.sfxVolume ?? 0.5;
            
            if (musicAudio) {
                musicAudio.volume = Config.data.musicVolume ?? 0.3;
            }
            
            await _loadPlaylistInternal();
            if (musicAudio) {
                musicAudio.addEventListener('ended', () => this.nextTrack());
            }
            
            await this._preloadSfx();
        } catch (e) {
            console.error("Failed to initialize AudioEngine:", e);
        }
    },

    async _preloadSfx() {
        if (!ctx) return;
        const uniqueFiles = new Set();
        for (const type in SFX_ASSET_MAP) {
            for (const file of SFX_ASSET_MAP[type]) {
                uniqueFiles.add(file);
            }
        }
        
        const promises = [];
        for (const file of uniqueFiles) {
            promises.push(this._fetchAndDecodeSfx(file));
        }
        await Promise.all(promises);
    },

    async _fetchAndDecodeSfx(file) {
        try {
            const url = new URL(`../sfx/${file}`, import.meta.url).href;
            const response = await fetch(url);
            if (!response.ok) return;
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            sfxBufferCache.set(file, audioBuffer);
        } catch (e) {
            console.warn(`Failed to preload SFX: ${file}`, e);
        }
    },

    setSfxVolume(v) {
        sfxVolume = v;
        Config.data.sfxVolume = v;
        Config.save();
    },

    setMusicVolume(v) {
        if (musicAudio) musicAudio.volume = v;
        Config.data.musicVolume = v;
        Config.save();
    },

    playGameMusic() {
        if (activePlaylist === gamePlaylist && isPlaying) return;
        activePlaylist = gamePlaylist;
        currentTrack = Config.data.musicRandomStart ? Math.floor(Math.random() * activePlaylist.length) : 0;
        _loadTrackInternal(currentTrack);
        this.play();
    },

    playMenuMusic() {
        if (activePlaylist === MENU_PLAYLIST && isPlaying) return;
        activePlaylist = MENU_PLAYLIST;
        currentTrack = Math.floor(Math.random() * activePlaylist.length);
        _loadTrackInternal(currentTrack);
        this.play();
    },

    play() {
        if (musicAudio && musicAudio.src) {
            musicAudio.play().catch(e => console.warn("Audio play blocked:", e));
            isPlaying = true;
        }
    },

    pause() {
        if (musicAudio) {
            musicAudio.pause();
            isPlaying = false;
        }
    },

    nextTrack() {
        if (activePlaylist.length === 0) return;
        let nextIndex;
        if (Config.data.musicShuffle) {
            if (activePlaylist.length > 1) {
                do {
                    nextIndex = Math.floor(Math.random() * activePlaylist.length);
                } while (nextIndex === currentTrack);
            } else {
                nextIndex = 0;
            }
            history.push(currentTrack);
        } else {
            nextIndex = (currentTrack + 1) % activePlaylist.length;
        }
        _loadTrackInternal(nextIndex);
    },

    prevTrack() {
        if (activePlaylist.length === 0) return;
        let prevIndex;
        if (Config.data.musicShuffle && history.length > 0) {
            prevIndex = history.pop();
        } else {
            prevIndex = (currentTrack - 1 + activePlaylist.length) % activePlaylist.length;
        }
        _loadTrackInternal(prevIndex);
    },

    playSfx(type) {
        const now = performance.now();

        if (type === 'pop' && now - lastPopTime < POP_THROTTLE_MS) return;
        if (type === 'shoot' && now - lastShootTime < SHOOT_THROTTLE_MS) return;
        if (type === 'moab_destroy' && now - lastMoabDestroyTime < MOAB_DESTROY_THROTTLE_MS) return;
        
        const isHitSound = ['moab_hit', 'ceramic_hit', 'frozen_hit', 'lead_hit'].includes(type);
        if (isHitSound && now - lastHitTime < HIT_THROTTLE_MS) return;

        if (type === 'pop') lastPopTime = now;
        if (type === 'shoot') lastShootTime = now;
        if (type === 'moab_destroy') lastMoabDestroyTime = now;
        if (isHitSound) lastHitTime = now;

        const choices = getSfxAssetChoices(type);
        if (choices.length > 0) {
            const file = choices[Math.floor(Math.random() * choices.length)];
            const buffer = sfxBufferCache.get(file);
            
            if (buffer && ctx) {
                try {
                    if (ctx.state === 'suspended') ctx.resume();
                    
                    const source = ctx.createBufferSource();
                    const gainNode = ctx.createGain();
                    source.buffer = buffer;
                    source.connect(gainNode);
                    gainNode.connect(ctx.destination);
                    
                    const vol = Math.max(MIN_VOLUME, sfxVolume * 0.75);
                    gainNode.gain.setValueAtTime(vol, ctx.currentTime);
                    
                    source.start(0);
                    return;
                } catch (e) {
                    // Fallback to Audio element below
                }
            }
            
            const asset = new URL(`../sfx/${file}`, import.meta.url).href;
            try {
                const audio = new Audio(asset);
                audio.preload = 'auto';
                audio.volume = Math.max(MIN_VOLUME, sfxVolume * 0.75);
                audio.play().catch(() => undefined);
                return;
            } catch (e) {
                // Fallback to synth below
            }
        }

        if (!ctx) return;

        // Synth fallback
        try {
            if (ctx.state === 'suspended') ctx.resume();

            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g);
            g.connect(ctx.destination);

            const vol = Math.max(MIN_VOLUME, sfxVolume * SFX_VOLUME_MODIFIER);
            g.gain.setValueAtTime(vol, ctx.currentTime);

            switch (type) {
                case 'pop':
                    o.frequency.setValueAtTime(800, ctx.currentTime);
                    o.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);
                    g.gain.exponentialRampToValueAtTime(MIN_VOLUME, ctx.currentTime + 0.1);
                    o.start(); o.stop(ctx.currentTime + 0.1);
                    break;
                case 'shoot':
                    o.type = 'square';
                    o.frequency.setValueAtTime(400, ctx.currentTime);
                    g.gain.exponentialRampToValueAtTime(MIN_VOLUME, ctx.currentTime + 0.05);
                    o.start(); o.stop(ctx.currentTime + 0.05);
                    break;
                case 'place':
                    o.frequency.setValueAtTime(400, ctx.currentTime);
                    o.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.1);
                    g.gain.exponentialRampToValueAtTime(MIN_VOLUME, ctx.currentTime + 0.15);
                    o.start(); o.stop(ctx.currentTime + 0.15);
                    break;
                case 'cash':
                    o.frequency.setValueAtTime(1200, ctx.currentTime);
                    o.frequency.linearRampToValueAtTime(1600, ctx.currentTime + 0.1);
                    g.gain.exponentialRampToValueAtTime(MIN_VOLUME, ctx.currentTime + 0.15);
                    o.start(); o.stop(ctx.currentTime + 0.15);
                    break;
                case 'leak':
                    o.type = 'sawtooth';
                    o.frequency.setValueAtTime(150, ctx.currentTime);
                    o.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.2);
                    g.gain.exponentialRampToValueAtTime(MIN_VOLUME, ctx.currentTime + 0.2);
                    o.start(); o.stop(ctx.currentTime + 0.2);
                    break;
            }

            o.onended = () => { o.disconnect(); g.disconnect(); };
        } catch (e) {}
    }
};