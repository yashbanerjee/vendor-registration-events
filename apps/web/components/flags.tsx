"use client";

import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type FlagAppearance = "success" | "information" | "warning" | "error";

type FlagInput = { appearance: FlagAppearance; title: string; description?: string };
type FlagItem = FlagInput & { id: string };

const FlagContext = createContext<{ show: (flag: FlagInput) => void }>({ show: () => undefined });

export function useFlags() {
  return useContext(FlagContext);
}

export function FlagProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<FlagItem[]>([]);
  const show = useCallback((flag: FlagInput) => {
    setFlags((current) => {
      if (current.some((item) => item.appearance === flag.appearance && item.title === flag.title && item.description === flag.description)) return current;
      return [...current, { ...flag, id: crypto.randomUUID() }];
    });
  }, []);
  const dismiss = useCallback((id: string) => {
    setFlags((current) => current.filter((item) => item.id !== id));
  }, []);

  return (
    <FlagContext.Provider value={{ show }}>
      {children}
      <FlagGroup flags={flags} onDismiss={dismiss} />
    </FlagContext.Provider>
  );
}

function FlagGroup({ flags, onDismiss }: { flags: FlagItem[]; onDismiss: (id: string) => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || flags.length === 0) return null;
  return createPortal(
    <div className="pointer-events-none fixed left-6 z-[600] flex flex-col justify-end gap-2" style={{ bottom: 72, width: "min(400px, calc(100vw - 3rem))" }} aria-label="Notifications">
      {flags.map((flag) => <FlagCard key={flag.id} flag={flag} onDismiss={() => onDismiss(flag.id)} />)}
    </div>,
    document.body,
  );
}

const appearanceIcon = {
  success: { Icon: CircleCheck, color: "#22A06B" },
  information: { Icon: Info, color: "#1D7AFC" },
  warning: { Icon: TriangleAlert, color: "#E56910" },
  error: { Icon: CircleAlert, color: "#E34935" },
};

function FlagCard({ flag, onDismiss }: { flag: FlagItem; onDismiss: () => void }) {
  const [paused, setPaused] = useState(false);
  const autoDismiss = flag.appearance === "success" || flag.appearance === "information";
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  useEffect(() => {
    if (!autoDismiss || paused) return;
    const timer = window.setTimeout(() => onDismissRef.current(), 8000);
    return () => window.clearTimeout(timer);
  }, [autoDismiss, paused]);
  const { Icon, color } = appearanceIcon[flag.appearance];
  return (
    <article
      role={flag.appearance === "error" || flag.appearance === "warning" ? "alert" : "status"}
      className="flag-enter pointer-events-auto relative flex w-full gap-3 rounded border border-border bg-surface p-4 shadow-[0_8px_12px_rgba(9,30,66,0.15),0_0_1px_rgba(9,30,66,0.31)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Icon size={24} color={color} aria-hidden className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1 pr-5">
        <p className="text-sm font-semibold leading-5">{flag.title}</p>
        {flag.description ? <p className="mt-1 text-sm leading-5 text-muted">{flag.description}</p> : null}
      </div>
      <button type="button" className="absolute right-2 top-2 rounded p-1 text-muted hover:bg-secondary" aria-label="Dismiss" onClick={onDismiss}>
        <X size={16} />
      </button>
    </article>
  );
}

export function usePublishFlag(message: string | undefined, appearance: FlagAppearance) {
  const { show } = useFlags();
  const seen = useRef("");
  useEffect(() => {
    if (!message) {
      seen.current = "";
      return;
    }
    const key = `${appearance}:${message}`;
    if (seen.current === key) return;
    seen.current = key;
    show({ appearance, title: message });
  }, [appearance, message, show]);
}
