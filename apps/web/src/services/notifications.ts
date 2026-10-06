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

export interface InAppNotification {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: number;
  read: boolean;
}

// In-app notifications listener type
type NotificationListener = (notifications: InAppNotification[]) => void;

// Browser Web Notifications & In-App Notification Center
export class NotificationService {
  private static notificationsList: InAppNotification[] = [];
  private static listeners: Set<NotificationListener> = new Set();

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
      sound.playMessageChime();
      const perm = await Notification.requestPermission();
      return perm;
    } catch {
      return 'denied';
    }
  }

  // Updates tab title and OS app icon badges (Windows taskbar, macOS dock, mobile PWA)
  public static updateBadge(unreadCount: number) {
    try {
      if (typeof document !== 'undefined') {
        if (unreadCount > 0) {
          document.title = `(${unreadCount}) Chat.SO`;
        } else {
          document.title = 'Chat.SO';
        }
      }

      if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
        if (unreadCount > 0) {
          (navigator as any).setAppBadge(unreadCount).catch(() => {});
        } else {
          (navigator as any).clearAppBadge().catch(() => {});
        }
      }
    } catch {
      // Ignored
    }
  }

  // Subscribe to in-app notification center updates
  public static subscribe(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    listener([...this.notificationsList]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public static getNotifications(): InAppNotification[] {
    return [...this.notificationsList];
  }

  public static markAllAsRead() {
    this.notificationsList = this.notificationsList.map((n) => ({ ...n, read: true }));
    this.notifyListeners();
  }

  public static clearAll() {
    this.notificationsList = [];
    this.notifyListeners();
  }

  private static notifyListeners() {
    for (const listener of this.listeners) {
      listener([...this.notificationsList]);
    }
  }

  public static async notify(
    title: string,
    options?: {
      body?: string;
      tag?: string;
      senderId?: string;
      onClick?: () => void;
    }
  ) {
    // 1. Play pleasant two-tone chime sound
    sound.playMessageChime();

    // 2. Add to in-app notifications store
    const newNotif: InAppNotification = {
      id: crypto.randomUUID(),
      senderId: options?.senderId || '',
      senderName: title,
      content: options?.body || 'New message on Chat.SO',
      createdAt: Date.now(),
      read: false,
    };
    this.notificationsList = [newNotif, ...this.notificationsList.slice(0, 49)];
    this.notifyListeners();

    // 3. Dispatch to OS Notifications Panel / Action Center
    if (this.isSupported() && Notification.permission === 'granted') {
      try {
        // Try Service Worker showNotification first (persists to OS Notification Center / Action Center)
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          if (reg) {
            await (reg as any).showNotification(title, {
              body: options?.body || 'New message on Chat.SO',
              icon: '/icons/icon-192.svg',
              badge: '/icons/icon-192.svg',
              tag: options?.tag || `chat-${options?.senderId || 'general'}`,
              renotify: true,
              requireInteraction: true, // Key: Keeps notification in Windows / OS Notifications Panel
              data: {
                url: window.location.href,
                senderId: options?.senderId,
              },
            });
            return;
          }
        }

        // Standard desktop notification fallback
        const n = new Notification(title, {
          body: options?.body || 'New message on Chat.SO',
          icon: '/icons/icon-192.svg',
          badge: '/icons/icon-192.svg',
          tag: options?.tag || 'chatso-message',
          requireInteraction: true,
        } as any);

        n.onclick = () => {
          window.focus();
          if (options?.onClick) options.onClick();
          n.close();
        };
      } catch {
        // Suppressed or closed
      }
    }
  }
}
