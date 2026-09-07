import { MapPin, ArrowRight } from "lucide-react";
import { dealer, temporaryAddressLine, temporaryMapsLink } from "@/config/dealer";

// Orange relocation bar. Sits directly under the maroon Ticker and above the
// sticky Nav. Deliberately NOT sticky — Nav is `sticky top-0` and the contact +
// vehicle pages pin columns at `lg:top-24` against an 80px header, so a second
// sticky band would push those columns under the header.
// Turn off in one line: dealer.temporaryLocation.active = false.
export default function MovingNotice() {
  const t = dealer.temporaryLocation;
  if (!t.active) return null;

  const address = temporaryAddressLine();
  const lead = `${t.notice} We're temporarily based at`;

  return (
    <a
      href={temporaryMapsLink()}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 bg-accent px-4 py-2 text-center text-[0.78rem] font-semibold leading-snug text-[#1b1712] transition-colors hover:bg-accent-hover"
    >
      <span className="flex items-center gap-1.5">
        <MapPin size={14} strokeWidth={2.5} className="shrink-0" aria-hidden />
        {lead}
      </span>
      <span className="flex items-center gap-1 underline decoration-[#1b1712]/40 underline-offset-2">
        {address}
        <ArrowRight size={13} strokeWidth={2.5} className="shrink-0" aria-hidden />
      </span>
    </a>
  );
}
