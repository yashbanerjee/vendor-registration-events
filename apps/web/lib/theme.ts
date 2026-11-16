export type ThemeChoice = "light" | "dark" | "system";

// Dark is the iktva brand look, so it is what a browser gets until someone picks another theme.
const DEFAULT_THEME: ThemeChoice = "dark";

export function readTheme(): ThemeChoice {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const stored = localStorage.getItem("theme");
  if (stored === "dark" || stored === "system" || stored === "light") return stored;
  return DEFAULT_THEME;
}

export function applyTheme(next: ThemeChoice) {
  localStorage.setItem("theme", next);
  const dark = next === "dark" || (next === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = next;
  window.dispatchEvent(new Event("theme-change"));
}

export const themeBoot = `(function(){try{var stored=localStorage.getItem("theme")||"${DEFAULT_THEME}";var dark=stored==="dark"||(stored==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",dark);document.documentElement.dataset.theme=stored;}catch(e){document.documentElement.classList.add("dark");}})();`;
