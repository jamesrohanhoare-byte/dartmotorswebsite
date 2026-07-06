import { createServiceClient } from "@/lib/supabase/service";
import { dealer } from "@/config/dealer";

// General website leads: contact form + newsletter. Saves to site_leads and
// (if Resend is configured) emails the dealer. WhatsApp remains the primary
// channel; this is the backup capture so no enquiry is ever lost.

export const runtime = "nodejs";

type Payload = {
  channel?: string;
  name?: string;
  contact?: string;
  message?: string;
  subject?: string;
  stock_slug?: string;
  company?: string; // honeypot
};

const esc = (s = "") => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function POST(req: Request) {
  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return Response.json({ ok: false, error: "bad-request" }, { status: 400 });
  }

  // Honeypot: silently accept + drop.
  if (body.company) return Response.json({ ok: true });

  const channel = ["form", "whatsapp", "email", "newsletter"].includes(body.channel ?? "")
    ? (body.channel as string)
    : "form";

  // Save the lead (best-effort; email is independent so nothing is lost).
  try {
    const supabase = createServiceClient();
    await supabase.from("site_leads").insert({
      stock_slug: body.stock_slug ?? null,
      name: body.name?.slice(0, 200) ?? null,
      contact: body.contact?.slice(0, 200) ?? null,
      channel,
      message: body.message?.slice(0, 4000) ?? body.subject?.slice(0, 200) ?? null,
    });
  } catch (e) {
    console.error("[lead] db insert failed:", e instanceof Error ? e.message : e);
  }

  // Email the dealer if Resend is configured (added later).
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const heading = channel === "newsletter" ? "New newsletter signup" : "New website enquiry";
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111">
        <h2 style="margin:0 0 4px">${heading}</h2>
        <p style="margin:0 0 16px;color:#666;font-size:13px">via ${esc(dealer.name)} website</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          ${body.name ? `<tr><td style="padding:6px 0;color:#888;width:110px">Name</td><td><strong>${esc(body.name)}</strong></td></tr>` : ""}
          ${body.contact ? `<tr><td style="padding:6px 0;color:#888">Contact</td><td>${esc(body.contact)}</td></tr>` : ""}
          ${body.stock_slug ? `<tr><td style="padding:6px 0;color:#888">Vehicle</td><td>${esc(body.stock_slug)}</td></tr>` : ""}
        </table>
        ${body.message ? `<div style="margin-top:16px;padding:14px 16px;background:#f5f5f3;border-radius:10px;font-size:14px">${esc(body.message)}</div>` : ""}
      </div>`;
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.LEAD_FROM ?? `${dealer.name} <onboarding@resend.dev>`,
          to: (process.env.LEAD_TO ?? dealer.email).split(",").map((s) => s.trim()),
          ...(body.contact?.includes("@") ? { reply_to: body.contact } : {}),
          subject: `${heading}${body.name ? ` — ${body.name}` : ""}`,
          html,
        }),
      });
    } catch (e) {
      console.error("[lead] email failed:", e instanceof Error ? e.message : e);
    }
  }

  return Response.json({ ok: true });
}
