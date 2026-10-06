import { Router } from 'express';
import { FileController } from '../controllers/file.controller.js';
import { authenticateJwt } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { SignUploadUrlSchema } from '@chatso/shared';

export const fileRouter = Router();

fileRouter.post('/sign', authenticateJwt, validateBody(SignUploadUrlSchema), FileController.signUploadUrl);
// Direct PUT upload handler for local simulation
fileRouter.put('/dev-upload/*', FileController.devUpload);
