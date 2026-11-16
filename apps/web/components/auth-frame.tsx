"use client";

import { useId } from "react";
import { BRAND_LOGO } from "./brand-mark";

/**
 * Sign-in, invitation, and password screens. They copy the parent site's login page: the logo bar,
 * then one narrow card with corner brackets and a centered title. Always dark, like the form page.
 */
export function AuthFrame({
  title,
  description,
  onSubmit,
  overlay,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  onSubmit: (event: React.FormEvent) => void;
  overlay?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="dark brand-page brand-page--auth font-form">
      {/* Hero still from forum.iktva.sa — the same poster the homepage video uses. */}
      <div className="auth-hero" aria-hidden="true" />
      {overlay}
      <nav className="brand-nav brand-nav--auth" aria-label="iktva Forum 2027">
        <img src={BRAND_LOGO} alt="iktva Forum 2027" className="brand-nav-logo" />
      </nav>
      <main className="auth-screen">
        <div className="brand-shell brand-shell--narrow">
          <form onSubmit={onSubmit} className="brand-card brand-card--login auth-card">
            <div className="grid gap-4">
              <h1 className="auth-title">{title}</h1>
              {description ? <p className="break-words text-center text-sm leading-6 text-muted">{description}</p> : null}
            </div>
            {children}
          </form>
        </div>
      </main>
    </div>
  );
}

/** Text input with the label inside the box. The label shrinks once the field has focus or a value. */
export function FloatingInput({ label, value, ...props }: Omit<React.ComponentProps<"input">, "value" | "className" | "placeholder"> & { label: string; value: string }) {
  const id = useId();
  return (
    <div className="ff" data-filled={value ? "true" : undefined}>
      <input id={id} className="ff-control" placeholder=" " value={value} {...props} />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}
