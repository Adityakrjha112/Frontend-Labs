export const THEME_KEY = "frontend-lab:theme";
/** The original roadmap tracker kept its theme in this state blob (prefs.theme). */
export const LEGACY_ROADMAP_KEY = "fe-depth-tracker:v1";
export type ThemePreference = "system" | "light" | "dark";

/**
 * Inline, app-authored script (no user or workbook content) that applies the
 * theme before first paint. If the app has no theme saved yet, it adopts the
 * roadmap tracker's saved theme so existing roadmap users keep theirs.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(p===null){try{var r=JSON.parse(localStorage.getItem(${JSON.stringify(
  LEGACY_ROADMAP_KEY,
)})||"null");var t=r&&r.prefs&&r.prefs.theme;if(t==="light"||t==="dark"){p=t;localStorage.setItem(${JSON.stringify(
  THEME_KEY,
)},t);}}catch(e){}}var d=p==="dark"||(p!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){document.documentElement.dataset.theme="light";}})();`;

function legacyRoadmapTheme(): ThemePreference | null {
  try {
    const raw = JSON.parse(localStorage.getItem(LEGACY_ROADMAP_KEY) ?? "null") as { prefs?: { theme?: unknown } } | null;
    const t = raw?.prefs?.theme;
    return t === "light" || t === "dark" ? t : null;
  } catch {
    return null;
  }
}

export function readThemePreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark") return v;
    if (v === null) return legacyRoadmapTheme() ?? "system";
    return "system";
  } catch {
    return "system";
  }
}

export function applyTheme(pref: ThemePreference) {
  try {
    // "system" is stored explicitly so the legacy fallback no longer applies.
    localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* storage unavailable; still apply for this page view */
  }
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}
