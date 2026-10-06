import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller.js';
import { authenticateJwt } from '../middleware/auth.js';

export const chatRouter = Router();

chatRouter.use(authenticateJwt);
chatRouter.get('/:peerId/messages', ChatController.getMessages);
