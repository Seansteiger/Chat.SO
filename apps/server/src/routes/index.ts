import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { userRouter } from './user.routes.js';
import { chatRouter } from './chat.routes.js';
import { fileRouter } from './file.routes.js';
import { webrtcRouter } from './webrtc.routes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/conversations', chatRouter);
apiRouter.use('/files', fileRouter);
apiRouter.use('/webrtc', webrtcRouter);
