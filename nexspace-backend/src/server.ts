import express, { json } from 'express';
import setupRouter from './routes/setup.js';
import signin from './routes/signin.js';
import { config } from './config/env.js';
import me from './routes/auth.me.js';
import { ensureRedisReady } from './middleware/redis.js';
import cookieParser from 'cookie-parser';
import { responseWrapper } from './middleware/response.js';
import { errorHandler, notFound } from './middleware/error.js';

const app = express();
app.use(json());
app.use(cookieParser());
app.use(responseWrapper);

await ensureRedisReady();
// routes
app.use('/auth', me);
app.use('/auth', signin);
app.use('/', setupRouter);
// health check
app.get('/health', (_req, res) => res.success({ message: 'ok' }));
// 404 + error handler (must be last)
app.use(notFound);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});

