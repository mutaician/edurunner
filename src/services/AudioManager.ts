// Audio Manager - handles all game sounds and music

import { Scene, Sound, Engine } from '@babylonjs/core';

export class AudioManager {
    private scene: Scene;
    private bgMusic: Sound | null = null;
    private correctSound: HTMLAudioElement | null = null;
    private wrongSound: HTMLAudioElement | null = null;
    private isMuted: boolean = false;
    private musicVolume: number = 0.2;
    private sfxVolume: number = 0.5;
    private musicReady: boolean = false;
    private pendingMusicPlay: boolean = false;

    constructor(scene: Scene) {
        this.scene = scene;
        this.loadSounds();
        
        // Unlock audio on first user interaction (required by browsers)
        Engine.audioEngine?.unlock();
    }

    private loadSounds(): void {
        // Background music - use Babylon.js Sound for looping
        this.bgMusic = new Sound(
            "bgm",
            "/assets/audio/neon-highway-loop.mp3",
            this.scene,
            () => {
                console.log('Background music loaded');
                this.musicReady = true;
                // If we tried to play before ready, play now
                if (this.pendingMusicPlay && !this.isMuted) {
                    this.bgMusic?.play();
                    this.pendingMusicPlay = false;
                }
            },
            {
                loop: true,
                autoplay: false,
                volume: this.musicVolume
            }
        );

        // Use HTML5 Audio for one-shot sound effects (more reliable)
        this.correctSound = new Audio('/assets/audio/correct.wav');
        this.correctSound.volume = this.sfxVolume;
        this.correctSound.preload = 'auto';
        this.correctSound.addEventListener('canplaythrough', () => {
            console.log('Correct sound loaded');
        });

        this.wrongSound = new Audio('/assets/audio/wrong.wav');
        this.wrongSound.volume = this.sfxVolume;
        this.wrongSound.preload = 'auto';
        this.wrongSound.addEventListener('canplaythrough', () => {
            console.log('Wrong sound loaded');
        });
    }

    public startMusic(): void {
        if (this.isMuted) return;
        
        // Ensure audio is unlocked
        Engine.audioEngine?.unlock();
        
        if (this.bgMusic && this.musicReady) {
            if (!this.bgMusic.isPlaying) {
                this.bgMusic.play();
            }
        } else {
            // Music not loaded yet, mark as pending
            this.pendingMusicPlay = true;
        }
    }

    public stopMusic(): void {
        if (this.bgMusic && this.bgMusic.isPlaying) {
            this.bgMusic.stop();
        }
    }

    public pauseMusic(): void {
        if (this.bgMusic && this.bgMusic.isPlaying) {
            this.bgMusic.pause();
        }
    }

    public resumeMusic(): void {
        if (this.bgMusic && !this.isMuted && this.musicReady) {
            this.bgMusic.play();
        }
    }

    public playCorrect(): void {
        if (this.correctSound && !this.isMuted) {
            // Reset to beginning and play
            this.correctSound.currentTime = 0;
            this.correctSound.play().catch(e => console.warn('Correct sound play failed:', e));
        }
    }

    public playWrong(): void {
        if (this.wrongSound && !this.isMuted) {
            // Reset to beginning and play
            this.wrongSound.currentTime = 0;
            this.wrongSound.play().catch(e => console.warn('Wrong sound play failed:', e));
        }
    }

    public toggleMute(): boolean {
        this.isMuted = !this.isMuted;
        
        if (this.isMuted) {
            this.pauseMusic();
        } else {
            this.resumeMusic();
        }
        
        return this.isMuted;
    }

    public setMuted(muted: boolean): void {
        this.isMuted = muted;
        if (muted) {
            this.pauseMusic();
        }
    }

    public isMutedState(): boolean {
        return this.isMuted;
    }

    public setMusicVolume(volume: number): void {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        if (this.bgMusic) {
            this.bgMusic.setVolume(this.musicVolume);
        }
    }

    public setSfxVolume(volume: number): void {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
        if (this.correctSound) {
            this.correctSound.volume = this.sfxVolume;
        }
        if (this.wrongSound) {
            this.wrongSound.volume = this.sfxVolume;
        }
    }

    public dispose(): void {
        if (this.bgMusic) {
            this.bgMusic.dispose();
        }
        // HTMLAudioElement doesn't need explicit disposal
        this.correctSound = null;
        this.wrongSound = null;
    }
}

// Singleton instance
let audioManagerInstance: AudioManager | null = null;

export function initAudioManager(scene: Scene): AudioManager {
    audioManagerInstance = new AudioManager(scene);
    return audioManagerInstance;
}

export function getAudioManager(): AudioManager | null {
    return audioManagerInstance;
}
