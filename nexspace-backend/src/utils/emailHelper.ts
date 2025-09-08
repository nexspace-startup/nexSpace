export function escapeHtml(s: string) {
  return s?.replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]!));
}

const get = (obj?: Record<string, any>, path?: string) =>
  (path ?? "")?.split(".")?.reduce((a?: any, k?: string) => a?.[k as string], obj) ?? undefined;

/** Replaces {{token}} or {{a.b.c}} and supports defaults: {{token|Default text}} */
export const render = (tpl?: string, ctx?: Record<string, any>) =>
  (tpl ?? "")?.replace(/\{\{\s*([a-zA-Z0-9_.]+)(?:\|([^}]+))?\s*\}\}/g,
    (_?: string, key?: string, def?: string) => escapeHtml((get(ctx, key) ?? "") !== "" ? get(ctx, key) : def));


 /** simple HTML→text fallback (no external deps) */
export const toPlainText = (html?: string) =>
  (html ?? "")
    ?.replace(/<style[\s\S]*?<\/style>/gi, "")
    ?.replace(/<script[\s\S]*?<\/script>/gi, "")
    ?.replace(/<\/(p|div|h[1-6]|tr)>/gi, "\n")
    ?.replace(/<br\s*\/?>/gi, "\n")
    ?.replace(/<[^>]+>/g, "")
    ?.replace(/&nbsp;/g, " ")
    ?.replace(/&amp;/g, "&")
    ?.replace(/&lt;/g, "<")
    ?.replace(/&gt;/g, ">")
    ?.replace(/\n{3,}/g, "\n\n")
    ?.trim();

    
/** Composes an email by merging a master template with an email-specific template and context */
export const composeEmail = (args?: {
  masterHtml?: string;
  emailHtml?: string;
  subjectTpl?: string;
  ctx?: Record<string, any>;
}) => {
  const inner = render(args?.emailHtml, args?.ctx);
  const wrapped = (args?.masterHtml ?? "")?.replace("{{content}}", inner ?? "");
  const html = render(wrapped, args?.ctx);
  const subject = render(args?.subjectTpl, args?.ctx);
  const text = toPlainText(html);
  return { subject, html, text };
};