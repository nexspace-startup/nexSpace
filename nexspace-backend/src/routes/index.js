import { requireAuth } from '../middleware/requireAuth.js';

export function registerAppRoutes(app) {
  app.get('/', (req, res) => {
    const u = req.session.user;
    res.send(`
      <h1>NexSpace</h1>
      ${u ? `<p>Signed in as ${u.name || u.email}</p>` : '<p>Not signed in</p>'}
      <a href="/auth/google">Sign in with Google</a><br/>
      <a href="/auth/microsoft">Sign in with Microsoft</a><br/>
      <a href="/profile">Profile (protected)</a><br/>
      <form method="post" action="/logout"><button>Logout</button></form>
    `);
  });

  app.get('/profile', requireAuth, (req, res) => {
    res.type('json').send(JSON.stringify(req.session.user, null, 2));
  });

  app.post('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
  });
}
