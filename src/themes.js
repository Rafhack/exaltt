/**
 * Color scheme definitions for Clever Mind Drilling AI
 *
 * Each theme is a plain object of semantic tokens mapped to Tailwind classes.
 * App.jsx destructures these and applies them directly — no hardcoded colors
 * anywhere in the component tree.
 *
 * To add a new theme:
 *  1. Copy an existing entry
 *  2. Give it a unique key and a `label` in Portuguese
 *  3. Fill in every token
 */

export const THEMES = {
  // ── Dark Blue (original) ──────────────────────────────────────────────────
  darkBlue: {
    label: "Azul escuro",

    // Page
    pageBg: "bg-[#07111f]",
    pageText: "text-white",

    // Header card
    headerBg: "bg-gradient-to-br from-[#0b1d33] via-[#0a1628] to-[#07111f]",
    headerBorder: "border-blue-900/40",
    headerShadow: "shadow-blue-950/40",
    brandBadgeBg: "bg-blue-500/10",
    brandBadgeBorder: "border-blue-400/30",
    brandBadgeText: "text-blue-200",
    brandDot: "bg-cyan-300",
    tagBlue: "bg-blue-600",
    tagGray: "bg-slate-800 text-slate-200",
    modeBadgeBg: "bg-green-500/10",
    modeBadgeBorder: "border-green-400/30",
    modeBadgeText: "text-green-300",

    // KPI bar
    kpiBg: "bg-slate-900",
    kpiBorder: "border-slate-800",
    kpiLabel: "text-slate-400",
    kpiValue: "text-white",
    kpiUnit: "text-slate-500",

    // Panels
    panelBg: "bg-[#0b1728]",
    panelBorder: "border-slate-800/80",
    panelShadow: "shadow-slate-950/30",
    sectionLabelInput: "text-blue-300",
    sectionLabelResult: "text-cyan-300",

    // Inputs
    inputBg: "#07111f",
    inputBorder: "rgba(59,130,246,.25)",
    inputBorderFocus: "#00a3ff",
    inputFocusRing: "rgba(0,163,255,.16)",
    inputText: "white",

    // ISO info box
    isoBg: "bg-blue-500/10",
    isoBorder: "border-blue-400/30",
    isoText: "text-blue-100",
    isoLabel: "text-blue-100/80",

    // Result cards
    resultBg: "bg-slate-950",
    resultBorder: "border-slate-800",
    resultLabel: "text-slate-400",
    resultValue: "text-white",

    // Status boxes
    statusBg: "bg-slate-950",
    statusBorder: "border-slate-700",
    statusText: "text-slate-300",
    agentBg: "bg-blue-500/10",
    agentBorder: "border-blue-400/30",
    agentText: "text-blue-100",
    shareBg: "bg-indigo-500/10",
    shareBorder: "border-indigo-400/30",
    shareText: "text-indigo-100",

    // Calculated badge
    calcBadgeBg: "bg-green-500/10",
    calcBadgeBorder: "border-green-400/30",
    calcBadgeText: "text-green-300",
    topToolsBadgeBg: "bg-blue-600/20",
    topToolsBadgeText: "text-blue-200",

    // Buttons
    btnPdf: "bg-[#00a651] hover:bg-green-500 shadow-green-950/30",
    btnMobile: "bg-[#0057b8] hover:bg-blue-500 shadow-blue-950/30",
    btnCopy: "bg-slate-700 hover:bg-slate-600 shadow-slate-950/30",
    btnLink: "bg-[#0057b8] hover:bg-[#0072ce]",
  },

  // ── Dark Gray ─────────────────────────────────────────────────────────────
  darkGray: {
    label: "Cinza escuro",

    pageBg: "bg-[#111111]",
    pageText: "text-white",

    headerBg: "bg-gradient-to-br from-[#1c1c1c] via-[#181818] to-[#111111]",
    headerBorder: "border-zinc-800/60",
    headerShadow: "shadow-zinc-950/60",
    brandBadgeBg: "bg-zinc-700/40",
    brandBadgeBorder: "border-zinc-600/40",
    brandBadgeText: "text-zinc-200",
    brandDot: "bg-zinc-300",
    tagBlue: "bg-zinc-700",
    tagGray: "bg-zinc-800 text-zinc-300",
    modeBadgeBg: "bg-emerald-900/30",
    modeBadgeBorder: "border-emerald-700/30",
    modeBadgeText: "text-emerald-400",

    kpiBg: "bg-[#1a1a1a]",
    kpiBorder: "border-zinc-800",
    kpiLabel: "text-zinc-400",
    kpiValue: "text-white",
    kpiUnit: "text-zinc-500",

    panelBg: "bg-[#1a1a1a]",
    panelBorder: "border-zinc-800/80",
    panelShadow: "shadow-zinc-950/40",
    sectionLabelInput: "text-zinc-400",
    sectionLabelResult: "text-zinc-300",

    inputBg: "#111111",
    inputBorder: "rgba(161,161,170,.2)",
    inputBorderFocus: "#a1a1aa",
    inputFocusRing: "rgba(161,161,170,.12)",
    inputText: "white",

    isoBg: "bg-zinc-800/60",
    isoBorder: "border-zinc-700/40",
    isoText: "text-zinc-100",
    isoLabel: "text-zinc-400",

    resultBg: "bg-[#111111]",
    resultBorder: "border-zinc-800",
    resultLabel: "text-zinc-400",
    resultValue: "text-white",

    statusBg: "bg-[#111111]",
    statusBorder: "border-zinc-800",
    statusText: "text-zinc-300",
    agentBg: "bg-zinc-800/40",
    agentBorder: "border-zinc-700/40",
    agentText: "text-zinc-300",
    shareBg: "bg-zinc-800/40",
    shareBorder: "border-zinc-700/40",
    shareText: "text-zinc-300",

    calcBadgeBg: "bg-emerald-900/30",
    calcBadgeBorder: "border-emerald-700/30",
    calcBadgeText: "text-emerald-400",
    topToolsBadgeBg: "bg-zinc-700/40",
    topToolsBadgeText: "text-zinc-300",

    btnPdf: "bg-[#00a651] hover:bg-green-500 shadow-zinc-950/30",
    btnMobile: "bg-zinc-700 hover:bg-zinc-600 shadow-zinc-950/30",
    btnCopy: "bg-zinc-800 hover:bg-zinc-700 shadow-zinc-950/30",
    btnLink: "bg-zinc-700 hover:bg-zinc-600",
  },

  // ── Light ─────────────────────────────────────────────────────────────────
  light: {
    label: "Claro",

    pageBg: "bg-slate-100",
    pageText: "text-slate-900",

    headerBg: "bg-gradient-to-br from-white via-slate-50 to-slate-100",
    headerBorder: "border-slate-300/60",
    headerShadow: "shadow-slate-300/40",
    brandBadgeBg: "bg-blue-100",
    brandBadgeBorder: "border-blue-300/60",
    brandBadgeText: "text-blue-700",
    brandDot: "bg-blue-500",
    tagBlue: "bg-blue-600",
    tagGray: "bg-slate-200 text-slate-700",
    modeBadgeBg: "bg-green-100",
    modeBadgeBorder: "border-green-300/60",
    modeBadgeText: "text-green-700",

    kpiBg: "bg-white",
    kpiBorder: "border-slate-200",
    kpiLabel: "text-slate-500",
    kpiValue: "text-slate-900",
    kpiUnit: "text-slate-400",

    panelBg: "bg-white",
    panelBorder: "border-slate-200/80",
    panelShadow: "shadow-slate-200/60",
    sectionLabelInput: "text-blue-600",
    sectionLabelResult: "text-blue-700",

    inputBg: "white",
    inputBorder: "rgba(100,116,139,.35)",
    inputBorderFocus: "#2563eb",
    inputFocusRing: "rgba(37,99,235,.12)",
    inputText: "#0f172a",

    isoBg: "bg-blue-50",
    isoBorder: "border-blue-200/60",
    isoText: "text-blue-900",
    isoLabel: "text-blue-700",

    resultBg: "bg-slate-50",
    resultBorder: "border-slate-200",
    resultLabel: "text-slate-500",
    resultValue: "text-slate-900",

    statusBg: "bg-slate-50",
    statusBorder: "border-slate-200",
    statusText: "text-slate-600",
    agentBg: "bg-blue-50",
    agentBorder: "border-blue-200",
    agentText: "text-blue-800",
    shareBg: "bg-indigo-50",
    shareBorder: "border-indigo-200",
    shareText: "text-indigo-800",

    calcBadgeBg: "bg-green-100",
    calcBadgeBorder: "border-green-300/60",
    calcBadgeText: "text-green-700",
    topToolsBadgeBg: "bg-blue-100",
    topToolsBadgeText: "text-blue-700",

    btnPdf: "bg-[#00a651] hover:bg-green-500 shadow-green-200/60",
    btnMobile: "bg-[#0057b8] hover:bg-blue-500 shadow-blue-200/60",
    btnCopy: "bg-slate-500 hover:bg-slate-600 shadow-slate-200/60",
    btnLink: "bg-[#0057b8] hover:bg-[#0072ce]",
  },

  // ── High Contrast ─────────────────────────────────────────────────────────
  highContrast: {
    label: "Alto contraste",

    pageBg: "bg-black",
    pageText: "text-white",

    headerBg: "bg-black",
    headerBorder: "border-yellow-400",
    headerShadow: "shadow-yellow-400/10",
    brandBadgeBg: "bg-yellow-400/10",
    brandBadgeBorder: "border-yellow-400",
    brandBadgeText: "text-yellow-300",
    brandDot: "bg-yellow-400",
    tagBlue: "bg-yellow-400 text-black",
    tagGray: "bg-white text-black",
    modeBadgeBg: "bg-green-400/10",
    modeBadgeBorder: "border-green-400",
    modeBadgeText: "text-green-300",

    kpiBg: "bg-black",
    kpiBorder: "border-white",
    kpiLabel: "text-yellow-300",
    kpiValue: "text-white",
    kpiUnit: "text-yellow-200",

    panelBg: "bg-black",
    panelBorder: "border-white",
    panelShadow: "shadow-none",
    sectionLabelInput: "text-yellow-300",
    sectionLabelResult: "text-yellow-300",

    inputBg: "black",
    inputBorder: "white",
    inputBorderFocus: "#facc15",
    inputFocusRing: "rgba(250,204,21,.25)",
    inputText: "white",

    isoBg: "bg-yellow-400/10",
    isoBorder: "border-yellow-400",
    isoText: "text-white",
    isoLabel: "text-yellow-200",

    resultBg: "bg-black",
    resultBorder: "border-white",
    resultLabel: "text-yellow-300",
    resultValue: "text-white",

    statusBg: "bg-black",
    statusBorder: "border-white",
    statusText: "text-white",
    agentBg: "bg-black",
    agentBorder: "border-yellow-400",
    agentText: "text-yellow-200",
    shareBg: "bg-black",
    shareBorder: "border-yellow-400",
    shareText: "text-yellow-200",

    calcBadgeBg: "bg-green-400/10",
    calcBadgeBorder: "border-green-400",
    calcBadgeText: "text-green-300",
    topToolsBadgeBg: "bg-yellow-400/10",
    topToolsBadgeText: "text-yellow-300",

    btnPdf: "bg-[#00a651] hover:bg-green-400 shadow-none",
    btnMobile: "bg-yellow-400 hover:bg-yellow-300 text-black shadow-none",
    btnCopy: "bg-[#ea8909] hover:bg-[#f2af57] text-black shadow-none",
    btnLink: "bg-yellow-400 hover:bg-yellow-300 text-black",
  },
};

export const THEME_KEYS = Object.keys(THEMES);
export const DEFAULT_THEME = "darkBlue";

export function getTheme(key) {
  return THEMES[key] ?? THEMES[DEFAULT_THEME];
}
