export function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).send('Not signed in');
}
