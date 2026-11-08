export type Theme = "system" | "light" | "dark";
const preference = "porch_ui_theme";

export function readTheme(): Theme {
  const value = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${preference}=`))
    ?.split("=")[1];
  return value === "dark" || value === "light" ? value : "system";
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export function saveTheme(theme: Theme) {
  applyTheme(theme);
  // A non-sensitive, host-scoped preference survives the observer's ephemeral ports.
  // biome-ignore lint/suspicious/noDocumentCookie: synchronous preference prevents a first-paint theme flash.
  document.cookie = `${preference}=${theme}; Path=/; Max-Age=31536000; SameSite=Strict`;
}
