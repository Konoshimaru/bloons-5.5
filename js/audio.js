import { Config } from './config.js';

export const AudioEngine = {
    ctx: null, sfxVolume: 0.5, musicAudio: null, currentTrack: 0, isPlaying: false,
    playlist: [], 
    history: [], 
    lastPopTime: 0, 
    sfxCache: {}, // Cache for SFX audio elements

    async init() { 
        if (this.ctx) return; 
        this.ctx = new (window.AudioContext || window.webkitAudioContext)(); 
        this.musicAudio = document.getElementById('bg-music');
        this.sfxVolume = Config.data.sfxVolume;
        this.musicAudio.volume = Config.data.musicVolume;
        
        await this.loadPlaylist();
        
        if (this.playlist.length === 0) {
            console.warn("No music found. Ensure manifest.json exists in the music folder.");
            return;
        }

        if (Config.data.musicRandomStart) {
            this.currentTrack = Math.floor(Math.random() * this.playlist.length);
        } else {
            this.currentTrack = 0;
        }
        
        this.loadTrack(this.currentTrack);
        this.musicAudio.addEventListener('ended', () => this.nextTrack());
    },

    async loadPlaylist() {
        try {
            const manifestRes = await fetch('./music/manifest.json');
            if (manifestRes.ok) {
                const manifest = await manifestRes.json();
                if (manifest && manifest.songs && manifest.songs.length > 0) {
                    this.playlist = manifest.songs.map(s => s.startsWith('music/') ? s : `music/${s}`);
                    console.log("Loaded music from manifest:", this.playlist);
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
                    const absoluteUrl = new URL(href, baseUrl).href;
                    mp3s.push(absoluteUrl);
                }
            });
            if (mp3s.length > 0) {
                this.playlist = mp3s;
                console.log("Discovered music files:", this.playlist);
            } else {
                throw new Error("No mp3s found");
            }
        } catch (e) {
            console.warn("Could not fetch music. Game will run silently.", e);
            this.playlist = [];
        }
    },

    loadTrack(index) {
        if (index < 0 || index >= this.playlist.length) return;
        this.currentTrack = index;
        this.musicAudio.src = this.playlist[index];
        if (this.isPlaying) this.play();
    },

    setSfxVolume(v) { this.sfxVolume = v; Config.data.sfxVolume = v; Config.save(); },
    setMusicVolume(v) { if (this.musicAudio) this.musicAudio.volume = v; Config.data.musicVolume = v; Config.save(); },
    play() { if (this.musicAudio && this.musicAudio.src) { this.musicAudio.play().catch(e=>{}); this.isPlaying = true; } },
    pause() { if (this.musicAudio) { this.musicAudio.pause(); this.isPlaying = false; } },
    
    nextTrack() {
        if (this.playlist.length === 0) return;
        let nextIndex;
        if (Config.data.musicShuffle) {
            if (this.playlist.length > 1) {
                do { nextIndex = Math.floor(Math.random() * this.playlist.length); } while (nextIndex === this.currentTrack);
            } else { nextIndex = 0; }
            this.history.push(this.currentTrack);
        } else {
            nextIndex = (this.currentTrack + 1) % this.playlist.length;
        }
        this.loadTrack(nextIndex);
    },
    
    prevTrack() {
        if (this.playlist.length === 0) return;
        let prevIndex;
        if (Config.data.musicShuffle && this.history.length > 0) {
            prevIndex = this.history.pop();
        } else {
            prevIndex = (this.currentTrack - 1 + this.playlist.length) % this.playlist.length;
        }
        this.loadTrack(prevIndex);
    },

    playSfx(type) {
        if (!this.ctx) return;
        
        let path = '';
        let isFile = false;
        
        // PRO FEATURE: Dynamic SFX file loading
        if (type === 'pop') {
            let r = Math.floor(Math.random() * 4) + 1;
            path = `sfx/pop${r}.mp3`;
            isFile = true;
        } else if (type === 'ceramic_hit') {
            path = `sfx/ceramic_hit.mp3`;
            isFile = true;
        } else if (type === 'moab_hit') {
            let r = Math.floor(Math.random() * 3) + 1;
            path = `sfx/moab_hit${r}.mp3`;
            isFile = true;
        } else if (type === 'moab_destroy') {
            let r = Math.floor(Math.random() * 3) + 1;
            path = `sfx/moab_destroy${r}.mp3`;
            isFile = true;
        } else if (type === 'lead_hit') {
            path = `sfx/lead_hit.mp3`;
            isFile = true;
        } else if (type === 'frozen_hit') {
            path = `sfx/frozen_hit.mp3`;
            isFile = true;
        }

        if (isFile) {
            // Throttle pop sounds so 1000 bloons dying at once doesn't crash the browser
            if (type === 'pop') {
                const now = performance.now();
                if (now - this.lastPopTime < 50) return; 
                this.lastPopTime = now;
            }
            
            let sound = this.sfxCache[path];
            if (!sound) {
                sound = new Audio(path);
                this.sfxCache[path] = sound;
            }
            sound.volume = this.sfxVolume;
            sound.currentTime = 0;
            sound.play().catch(e=>{});
            return;
        }

        // Synth fallback for UI sounds (shoot, place, cash)
        try {
            const o = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            o.connect(g); g.connect(this.ctx.destination);
            g.gain.value = Math.max(0.0001, this.sfxVolume * 0.1);
            
            if (type === 'shoot') { o.type = 'square'; o.frequency.value = 400; g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.05); o.start(); o.stop(this.ctx.currentTime + 0.05); }
            else if (type === 'place') { o.frequency.setValueAtTime(400, this.ctx.currentTime); o.frequency.linearRampToValueAtTime(800, this.ctx.currentTime + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.15); o.start(); o.stop(this.ctx.currentTime + 0.15); }
            else if (type === 'cash') { o.frequency.setValueAtTime(1200, this.ctx.currentTime); o.frequency.linearRampToValueAtTime(1600, this.ctx.currentTime + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.15); o.start(); o.stop(this.ctx.currentTime + 0.15); }
            
            o.onended = () => { o.disconnect(); g.disconnect(); };
        } catch (e) { console.error("Audio playback error safely caught:", e); }
    }
};