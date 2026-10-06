// Web Audio synthetic chimes for zero-latency notification sounds
class SoundService {
  private audioCtx: AudioContext | null = null;
  private ringtoneInterval: number | null = null;

  private getContext(): AudioContext | null {
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  // Pleasant subtle two-tone chime for incoming chat message (D5 -> A5)
  public playMessageChime() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5 note
      osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.08); // A5 note

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch {
      // Audio playback blocked or unavailable
    }
  }

  // Ringtone for incoming audio/video calls
  public startRingtone() {
    this.stopRingtone();
    this.playRingTonePulse();
    this.ringtoneInterval = window.setInterval(() => {
      this.playRingTonePulse();
    }, 2400);
  }

  public stopRingtone() {
    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }
  }

  private playRingTonePulse() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      [0, 0.25].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now + offset); // A4
        osc.frequency.setValueAtTime(480, now + offset + 0.05); // B4

        gain.gain.setValueAtTime(0.2, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + offset);
        osc.stop(now + offset + 0.2);
      });
    } catch {
      // Audio blocked
    }
  }
}

export const sound = new SoundService();

// Browser Web Notifications
export class NotificationService {
  public static isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  public static getPermission(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  }

  public static async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) return 'denied';
    try {
      // Must resume audio on user gesture
      sound.playMessageChime();
      const perm = await Notification.requestPermission();
      return perm;
    } catch {
      return 'denied';
    }
  }

  public static notify(title: string, options?: { body?: string; tag?: string; onClick?: () => void }) {
    // 1. Always play chime sound
    sound.playMessageChime();

    // 2. If desktop notifications permitted and tab not focused, show native OS notification
    if (this.isSupported() && Notification.permission === 'granted') {
      try {
        const n = new Notification(title, {
          body: options?.body || 'New message on Chat.SO',
          icon: '/icons/icon-192.svg',
          tag: options?.tag || 'chatso-message',
        });

        n.onclick = () => {
          window.focus();
          if (options?.onClick) options.onClick();
          n.close();
        };
      } catch {
        // Notification creation error ignored
      }
    }
  }
}
