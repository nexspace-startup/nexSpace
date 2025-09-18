// src/utils/mailer.ts
import sgMail from "@sendgrid/mail";
import { config } from "../config/env.js";
import { prisma } from "../prisma.js";
import { composeEmail } from "./emailHelper.js";

/** ========= Types ========= */
type InviteEmailInput = {
  to: string;
  invitationId: string;   // UUID
  workspaceName: string;
  inviterName?: string;
};


/** ========= Main send function ========= */
// Simple in-memory cache for templates to avoid DB round-trips on every send
let cache: {
  masterHtml?: string;
  inviteSubject?: string;
  inviteHtml?: string;
  fetchedAt?: number;
} = {};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getTemplates() {
  const now = Date.now();
  if (cache.fetchedAt && now - cache.fetchedAt < CACHE_TTL_MS && cache.masterHtml && cache.inviteHtml) {
    return cache;
  }
  const [emailTpl, masterTpl] = await Promise.all([
    prisma.emailTemplate.findFirst({ where: { name: "INVITE_WORKSPACE" }, select: { subject: true, mailBody: true } }),
    prisma.emailTemplate.findFirst({ where: { name: "MASTER" }, select: { mailBody: true } }),
  ]);
  cache = {
    masterHtml: masterTpl?.mailBody || defaultMaster,
    inviteSubject: emailTpl?.subject || defaultInviteSubject,
    inviteHtml: emailTpl?.mailBody || defaultInviteContent,
    fetchedAt: now,
  };
  return cache;
}

export async function sendInviteEmail(input: InviteEmailInput) {
  const inviteUrl = `${config?.webOrigin}/invite/${input?.invitationId}`;
  const tpls = await getTemplates();

  const ctx = {
    title: "NexSpace – Invite",
    preheader: "You’ve been invited to join a workspace on NexSpace.",
    brandName: "NexSpace",
    logoUrl: "https://nexspace.io/logo.png",
    year: new Date().getFullYear().toString(),
    footerNote:
      "You are receiving this email because you’ve been invited by your team member. If this is a mistake, please ignore this message.",
    inviterName: input?.inviterName,
    inviteUrl: inviteUrl,
    workspaceName: input?.workspaceName,
  };

  const { subject, html, text } = composeEmail({
    masterHtml: tpls.masterHtml,
    emailHtml: tpls.inviteHtml,
    subjectTpl: tpls.inviteSubject,
    ctx,
  });

  // Send via SendGrid
  const apiKey = config?.mail?.sendgridApiKey;
  if (!apiKey) {
    throw new Error("SENDGRID_API_KEY not configured");
  }
  sgMail.setApiKey(apiKey);
  // Parse from: support "Name <email@domain>" or plain email
  const fromRaw = config?.mail?.from || "no-reply@example.com";
  const m = fromRaw.match(/^(.*)<\s*([^>]+)\s*>\s*$/);
  const from = m ? { email: m[2].trim(), name: m[1].trim().replace(/^"|"$/g, '').trim() } : fromRaw;

  try {
    const [resp] = (await sgMail.send({
      to: input.to,
      from,
      subject: subject || "NexSpace",
      html: html || "",
      text: text || undefined,
    })) as any;
    const headers = resp?.headers || {};
    const messageId = headers['x-message-id'] || headers['X-Message-Id'] || headers['x-messageid'] || undefined;
    return { messageId };
  } catch (err: any) {
    const code = err?.code || err?.response?.statusCode || 'SENDGRID_ERROR';
    const details = err?.response?.body?.errors || err?.response?.body || err?.message;
    // Surface useful info during dev
    if (process?.env?.NODE_ENV !== 'test') {
      console.error('[SendGrid] sendInviteEmail failed', { code, details });
    }
    throw err;
  }
}

// Fallbacks in case DB templates are missing (dev safety)
const defaultInviteSubject = "You’ve been invited to join {{workspaceName|a workspace}} on {{brandName|NexSpace}}";
const defaultInviteContent = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;background-color:#18181B;border-radius:20px;">
  <tr>
    <td style="padding:40px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td align="center" style="font-weight:700;font-size:24px;line-height:150%;letter-spacing:-0.01em;color:#FFFFFF;padding:0 0 8px 0;">
            You’ve been invited
          </td>
        </tr>
        <tr>
          <td align="center" style="font-weight:500;font-size:16px;line-height:150%;color:#FFFFFF;">
            Your teammate {{inviterName|a teammate}} has invited you to join
            <span style="font-weight:600;">{{workspaceName|their workspace}}</span> on {{brandName|NexSpace}}.
          </td>
        </tr>
      </table>
      <div style="height:32px;line-height:32px;font-size:0;">&nbsp;</div>
      <table role="presentation" align="center" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
        <tr>
          <td align="center">
            <a href="{{inviteUrl}}" target="_blank"
               style="background-color:#4285F4;border-radius:12px;color:#FFFFFF;display:inline-block;font-size:18px;font-weight:600;line-height:27px;padding:14px 24px;text-align:center;text-decoration:none;min-width:190px;">
              Join Workspace
            </a>
          </td>
        </tr>
      </table>
      <div style="height:20px;line-height:20px;font-size:0;">&nbsp;</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td align="center" style="font-weight:600;font-size:16px;line-height:150%;color:#FFFFFF;padding-bottom:4px;">
            If the button doesn’t work, copy & paste this URL:
          </td>
        </tr>
        <tr>
          <td align="center" style="font-size:16px;line-height:20px;">
            <a href="{{inviteUrl}}" target="_blank" style="color:#68A1FF;text-decoration:underline;word-break:break-all;">
              {{inviteUrl}}
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

const defaultMaster = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{title|NexSpace}}</title>
  <style>
    @media screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .p-outer { padding: 16px !important; }
    }
  </style>
  </head>
  <body style="margin:0;padding:0;background-color:#202024;color:#FFFFFF;font-family:Manrope,Arial,sans-serif;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">{{preheader|}}</div>
  <table role="presentation" width="100%" style="background-color:#202024;"><tr><td align="center" class="p-outer" style="padding:32px;">
    <table role="presentation" class="container" width="600" style="width:100%;max-width:600px;">
      <tr><td style="padding:0 0 20px 0;">
        <table role="presentation"><tr>
          <td style="padding-right:12px;"><img src="{{logoUrl|https://nexspace.io/logo.png}}" width="40" height="40" alt="{{brandName|NexSpace}}" style="display:block;border-radius:8px;"></td>
          <td style="font-weight:600;font-size:20px;line-height:30px;letter-spacing:-0.01em;color:#FFFFFF;">{{brandName|NexSpace}}</td>
        </tr></table>
      </td></tr>
      <tr><td style="border-top:1px solid #26272B;font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr><td style="height:32px;line-height:32px;font-size:0;">&nbsp;</td></tr>
      <tr><td>{{content}}</td></tr>
      <tr><td style="height:40px;line-height:40px;font-size:0;">&nbsp;</td></tr>
      <tr><td align="center" style="border-top:1px solid #26272B;color:#80889B;font-size:12px;line-height:18px;padding-top:20px;">
        <div style="margin-bottom:16px;">{{footerNote|You are receiving this email because you’ve been invited by your team member.}}</div>
        <div>Copyright © {{year|2025}} {{brandName|NexSpace}}</div>
      </td></tr>
    </table>
  </td></tr></table>
  </body>
  </html>`;
