import { ImapFlow } from "npm:imapflow@1.0.170";
import nodemailer from "npm:nodemailer@6.9.16";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const mailHost = "84.247.172.135";
const CONNECT_TIMEOUT_MS = 8000;

type MailCredentials = { email: string; password: string };

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s. The mail server may be unreachable from this service.`)), ms)
    ),
  ]);
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function credentialsFrom(body: Record<string, unknown>): MailCredentials {
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password || !email.includes("@")) throw new Error("Email and password are required.");
  return { email, password };
}

async function verifyLogin(credentials: MailCredentials) {
  const client = new ImapFlow({
    host: mailHost,
    port: 993,
    secure: true,
    auth: { user: credentials.email, pass: credentials.password },
    tls: { rejectUnauthorized: false },
    logger: false,
  });
  await withTimeout(client.connect(), CONNECT_TIMEOUT_MS, "Mail login");
  await withTimeout(client.logout(), 3000, "Mail logout");
}

async function listInbox(credentials: MailCredentials) {
  const client = new ImapFlow({
    host: mailHost,
    port: 993,
    secure: true,
    auth: { user: credentials.email, pass: credentials.password },
    tls: { rejectUnauthorized: false },
    logger: false,
  });
  await withTimeout(client.connect(), CONNECT_TIMEOUT_MS, "Inbox connect");
  const messages: Array<Record<string, unknown>> = [];
  const lock = await client.getMailboxLock("INBOX");
  try {
    for await (const message of client.fetch("1:*", { envelope: true, flags: true }, { reverse: true })) {
      const sender = message.envelope.from?.[0];
      messages.push({
        id: message.uid,
        sender: sender?.name || sender?.address || "Unknown sender",
        email: sender?.address || "",
        subject: message.envelope.subject || "(no subject)",
        preview: "Open this message in your mail client to view its contents.",
        time: message.envelope.date ? new Date(message.envelope.date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "",
        date: message.envelope.date ? new Date(message.envelope.date).toLocaleDateString() : "",
        unread: !message.flags.has("\\Seen"),
        starred: message.flags.has("\\Flagged"),
        body: "<p>Message content is available in your mailbox.</p>",
      });
      if (messages.length >= 50) break;
    }
  } finally {
    lock.release();
    await client.logout();
  }
  return messages;
}

async function sendMail(body: Record<string, unknown>, credentials: MailCredentials) {
  const to = typeof body.to === "string" ? body.to.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "(no subject)";
  const text = typeof body.text === "string" ? body.text : "";
  if (!to || !text) throw new Error("Recipient and message are required.");
  const transporter = nodemailer.createTransport({
    host: mailHost,
    port: 587,
    secure: false,
    auth: { user: credentials.email, pass: credentials.password },
    tls: { rejectUnauthorized: false },
    connectionTimeout: CONNECT_TIMEOUT_MS,
    greetingTimeout: CONNECT_TIMEOUT_MS,
    socketTimeout: CONNECT_TIMEOUT_MS,
  });
  await withTimeout(transporter.sendMail({ from: credentials.email, to, subject, text }), CONNECT_TIMEOUT_MS, "Send mail");({ from: credentials.email, to, subject, text });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const body = await request.json() as Record<string, unknown>;
    const credentials = credentialsFrom(body);
    const action = body.action;
    if (action === "login") {
      await verifyLogin(credentials);
      return json({ success: true, email: credentials.email });
    }
    if (action === "inbox") return json({ messages: await listInbox(credentials) });
    if (action === "send") {
      await sendMail(body, credentials);
      return json({ success: true });
    }
    if (action === "ping") return json({ success: true, host: mailHost, time: new Date().toISOString() });
    return json({ error: "Unsupported mail action." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mail service unavailable.";
    return json({ error: message }, 502);
  }
});
