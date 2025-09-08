// src/lib/mailer.ts
import nodemailer from "nodemailer";
import { config } from "../config/env.js";
import { prisma } from "../prisma.js";
import { composeEmail, render } from "./emailHelper.js";

/** ========= Types ========= */
type InviteEmailInput = {
  to: string;
  invitationId: string;   // UUID
  workspaceName: string;
  inviterName?: string;
};


/** ========= Main send function ========= */
export async function sendInviteEmail(input: InviteEmailInput) {
  const mailer = nodemailer?.createTransport({
    host: config?.mail?.smtp?.host,
    port: config?.mail?.smtp?.port,
    secure: config?.mail?.smtp?.secure,
    auth: { user: config?.mail?.smtp?.user, pass: config?.mail?.smtp?.pass },
  });
  const inviteUrl = `${config?.webOrigin}/invite/${input?.invitationId}`;

  // Fetch both templates in one go
  const [emailTpl, masterTpl] = await Promise?.all([
    prisma?.emailTemplate?.findFirst({
      where: { name: "INVITE_WORKSPACE" },
      select: { subject: true, mailBody: true },
    }),
    prisma?.emailTemplate?.findFirst({
      where: { name: "MASTER" },
      select: { mailBody: true },
    }),
  ]);

  // Build a standard ctx usable by both master + email
  const ctx = {
    // master/layout tokens
    title: "NexSpace – Invite",
    preheader: "You’ve been invited to join a workspace on NexSpace.",
    brandName: "NexSpace",
    logoUrl: "logoUrl",
    year: new Date()?.getFullYear()?.toString(),
    footerNote: "You are receiving this email because you’ve been invited by your team member.",

    // inner email tokens
    inviterName: input?.inviterName,
    inviteUrl: inviteUrl,
    workspaceName: input?.workspaceName,
  };



  const { subject, html, text } = composeEmail({
    masterHtml: masterTpl?.mailBody,
    emailHtml: emailTpl?.mailBody,
    subjectTpl: emailTpl?.subject,
    ctx,
  });
  const info = await mailer?.sendMail({
    from: config?.mail?.from,
    to: input?.to,
    subject: subject ?? "NexSpace",
    html: html ?? "",
    text: text ?? "",
  });

  return { messageId: info?.messageId };
}
