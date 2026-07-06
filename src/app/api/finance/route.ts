import { createServiceClient } from "@/lib/supabase/service";
import { dealer } from "@/config/dealer";

// Finance application (multi-step wizard). Saves the full application to
// site_finance_applications and emails it to the dealer if Resend is configured.
// DB write and email are independent so a lead is never lost.

export const runtime = "nodejs";

const LABELS: Record<string, string> = {
  name: "Name", surname: "Surname", dob: "Date of Birth", maritalStatus: "Marital Status",
  phone: "Phone", email: "Email", address: "Residential Address", timeAtAddress: "Time at Address",
  employmentStatus: "Employment Status", employerName: "Employer", jobTitle: "Job Title",
  timeEmployed: "Time Employed", employerContact: "Employer Contact",
  grossIncome: "Gross Monthly Income", netSalary: "Net Salary", otherIncome: "Other Income",
  rentBond: "Rent / Bond", existingLoan: "Existing Loan", livingExpenses: "Living Expenses",
  totalExpenses: "Total Expenses", bankName: "Bank", accountNumber: "Account Number",
  timeWithBank: "Time With Bank", vehicleOfInterest: "Vehicle of Interest",
  depositAmount: "Deposit", tradeIn: "Trade-In", monthlyBudget: "Monthly Budget",
  source: "Heard via", creditCheckConsent: "Credit Check Consent",
  stock_slug: "Stock ref (car)",
};

const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function POST(req: Request) {
  let body: Record<string, string>;
  try {
    body = (await req.json()) as Record<string, string>;
  } catch {
    return Response.json({ ok: false, error: "bad-request" }, { status: 400 });
  }

  if (body.company) return Response.json({ ok: true }); // honeypot

  const { company: _company, ...details } = body;

  // Save (best-effort — email still fires below).
  try {
    const supabase = createServiceClient();
    await supabase.from("site_finance_applications").insert({
      name: details.name ?? null,
      surname: details.surname ?? null,
      vehicle_of_interest: details.vehicleOfInterest ?? null,
      details,
    });
  } catch (e) {
    console.error("[finance] db insert failed:", e instanceof Error ? e.message : e);
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const rows = Object.entries(details)
      .filter(([, v]) => v && String(v).trim())
      .map(([k, v]) => `<tr><td style="padding:5px 0;color:#888;width:180px">${esc(LABELS[k] ?? k)}</td><td style="padding:5px 0"><strong>${esc(v)}</strong></td></tr>`)
      .join("");
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#111">
        <h2 style="margin:0 0 4px">New finance application</h2>
        <p style="margin:0 0 16px;color:#666;font-size:13px">via ${esc(dealer.name)} website</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
      </div>`;
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.LEAD_FROM ?? `${dealer.name} <onboarding@resend.dev>`,
          to: (process.env.LEAD_TO ?? dealer.email).split(",").map((s) => s.trim()),
          ...(details.email?.includes("@") ? { reply_to: details.email } : {}),
          subject: `Finance application — ${details.name ?? ""} ${details.surname ?? ""}`.trim(),
          html,
        }),
      });
    } catch (e) {
      console.error("[finance] email failed:", e instanceof Error ? e.message : e);
    }
  }

  return Response.json({ ok: true });
}
