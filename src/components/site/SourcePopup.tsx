"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

// Bottom-of-screen "Where did you hear about us?" prompt. Slides up after a
// short delay, shows once per visitor (localStorage), and posts the answer to
// /api/lead (channel: "poll") so it lands in the inbox + the Sales & Leads page.
const OPTIONS = ["Facebook", "Instagram", "Google", "AutoTrader", "Drove past", "Word of mouth"];
const KEY = "dm_source_answered";

export default function SourcePopup() {
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem(KEY)) return;
    } catch {
      return;
    }
    const t = setTimeout(() => setShow(true), 9000);
    return () => clearTimeout(t);
  }, []);

  function remember(value: string) {
    try {
      localStorage.setItem(KEY, value);
    } catch {
      /* ignore */
    }
  }

  function answer(source: string) {
    remember(source);
    void fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "poll", source, message: "Where did you hear about us?" }),
    });
    setDone(true);
    setTimeout(() => setShow(false), 1800);
  }

  function dismiss() {
    remember("dismissed");
    setShow(false);
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-4 left-4 right-4 z-[60] max-w-sm rounded-2xl border border-border bg-surface p-4 shadow-2xl sm:right-auto"
        >
          {done ? (
            <p className="py-2 text-center text-sm font-semibold text-foreground">Thanks for letting us know! 🙌</p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">Where did you hear about us?</p>
                <button onClick={dismiss} aria-label="Close" className="-mr-1 -mt-1 rounded-md p-1 text-muted transition-colors hover:text-foreground">
                  <X size={16} />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {OPTIONS.map((o) => (
                  <button
                    key={o}
                    onClick={() => answer(o)}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-accent hover:text-accent"
                  >
                    {o}
                  </button>
                ))}
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
