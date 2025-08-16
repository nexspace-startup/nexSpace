import express from 'express';
import session from 'express-session';
import { config } from './config/env.js';
import { initProviders } from './auth/providers.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerAppRoutes } from './routes/index.js';

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

// Initialize OIDC providers then mount routes
await initProviders();
registerAuthRoutes(app);
registerAppRoutes(app);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Internal Server Error');
});

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});
