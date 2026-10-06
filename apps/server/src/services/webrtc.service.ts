import crypto from 'crypto';
import { config } from '../config/index.js';

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export class WebRtcService {
  /**
   * Generates dynamic ICE servers configuration including public STUN
   * and optional dynamic HMAC-SHA1 TURN relay credentials.
   */
  static getIceServers(userId: string): { iceServers: IceServerConfig[] } {
    const iceServers: IceServerConfig[] = [
      {
        urls: [
          'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302',
          'stun:stun2.l.google.com:19302',
          'stun:stun.cloudflare.com:3478',
        ],
      },
    ];

    // If Turn Server is configured with a shared secret
    if (config.turnSecret && config.turnServerUrl) {
      const ttlSeconds = 24 * 3600; // 24 hours
      const timestamp = Math.floor(Date.now() / 1000) + ttlSeconds;
      const turnUsername = `${timestamp}:${userId}`;
      const hmac = crypto.createHmac('sha1', config.turnSecret);
      hmac.update(turnUsername);
      const turnCredential = hmac.digest('base64');

      iceServers.push({
        urls: [
          `turn:${config.turnServerUrl}:3478?transport=udp`,
          `turn:${config.turnServerUrl}:3478?transport=tcp`,
        ],
        username: turnUsername,
        credential: turnCredential,
      });
    }

    return { iceServers };
  }
}
