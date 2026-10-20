export type ThemeChoice = "light" | "dark" | "system";

export function readTheme(): ThemeChoice {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem("theme");
  if (stored === "dark" || stored === "system" || stored === "light") return stored;
  return "light";
}

export function applyTheme(next: ThemeChoice) {
  localStorage.setItem("theme", next);
  const dark = next === "dark" || (next === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = next;
  window.dispatchEvent(new Event("theme-change"));
}

export const themeBoot = `(function(){try{var stored=localStorage.getItem("theme")||"light";var dark=stored==="dark"||(stored==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",dark);document.documentElement.dataset.theme=stored;}catch(e){}})();`;
