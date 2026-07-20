"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    Scalar?: { createApiReference: (el: string | HTMLElement, cfg: Record<string, unknown>) => void };
  }
}

/** Scalar API reference — professional OpenAPI docs + request client. */
export function ScalarDocs({ specUrl }: { specUrl: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const boot = () => {
      if (ref.current && window.Scalar) {
        window.Scalar.createApiReference(ref.current, {
          url: specUrl,
          hideDarkModeToggle: true,
          theme: "default",
          customCss: `
            .scalar-app { --scalar-font: var(--font-geist-sans), sans-serif; }
          `,
        });
      }
    };
    if (window.Scalar) {
      boot();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@scalar/api-reference";
    s.async = true;
    s.onload = boot;
    document.body.appendChild(s);
  }, [specUrl]);

  return <div ref={ref} className="min-h-[600px] overflow-hidden rounded-2xl border border-line bg-white" />;
}
