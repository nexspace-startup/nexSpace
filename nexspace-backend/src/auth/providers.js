import { Issuer } from 'openid-client';
import { config } from '../config/env.js';

let googleIssuer, msIssuer, googleClient, msClient;

export async function initProviders() {
  // Discover provider metadata
  googleIssuer = await Issuer.discover('https://accounts.google.com');
  msIssuer = await Issuer.discover(`https://login.microsoftonline.com/${config.microsoft.tenantId}/v2.0`);

  googleClient = new googleIssuer.Client({
    client_id: config.google.clientId,
    client_secret: config.google.clientSecret,
    redirect_uris: [config.google.redirectUri],
    response_types: ['code'],
  });

  msClient = new msIssuer.Client({
    client_id: config.microsoft.clientId,
    client_secret: config.microsoft.clientSecret,
    redirect_uris: [config.microsoft.redirectUri],
    response_types: ['code'],
  });

  return { googleClient, msClient, googleIssuer, msIssuer };
}

export function getClients() {
  if (!googleClient || !msClient) {
    throw new Error('Providers not initialized. Call initProviders() first.');
  }
  return { googleClient, msClient, googleIssuer, msIssuer };
}
