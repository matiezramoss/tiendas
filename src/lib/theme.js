// PATH: src/lib/theme.js
export function applyTheme(colores = {}) {
  const root = document.documentElement;
  const map = {
    "--bg": colores.bg,
    "--panel": colores.panel,
    "--text": colores.text,
    "--primary": colores.primary,
    "--muted": colores.muted,
  };
  for (const [k, v] of Object.entries(map)) {
    if (typeof v === "string" && v.trim()) root.style.setProperty(k, v.trim());
  }
}
