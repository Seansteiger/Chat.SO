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

  // Disconnect / Call Ended Tone (gentle two-tone descending chime)
  public playCallEndTone() {
    this.stopRingtone();
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      // First descending tone (480 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(480, now);
      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.18);

      // Second lower tone (360 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(360, now + 0.18);
      gain2.gain.setValueAtTime(0.2, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.18);
      osc2.stop(now + 0.45);
    } catch {
      // Audio playback blocked or unavailable
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
  private static activeCallNotification: Notification | null = null;

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

  // Incoming audio/video call notification
  public static async notifyCall(params: {
    callId: string;
    callerName: string;
    callerId: string;
    isVideo?: boolean;
    onAnswer?: () => void;
    onDecline?: () => void;
  }) {
    const title = `Incoming ${params.isVideo ? 'Video' : 'Voice'} Call`;
    const body = `${params.callerName} is calling you on Chat.SO...`;

    // 1. Add to in-app notification list
    const newNotif: InAppNotification = {
      id: crypto.randomUUID(),
      senderId: params.callerId,
      senderName: params.callerName,
      content: `Incoming ${params.isVideo ? 'video' : 'voice'} call`,
      createdAt: Date.now(),
      read: false,
    };
    this.notificationsList = [newNotif, ...this.notificationsList.slice(0, 49)];
    this.notifyListeners();

    // 2. Dispatch high-priority OS notification
    if (this.isSupported() && Notification.permission === 'granted') {
      try {
        if ('serviceWorker' in navigator) {
          const reg = await (navigator.serviceWorker.ready || navigator.serviceWorker.getRegistration());
          if (reg && 'showNotification' in reg) {
            await (reg as any).showNotification(title, {
              body,
              icon: '/icons/icon-192.png',
              badge: '/icons/icon-192.png',
              tag: 'chatso-active-call',
              renotify: true,
              requireInteraction: true,
              vibrate: [500, 250, 500, 250, 500],
              data: {
                type: 'CALL',
                callId: params.callId,
                callerId: params.callerId,
                url: window.location.href,
              },
            });
            return;
          }
        }

        if (this.activeCallNotification) {
          this.activeCallNotification.close();
        }
        // Desktop fallback where Notification constructor is permitted
        if (typeof window !== 'undefined' && 'Notification' in window) {
          const n = new Notification(title, {
            body,
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            tag: 'chatso-active-call',
            requireInteraction: true,
          } as any);

          n.onclick = () => {
            window.focus();
            if (params.onAnswer) params.onAnswer();
            n.close();
          };

          this.activeCallNotification = n;
        }
      } catch (err) {
        console.warn('Call notification error:', err);
      }
    }
  }

  // Dismiss call notification on hangup / accept / reject
  public static async closeCallNotification() {
    try {
      if (this.activeCallNotification) {
        this.activeCallNotification.close();
        this.activeCallNotification = null;
      }
      if (this.isSupported() && 'serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && 'getNotifications' in reg) {
          const notifs = await reg.getNotifications({ tag: 'chatso-active-call' });
          notifs.forEach((n) => n.close());
        }
      }
    } catch {
      // Ignored
    }
  }

  public static async notify(
    title: string,
    options?: {
      body?: string;
      tag?: string;
      senderId?: string;
      silent?: boolean;
      onClick?: () => void;
    }
  ) {
    // 1. Play pleasant two-tone chime sound unless silent is requested
    if (!options?.silent) {
      sound.playMessageChime();
    }

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

    // 3. Dispatch to OS Notifications Panel / Action Center / Mobile notification tray
    if (this.isSupported() && Notification.permission === 'granted') {
      try {
        // Try Service Worker showNotification first (Required for Android & persists to OS Notification Center)
        if ('serviceWorker' in navigator) {
          const reg = await (navigator.serviceWorker.ready || navigator.serviceWorker.getRegistration());
          if (reg && 'showNotification' in reg) {
            await (reg as any).showNotification(title, {
              body: options?.body || 'New message on Chat.SO',
              icon: '/icons/icon-192.png',
              badge: '/icons/icon-192.png',
              tag: options?.tag || `chat-${options?.senderId || 'general'}`,
              renotify: true,
              vibrate: options?.silent ? undefined : [200, 100, 200],
              data: {
                url: window.location.href,
                senderId: options?.senderId,
              },
            });
            return;
          }
        }

        // Standard desktop notification fallback (where Notification constructor is allowed)
        if (typeof window !== 'undefined' && 'Notification' in window) {
          const n = new Notification(title, {
            body: options?.body || 'New message on Chat.SO',
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            tag: options?.tag || 'chatso-message',
          });

          n.onclick = () => {
            window.focus();
            if (options?.onClick) options.onClick();
            n.close();
          };
        }
      } catch (err) {
        console.warn('[NotificationService] notify error:', err);
      }
    }
  }
}
