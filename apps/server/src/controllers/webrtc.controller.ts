import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { WebRtcService } from '../services/webrtc.service.js';

export class WebRtcController {
  static getIceServers(req: AuthenticatedRequest, res: Response): void {
    try {
      const userId = req.user?.userId || 'anonymous';
      const config = WebRtcService.getIceServers(userId);
      res.json(config);
    } catch (err) {
      console.error('[WebRtc.getIceServers] Error:', err);
      res.status(500).json({ error: 'Failed to retrieve ICE servers' });
    }
  }
}
