// audio.js
// Handles music and sound effect playback for the game.

import { Config } from './config.js';

const SFX_VOLUME_MODIFIER = 0.1;
const MIN_VOLUME = 0.0001;
const POP_THROTTLE_MS = 50;
const SHOOT_THROTTLE_MS = 30;
const DEFAULT_PLAYLIST = ['music/music1.mp3', 'music/music2.mp3', 'music/music3.mp3'];
const SFX_ASSET_MAP = {
    pop: ['pop1.mp3', 'pop2.mp3', 'pop3.mp3', 'pop4.mp3'],
    moab_destroy: ['moab_destroy1.mp3', 'moab_destroy2.mp3', 'moab_destroy3.mp3'],
    moab_hit: ['moab_hit1.mp3', 'moab_hit2.mp3', 'moab_hit3.mp3'],
    ceramic_hit: ['ceramic_hit.mp3'],
    frozen_hit: ['frozen_hit.mp3'],
    lead_hit: ['lead_hit.mp3']
};

// Internal state is kept in module scope so the audio engine can manage playback without creating extra objects.
let ctx = null;
let musicAudio = null;
let sfxVolume = 0.5;
let playlist = [];
let history = [];
let currentTrack = 0;
let isPlaying = false;
let lastPopTime = 0;
let lastShootTime = 0;

// Internal helpers resolve the music playlist from the manifest first, then fall back to a directory scan.
async function _loadPlaylistInternal() {
    try {
        const manifestRes = await fetch('./music/manifest.json');
        if (manifestRes.ok) {
            const manifest = await manifestRes.json();
            if (manifest?.songs?.length > 0) {
                playlist = manifest.songs.map(s => s.startsWith('music/') ? s : `music/${s}`);
                console.log("Loaded music from manifest:", playlist);
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
            playlist = mp3s;
            console.log("Discovered music files:", playlist);
        } else {
            throw new Error("No mp3s found");
        }
    } catch (e) {
        console.warn("Could not fetch music. Falling back to default list.", e);
        playlist = [...DEFAULT_PLAYLIST];
    }
}

function _loadTrackInternal(index) {
    if (index < 0 || index >= playlist.length) return;
    currentTrack = index;
    if (musicAudio) {
        musicAudio.src = playlist[index];
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
        // Lazy-init the browser audio context and prepare the current track list once the page is ready.
        if (ctx) return;
        
        try {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            musicAudio = document.getElementById('bg-music');
            sfxVolume = Config.data.sfxVolume ?? 0.5;
            
            if (musicAudio) {
                musicAudio.volume = Config.data.musicVolume ?? 0.3;
            }
            
            await _loadPlaylistInternal();
            
            if (playlist.length === 0) {
                console.warn("No music found. Ensure manifest.json exists in the music folder.");
                return;
            }

            currentTrack = Config.data.musicRandomStart 
                ? Math.floor(Math.random() * playlist.length) 
                : 0;
            
            _loadTrackInternal(currentTrack);
            
            if (musicAudio) {
                musicAudio.addEventListener('ended', () => this.nextTrack());
            }
        } catch (e) {
            console.error("Failed to initialize AudioEngine:", e);
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
        if (playlist.length === 0) return;
        let nextIndex;
        if (Config.data.musicShuffle) {
            if (playlist.length > 1) {
                do {
                    nextIndex = Math.floor(Math.random() * playlist.length);
                } while (nextIndex === currentTrack);
            } else {
                nextIndex = 0;
            }
            history.push(currentTrack);
        } else {
            nextIndex = (currentTrack + 1) % playlist.length;
        }
        _loadTrackInternal(nextIndex);
    },

    prevTrack() {
        if (playlist.length === 0) return;
        let prevIndex;
        if (Config.data.musicShuffle && history.length > 0) {
            prevIndex = history.pop();
        } else {
            prevIndex = (currentTrack - 1 + playlist.length) % playlist.length;
        }
        _loadTrackInternal(prevIndex);
    },

    playSfx(type) {
        const now = performance.now();

        if (type === 'pop' && now - lastPopTime < POP_THROTTLE_MS) return;
        if (type === 'shoot' && now - lastShootTime < SHOOT_THROTTLE_MS) return;

        if (type === 'pop') lastPopTime = now;
        if (type === 'shoot') lastShootTime = now;

        const asset = resolveSfxAsset(type);
        if (asset) {
            try {
                const audio = new Audio(asset);
                audio.preload = 'auto';
                audio.volume = Math.max(MIN_VOLUME, sfxVolume * 0.75);
                audio.play().catch(() => undefined);
                return;
            } catch (e) {
                console.warn("Failed to play SFX asset, falling back to synth:", e);
            }
        }

        if (!ctx) return;

        try {
            // Fallback to lightweight synthesized tones for UI feedback when no dedicated asset exists.
            if (ctx.state === 'suspended') {
                ctx.resume();
            }

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
                    o.start();
                    o.stop(ctx.currentTime + 0.1);
                    break;
                case 'shoot':
                    o.type = 'square';
                    o.frequency.setValueAtTime(400, ctx.currentTime);
                    g.gain.exponentialRampToValueAtTime(MIN_VOLUME, ctx.currentTime + 0.05);
                    o.start();
                    o.stop(ctx.currentTime + 0.05);
                    break;
                case 'place':
                    o.frequency.setValueAtTime(400, ctx.currentTime);
                    o.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.1);
                    g.gain.exponentialRampToValueAtTime(MIN_VOLUME, ctx.currentTime + 0.15);
                    o.start();
                    o.stop(ctx.currentTime + 0.15);
                    break;
                case 'cash':
                    o.frequency.setValueAtTime(1200, ctx.currentTime);
                    o.frequency.linearRampToValueAtTime(1600, ctx.currentTime + 0.1);
                    g.gain.exponentialRampToValueAtTime(MIN_VOLUME, ctx.currentTime + 0.15);
                    o.start();
                    o.stop(ctx.currentTime + 0.15);
                    break;
                case 'leak':
                    o.type = 'sawtooth';
                    o.frequency.setValueAtTime(150, ctx.currentTime);
                    o.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.2);
                    g.gain.exponentialRampToValueAtTime(MIN_VOLUME, ctx.currentTime + 0.2);
                    o.start();
                    o.stop(ctx.currentTime + 0.2);
                    break;
            }

            o.onended = () => {
                o.disconnect();
                g.disconnect();
            };
        } catch (e) {
            console.error("Audio playback error safely caught:", e);
        }
    }
};

