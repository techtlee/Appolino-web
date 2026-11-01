// The contact form's sender: a Cloudflare Worker that takes the form from www.appolino.com and
// e-mails it to everyone in TO. Cloudflare sends a Worker's mail only to addresses verified in
// the account's Email Routing, so each recipient clicks the link Cloudflare mails them, once.
// The visitor's address is the Reply-To: answering the e-mail answers them.
//
// Set up in the Cloudflare dashboard - no build, this one file is pasted in:
//   1. appolino.com -> Email -> Email Routing -> enable it and let it add its records. Under
//      Destination addresses, add each recipient; each confirms from their inbox.
//   2. Workers & Pages -> Create -> Worker, named appolino-contact -> Deploy, then Edit code,
//      replace everything with this file -> Deploy.
//   3. The Worker -> Settings -> Bindings -> Add -> Send email, variable name EMAIL.
//   4. Settings -> Variables and secrets -> Add, type Text: TO = the recipients, comma separated.
//   5. Its URL (https://appolino-contact.<account>.workers.dev) goes in the site's
//      .env.production as VITE_CONTACT_URL; the next deploy of the site sends through it.
import { EmailMessage } from "cloudflare:email";

/** The pages allowed to send: the site, and nothing else. */
const ORIGINS = ["https://www.appolino.com", "https://appolino.com"];
/** Any address on appolino.com will do: Cloudflare sends from the domain Email Routing runs on. */
const FROM = "web@appolino.com";
const LIMIT = { name: 200, company: 200, email: 254, msg: 5000 };
const EMAIL = /^[^\s@<>()",;:\\]+@[^\s@<>()",;:\\]+\.[^\s@<>()",;:\\]+$/;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") ?? "";
    const cors = {
      "Access-Control-Allow-Origin": ORIGINS.includes(origin) ? origin : ORIGINS[0],
      "Access-Control-Allow-Methods": "POST",
      "Access-Control-Allow-Headers": "Content-Type",
      Vary: "Origin",
    };
    const answer = (status, error) => Response.json(error ? { error } : { ok: true }, { status, headers: cors });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return answer(405, "POST only");
    if (!ORIGINS.includes(origin)) return answer(403, "not from the site");

    let form;
    try {
      form = await request.json();
    } catch {
      return answer(400, "not JSON");
    }
    const f = read(form);
    if (typeof f === "string") return answer(400, f);
    // The field nobody sees: only a bot fills it. It is told the message went, and nothing is sent.
    if (f.trap) return answer(200);

    const to = String(env.TO ?? "").split(",").map((a) => a.trim()).filter(Boolean);
    if (!to.length) return answer(500, "no recipients set");
    // One message per recipient (Cloudflare's EmailMessage has one). One that arrives is enough
    // for the visitor; each that fails is logged for whoever reads the Worker's logs.
    const sent = await Promise.allSettled(to.map((addr) => env.EMAIL.send(new EmailMessage(FROM, addr, mime(addr, f)))));
    sent.forEach((r, i) => r.status === "rejected" && console.error(`not sent to ${to[i]}: ${r.reason}`));
    return sent.some((r) => r.status === "fulfilled") ? answer(200) : answer(502, "could not send");
  },
};

/** The form's fields, trimmed and checked as the page checks them, or why they are refused. A
 *  line break in a one-line field could start a header of its own, so control characters go. */
function read(form) {
  const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const line = (v, max) => text(v, max).replace(/[\u0000-\u001f\u007f]+/g, " ");
  const f = {
    name: line(form?.name, LIMIT.name),
    company: line(form?.company, LIMIT.company),
    email: line(form?.email, LIMIT.email),
    msg: text(form?.msg, LIMIT.msg).replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ""),
    trap: line(form?.website, 200),
  };
  if (!f.name) return "name missing";
  if (!EMAIL.test(f.email)) return "email not valid";
  if (!f.msg) return "message missing";
  return f;
}

/** The e-mail as Cloudflare takes it: raw MIME, its text in base64 so any language arrives intact. */
function mime(to, f) {
  const who = [`Name: ${f.name}`, ...(f.company ? [`Company: ${f.company}`] : []), `Email: ${f.email}`];
  const body = `${who.join("\n")}\n\n${f.msg}\n`;
  return [
    `From: appolino website <${FROM}>`,
    `To: ${to}`,
    `Reply-To: ${f.email}`,
    `Subject: ${words(`appolino.com: ${f.name}${f.company ? `, ${f.company}` : ""}`)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@appolino.com>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64(body.replace(/\n/g, "\r\n")).replace(/.{76}/g, "$&\r\n"),
  ].join("\r\n");
}

/** A header's text as encoded words of at most ten characters each, so none runs past the 75 a
 *  line allows, whatever the alphabet. */
function words(s) {
  const chars = Array.from(s.slice(0, 120));
  const parts = [];
  for (let i = 0; i < chars.length; i += 10) parts.push(`=?UTF-8?B?${base64(chars.slice(i, i + 10).join(""))}?=`);
  return parts.join("\r\n ");
}

function base64(s) {
  let bin = "";
  for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b);
  return btoa(bin);
}
