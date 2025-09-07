export const ENDPOINTS = {
  BASE_URL: '/api',
  AUTH_ME: '/auth/me',
  AUTH_SESSION: '/auth/session',
  OAUTH_GOOGLE_AUTHORIZATION: '/auth/google/authorization',
  OAUTH_GOOGLE_CALLBACK: '/auth/google/callback',
  OAUTH_MICROSOFT_AUTHORIZATION: '/auth/microsoft/authorization',
  OAUTH_MICROSOFT_CALLBACK: '/auth/microsoft/callback',
  ONBOARDING: '/onboarding',
  INVITEUSER: '/invite',
  ACCEPTINVITATION: (token: string) => `/invitations/${token}/accept`,
} as const;
