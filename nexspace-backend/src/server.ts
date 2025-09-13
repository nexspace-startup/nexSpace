import express, { json } from 'express';
import setupRouter from './routes/setup.js';
import signin from './routes/signin.js';
import workspaceRouter from './routes/workspace.js';
import { config } from './config/env.js';
import me from './routes/auth.me.js';
import { ensureRedisReady, closeRedis } from './middleware/redis.js';
import cookieParser from 'cookie-parser';
import { responseWrapper } from './middleware/response.js';
import { attachSession } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/error.js';
import { closePrisma } from './prisma.js';

const app = express();
app.disable('x-powered-by');
// trust proxy when deployed behind a reverse proxy (for secure cookies/IP)
if (config.nodeEnv === 'production') app.set('trust proxy', 1);
app.use(json());
app.use(cookieParser());
app.use(responseWrapper);
app.use(attachSession);

// Minimal CORS (no extra deps) for browser client with credentials
app.use((req, res, next) => {
  const origin = config.webOrigin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

await ensureRedisReady();
// routes
app.use('/auth', me);
app.use('/auth', signin);
app.use('/', setupRouter);
app.use('/workspace', workspaceRouter);
// health check
app.get('/health', (_req, res) => res.success({ message: 'ok' }));
// 404 + error handler (must be last)
app.use(notFound);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});

// Graceful shutdown: close HTTP, Prisma, Redis
async function shutdown(signal: string) {
  try {
    console.log(`\n[shutdown] received ${signal}, closing...`);
    server.close(() => {
      console.log('[shutdown] http server closed');
    });
    await Promise.allSettled([closePrisma(), closeRedis()]);
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
