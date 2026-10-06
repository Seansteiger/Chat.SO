import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validateBody = <T>(schema: ZodSchema<T>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          error: 'Validation Error',
          details: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
        });
        return;
      }
      res.status(400).json({ error: 'Bad Request' });
    }
  };
};

export const validateQuery = <T>(schema: ZodSchema<T>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as any;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          error: 'Validation Error',
          details: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
        });
        return;
      }
      res.status(400).json({ error: 'Bad Request' });
    }
  };
};
