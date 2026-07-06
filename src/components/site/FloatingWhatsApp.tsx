"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { dealer, whatsappLink } from "@/config/dealer";

// Dark-themed WhatsApp launcher (NOT the standard luminous green).
// Appears only after scrolling past the hero, so it never overlaps the hero CTA.
export default function FloatingWhatsApp() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const nearBottom =
        window.innerHeight + y >= document.documentElement.scrollHeight - 160;
      // Show after the hero, but get out of the way at the footer.
      setShow(y > 500 && !nearBottom);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <a
      href={whatsappLink(`Hi ${dealer.name}, I have a question about a car.`)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full border border-border bg-surface/90 px-4 py-3 text-sm font-medium shadow-lg backdrop-blur transition-all duration-300 hover:bg-surface-2 ${
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      <MessageCircle size={18} className="text-accent" />
      <span className="hidden sm:inline">WhatsApp</span>
    </a>
  );
}
