import dotenv from 'dotenv';
dotenv.config();

interface OAuthConfig {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
}

interface SMTPConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;   
}

interface MailConfig {
  from: string;
  smtp: SMTPConfig;
  sendgridApiKey?: string;
}

interface liveKitConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
}

export interface Config {
  webOrigin?: string;
  appOrigin?: string;
  port: number;
  nodeEnv: string;
  sessionSecret: string;
  google: OAuthConfig;
  microsoft: OAuthConfig & { tenantId: string };
  postLogoutRedirect: string;
  mail: MailConfig;
  liveKit: liveKitConfig;
  chat: {
    retentionDays: number; // data minimization
  };
}

export const config: Config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret',
  webOrigin: process.env.WEB_ORIGIN || 'http://localhost:5173',
  appOrigin: process.env.APP_ORIGIN,
  mail: {
    from: process.env.MAIL_FROM || "Nexspace <no-reply@nexspace.local>",
    smtp: {
      host: process.env.SMTP_HOST || "",
      port: Number(process.env.SMTP_PORT || 587),
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
      secure: process.env.SMTP_SECURE === "true",
    },
    sendgridApiKey: process.env.SENDGRID_API_KEY || "",
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
  },
  microsoft: {
    tenantId: process.env.MS_TENANT_ID || 'common',
    clientId: process.env.MS_CLIENT_ID,
    clientSecret: process.env.MS_CLIENT_SECRET,
    redirectUri: process.env.MS_REDIRECT_URI,
  },
  liveKit: {
    url: process.env.LIVEKIT_URL || '',
    apiKey: process.env.LIVEKIT_API_KEY || '',
    apiSecret: process.env.LIVEKIT_API_SECRET || '',
  },
  chat: {
    retentionDays: Number(process.env.CHAT_RETENTION_DAYS || 30),
  },
  postLogoutRedirect:
    process.env.POST_LOGOUT_REDIRECT || 'http://localhost:3000/',
};
