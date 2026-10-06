import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { validateBody } from '../middleware/validate.js';
import { RegisterSchema, LoginSchema } from '@chatso/shared';
import { authenticateJwt } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/register', validateBody(RegisterSchema), AuthController.register);
authRouter.post('/login', validateBody(LoginSchema), AuthController.login);
authRouter.get('/me', authenticateJwt, AuthController.me);
