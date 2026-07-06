import { dealer } from "@/config/dealer";

// lucide dropped brand glyphs, so the brand icons are inline SVGs.
function InstagramIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function FacebookIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M14 8.5h2.5l.5-3H14V4c0-.86.24-1.5 1.5-1.5H17V0h-2.5C12 0 10.5 1.5 10.5 4v1.5H8v3h2.5V24H14V8.5z" />
    </svg>
  );
}

function YouTubeIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23 12s0-3.9-.5-5.8a3 3 0 0 0-2.1-2.1C18.5 3.5 12 3.5 12 3.5s-6.5 0-8.4.6A3 3 0 0 0 1.5 6.2C1 8.1 1 12 1 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 8.4.6 8.4.6s6.5 0 8.4-.6a3 3 0 0 0 2.1-2.1C23 15.9 23 12 23 12zM9.8 15.5v-7l6 3.5-6 3.5z" />
    </svg>
  );
}

const SOCIALS = [
  { label: "Instagram", href: dealer.instagram, Icon: InstagramIcon },
  { label: "Facebook", href: dealer.facebook, Icon: FacebookIcon },
  { label: "YouTube", href: dealer.youtube, Icon: YouTubeIcon },
].filter((s) => Boolean(s.href));

/** Shared social icon links — used in the footer and the mobile nav. */
export default function Socials({
  className = "",
  size = 18,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {SOCIALS.map(({ label, href, Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          title={label}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-current/20 text-current/70 transition-colors hover:border-current/50 hover:text-current"
        >
          <Icon size={size} />
        </a>
      ))}
    </div>
  );
}
