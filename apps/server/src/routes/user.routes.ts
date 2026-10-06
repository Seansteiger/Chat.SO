import { Router } from 'express';
import { UserController } from '../controllers/user.controller.js';
import { authenticateJwt } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { UpdateProfileSchema } from '@chatso/shared';

export const userRouter = Router();

userRouter.use(authenticateJwt);
userRouter.get('/', UserController.getUsers);
userRouter.patch('/profile', validateBody(UpdateProfileSchema), UserController.updateProfile);
