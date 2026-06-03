"use client";

import { useEffect } from "react";

const leadsScrollKey = "leadsy:leads:scroll-y";

export function LeadScrollKeeper() {
  useEffect(() => {
    if (window.location.pathname !== "/app/leads") return undefined;

    const saved = Number(window.sessionStorage.getItem(leadsScrollKey));
    if (Number.isFinite(saved) && saved > 0) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: saved, behavior: "auto" });
      });
    }

    let frame = 0;
    const writeScroll = () => {
      window.sessionStorage.setItem(leadsScrollKey, String(window.scrollY));
    };
    const saveScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(writeScroll);
    };

    window.addEventListener("scroll", saveScroll, { passive: true });
    window.addEventListener("pagehide", saveScroll);
    return () => {
      cancelAnimationFrame(frame);
      writeScroll();
      window.removeEventListener("scroll", saveScroll);
      window.removeEventListener("pagehide", saveScroll);
    };
  }, []);

  return null;
}
