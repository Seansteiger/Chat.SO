import { Router } from 'express';
import { WebRtcController } from '../controllers/webrtc.controller.js';
import { authenticateJwt } from '../middleware/auth.js';

export const webrtcRouter = Router();

webrtcRouter.use(authenticateJwt);
webrtcRouter.get('/ice-servers', WebRtcController.getIceServers);
