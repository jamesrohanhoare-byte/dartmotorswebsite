"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

/**
 * Loads the Meta pixel and fires PageView.
 *
 * ⚠️ NEXT_PUBLIC_* is inlined at BUILD time, not read at runtime. Setting
 * NEXT_PUBLIC_META_PIXEL_ID in Vercel does nothing until a fresh build runs, and
 * the symptom is a completely silent no-op — no error, no warning, just no
 * events. If the pixel is not firing in production, confirm a build ran AFTER
 * the variable was set before debugging anything else.
 */

/**
 * Routes where Meta's automatic advanced matching must NOT scrape form fields.
 *
 * /financing is a credit application: it collects idNumber, dob, accountNumber,
 * grossIncome, netSalary, address and a full expense breakdown. Meta states it
 * excludes sensitive financial and government-ID data, but a South African ID
 * number is a 13-digit string whose first six digits ARE the date of birth, and
 * we are not betting a client's POPIA position on Meta's classifier recognising
 * that. autoConfig=false disables automatic field collection for these pages;
 * the pixel still tracks the pageview.
 */
const NO_AUTOCONFIG_PATHS = ["/financing"];

export default function MetaPixel() {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const pathname = usePathname();

  if (!pixelId) return null;

  const suppressAutoConfig = NO_AUTOCONFIG_PATHS.some((p) => pathname?.startsWith(p));

  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window,document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        ${suppressAutoConfig ? `fbq('set', 'autoConfig', false, '${pixelId}');` : ""}
        fbq('init', '${pixelId}');
        fbq('track', 'PageView');
      `}
    </Script>
  );
}
