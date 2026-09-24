import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import routes from './routes';
import { env } from './config/env';
import { generalLimiter } from './middleware/rateLimit';
import { errorHandler, notFoundHandler } from './middleware/error';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    })
  );

  const allowed = env.CORS_ORIGINS.filter(Boolean);
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || allowed.includes('*') || allowed.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      credentials: false,
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.use('/api', generalLimiter, routes);
  app.use('/static/logos', express.static(path.join(env.UPLOAD_DIR, 'logos')));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
