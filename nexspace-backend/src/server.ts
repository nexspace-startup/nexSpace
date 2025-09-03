import express, { json, NextFunction, Request, Response } from 'express';
import session from 'express-session';
import oauthGoogle from './routes/oauth.google.js';
import setupRouter from './routes/setup.js';
import { config } from './config/env.js';
import me from './routes/auth.me.js';

const app = express();

app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production'
  }
}));

app.use(json());

// Mount at '/auth' — now router paths are '/google', '/microsoft'
app.use('/auth', oauthGoogle);

app.use('/', setupRouter);

// protected endpoint
app.use('/', me);


app.get('/health', (_req: Request, res: Response) => res.send('ok'));

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).send('Internal Server Error');
});

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});
