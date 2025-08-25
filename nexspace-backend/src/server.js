import express from 'express';
import session from 'express-session';
import { initProviders } from './auth/providers.js';
import createAuthRouter from './routes/auth.js';
import { config } from './config/env.js';

const providers = await initProviders(); // wait BEFORE building router

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

app.use(express.json());

// Mount at '/auth' — now router paths are '/google', '/microsoft'
app.use('/auth', createAuthRouter(providers));

// protected endpoint
app.get('/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ user: null });
  res.json({ user: req.session.user });
});

app.get('/health', (_req, res) => res.send('ok'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Internal Server Error');
});

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});
