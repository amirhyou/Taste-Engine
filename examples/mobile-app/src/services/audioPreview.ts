// Lazy-load expo-av so the app still builds if the dependency isn't installed.
import { Platform } from 'react-native';

class AudioPreview {
    private sound: any = null;
    private currentUrl: string | null = null;
    private Audio: any = null;
    private webAudio: HTMLAudioElement | null = null;

    private async ensureAudio() {
        if (Platform.OS === 'web') return;
        if (this.Audio) return;
        try {
            // Use eval to avoid bundler resolution when expo-av isn't installed.
            const mod = await Promise.resolve().then(() => (eval('require') as any)('expo-av'));
            this.Audio = mod?.Audio;
            if (!this.Audio) throw new Error('expo-av not available');
        } catch (err) {
            this.Audio = null;
            throw err instanceof Error ? err : new Error('expo-av not available');
        }
    }

    async play(url: string) {
        if (Platform.OS === 'web') {
            try {
                if (this.webAudio) {
                    this.webAudio.pause();
                }
                this.webAudio = new Audio(url);
                await this.webAudio.play();
                this.currentUrl = url;
            } catch (err) {
                throw err instanceof Error ? err : new Error('Web audio playback failed');
            }
            return;
        }
        await this.ensureAudio();
        if (this.currentUrl === url && this.sound) {
            await this.sound.replayAsync();
            return;
        }
        await this.stop();
        const { sound } = await this.Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });
        this.sound = sound;
        this.currentUrl = url;
    }

    async stop() {
        if (Platform.OS === 'web') {
            if (this.webAudio) {
                try { this.webAudio.pause(); } catch {}
            }
            this.webAudio = null;
            this.currentUrl = null;
            return;
        }
        if (this.sound) {
            try { await this.sound.stopAsync(); } catch {}
            try { await this.sound.unloadAsync(); } catch {}
        }
        this.sound = null;
        this.currentUrl = null;
    }
}

export const audioPreview = new AudioPreview();
