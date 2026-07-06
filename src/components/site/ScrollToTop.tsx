"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Force the window to the top on every route change. Belt-and-braces over
// Next's default so navigating between pages never lands mid-scroll.
export default function ScrollToTop() {
  const pathname = usePathname();
  useEffect(() => {
    const el = document.documentElement;
    const prev = el.style.scrollBehavior;
    el.style.scrollBehavior = "auto"; // jump, don't smooth-scroll on nav
    window.scrollTo(0, 0);
    el.style.scrollBehavior = prev;
  }, [pathname]);
  return null;
}
