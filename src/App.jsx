import { useMemo, useState, useEffect } from "react";
import { THEMES, THEME_KEYS, DEFAULT_THEME, getTheme } from "./themes.js";
import { getFnForDiameter } from "./data/fnTable.js";
import { pdf } from "@react-pdf/renderer";
import { ReportPdf } from "./ReportPdf";
import { buildDefaultConfig } from "./data/defaults.js";

// ─── CONFIG FALLBACK ───────────────────────────────────────────────────────────
const FALLBACK_CONFIG = buildDefaultConfig();

// ─── API URL ───────────────────────────────────────────────────────────────────
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

// ─── useConfig hook ────────────────────────────────────────────────────────────
function useConfig() {
  const [config, setConfig] = useState(FALLBACK_CONFIG);
  const [loading, setLoading] = useState(!!API_BASE_URL);

  useEffect(() => {
    if (!API_BASE_URL) return;
    fetch(`${API_BASE_URL}/api/config`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setConfig({ ...FALLBACK_CONFIG, ...data });
      })
      .catch((err) =>
        console.warn(
          "[useConfig] Could not reach API, using fallback:",
          err.message,
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  return { config, loading };
}

// ─── useTheme hook ─────────────────────────────────────────────────────────────
function useTheme() {
  const [themeKey, setThemeKey] = useState(
    () => localStorage.getItem("exaltt-theme") ?? DEFAULT_THEME,
  );
  const theme = getTheme(themeKey);
  const setTheme = (key) => {
    setThemeKey(key);
    localStorage.setItem("exaltt-theme", key);
  };
  return { theme, themeKey, setTheme };
}

// ─── useToolRecommendation hook ────────────────────────────────────────────────
function useToolRecommendation(data, config) {
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const formComplete = data ? isFormComplete(data) : false;

  useEffect(() => {
    if (!formComplete || !API_BASE_URL) {
      setTools([]);
      return;
    }

    const mat = config.materials[data.material];
    const materialISO = mat?.iso ?? "";
    const coolant =
      data.coolant === "Interna"
        ? "internal"
        : data.coolant === "Externa"
          ? "external"
          : "";

    const params = new URLSearchParams({ limit: 5 });
    if (data.diameter) params.set("diameter", data.diameter);
    if (data.depthFactor) params.set("depthRatio", data.depthFactor);
    if (materialISO) params.set("isoClass", materialISO);
    if (coolant) params.set("coolant", coolant);

    const controller = new AbortController();
    setLoading(true);
    setError("");

    fetch(`${API_BASE_URL}/api/tools/recommend?${params}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((body) => {
        setTools(body.tools ?? []);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setTools([]);
        setError("Catálogo de ferramentas indisponível.");
        setLoading(false);
      });

    return () => controller.abort();
  }, [
    data?.material,
    data?.diameter,
    data?.depthFactor,
    data?.coolant,
    config.materials,
    formComplete,
  ]);

  return { tools, loading, error };
}

function recommendExalttGeometry(material, iso, geometries) {
  const g = geometries;
  const byIso = Object.values(g).find((v) => v.iso?.includes(iso));
  if (iso === "K") return g.XTH ?? byIso;
  if (iso === "N") return g.XTS ?? byIso;
  if (iso === "M" || iso === "S") return g.XTL ?? byIso;
  if (material === "D2" || material === "VC131" || iso === "H") {
    return {
      ...(g.XTA ?? byIso),
      application:
        "Aplicar com estratégia conservadora em aço ferramenta/endurecido. Validar dureza, refrigeração e estabilidade da máquina.",
    };
  }
  return g.XTA ?? byIso ?? Object.values(g)[0];
}

function calcAI(
  {
    material,
    diameter,
    hardness,
    depthFactor,
    machine,
    coolant,
    pressure,
    goal,
    cuttingEdges,
  },
  config,
) {
  const d = Number(diameter);
  const h = Number(hardness);
  const p = Number(pressure);
  const edges = Number(cuttingEdges) || 2;

  if (!Number.isFinite(d) || d <= 0)
    throw new Error("Informe um diâmetro válido.");
  if (!Number.isFinite(h) || h < 0)
    throw new Error("Informe uma dureza válida.");
  if (!Number.isFinite(p) || p < 0)
    throw new Error("Informe uma pressão válida.");

  const { materials, depths, machines, isoClasses } = config;
  const base =
    materials[material] || materials["SAE 4140"] || Object.values(materials)[0];
  const dep = depths[depthFactor] || depths["5xD"] || Object.values(depths)[1];
  const mac =
    machines[machine] || machines["Romi D800"] || Object.values(machines)[0];

  const cooling = coolant === "Interna" ? 1.04 : 0.94;
  const press = p >= 20 ? 1.03 : p >= 10 ? 1 : 0.92;
  const hard = h > 35 ? 0.9 : h > 28 ? 0.96 : 1.02;
  const objective =
    goal === "Alta produtividade"
      ? 1.04
      : goal === "Maior vida útil"
        ? 0.94
        : goal === "Máxima estabilidade"
          ? 0.96
          : 0.9;

  const vc = Math.round(
    base.vc * dep.vc * mac.vc * cooling * press * hard * objective,
  );
  const baseFn = getFnForDiameter(
    materials[material] ? material : "SAE 4140",
    materials,
    d,
  );
  const fn = Number((baseFn * dep.fn * mac.fn).toFixed(3));
  const rpm = Math.round((1000 * vc) / (Math.PI * d));
  const vf = Math.round(fn * rpm * (edges / 2));
  const life = Math.round(
    base.life *
      dep.life *
      (coolant === "Interna" ? 1.08 : 0.92) *
      (goal === "Maior vida útil" ? 1.18 : 1),
  );
  const cuttingPower = Number(((vc * fn * d) / 80).toFixed(1));
  const power = Number((cuttingPower * 1.25).toFixed(1));
  const torque = Number(((9550 * power) / Math.max(rpm, 1)).toFixed(1));
  const stability = Math.min(99, Math.round((dep.risk + mac.stability) / 2));
  const geometry = recommendExalttGeometry(
    material,
    base.iso,
    config.geometries,
  );

  return {
    vc,
    rpm,
    fn,
    vf,
    life,
    cuttingPower,
    power,
    torque,
    stability,
    iso: base.iso,
    materialClass: base.materialClass,
    isoDescription: isoClasses[base.iso] || "ISO não classificado",
    geometry,
    baseVc: base.vc,
  };
}

// ─── Empty state ───────────────────────────────────────────────────────────────
const EMPTY_DATA = {
  material: "",
  diameter: "",
  hardness: "",
  depthFactor: "",
  depthMm: "",
  machine: "",
  coolant: "",
  pressure: "",
  fixture: "",
  goal: "",
  cuttingEdges: "",
};

function isFormComplete(data) {
  return (
    data.material !== "" &&
    data.diameter !== "" &&
    data.hardness !== "" &&
    data.depthFactor !== "" &&
    data.depthMm !== "" &&
    data.machine !== "" &&
    data.coolant !== "" &&
    data.pressure !== "" &&
    data.fixture !== "" &&
    data.goal !== "" &&
    data.cuttingEdges !== ""
  );
}

// ─── Lead capture ─────────────────────────────────────────────────────────────
function validateLeadPhone(v) {
  const digits = v.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11;
}

function validateLeadEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function formatPhone(raw) {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function leadInputCls(hasError, theme) {
  return [
    "w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition",
    `bg-${theme.inputBg} text-${theme.inputText} placeholder:text-slate-500`,
    hasError
      ? "border-red-500/60 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
      : `border-slate-700/60 focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/10`,
  ].join(" ");
}

function LeadField({ label, error, theme, children }) {
  return (
    <label className="block">
      <span
        className={`mb-1.5 block text-[11px] font-black tracking-widest uppercase ${theme.kpiLabel}`}
      >
        {label}
      </span>
      {children}
      {error && <p className="mt-1 text-[11px] text-red-400">{error}</p>}
    </label>
  );
}

function LeadModal({
  theme,
  name,
  email,
  phone,
  onName,
  onEmail,
  onPhone,
  onConfirm,
  onClose,
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const nameOk = name.trim().length >= 2;
  const emailOk = validateLeadEmail(email);
  const phoneOk = validateLeadPhone(phone);
  const canSubmit = nameOk && emailOk && phoneOk && !saving;

  const handlePhoneChange = (e) => {
    onPhone(formatPhone(e.target.value));
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError("");
    try {
      if (API_BASE_URL) {
        const res = await fetch(`${API_BASE_URL}/api/leads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.replace(/\D/g, ""),
            createdAt: new Date().toISOString(),
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }
      onConfirm();
    } catch {
      setError("Não foi possível salvar. Tente novamente.");
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && canSubmit) handleSubmit();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: `${theme.pageBg}`, backdropFilter: "blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`w-full max-w-md rounded-2xl border ${theme.panelBorder} ${theme.panelBg} shadow-2xl`}
      >
        <div
          className={`flex items-start justify-between border-b ${theme.kpiBorder} px-6 py-5`}
        >
          <div>
            <h2 className={`text-lg font-black ${theme.kpiValue}`}>
              Seus dados de contato
            </h2>
            <p className={`mt-0.5 text-xs ${theme.kpiLabel}`}>
              Preencha para liberar o resultado completo.
            </p>
          </div>
          <button
            onClick={onClose}
            className={`mt-0.5 text-xl leading-none transition ${theme.kpiLabel} hover:${theme.kpiValue}`}
          >
            ×
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <LeadField
            theme={theme}
            label="Nome"
            error={
              name.length > 0 && !nameOk ? "Informe ao menos 2 caracteres." : ""
            }
          >
            <input
              className={leadInputCls(name.length > 0 && !nameOk, theme)}
              type="text"
              placeholder="Seu nome"
              autoFocus
              value={name}
              onChange={(e) => onName(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </LeadField>

          <LeadField
            theme={theme}
            label="E-mail"
            error={
              email.length > 0 && !emailOk ? "Informe um e-mail válido." : ""
            }
          >
            <input
              className={leadInputCls(email.length > 0 && !emailOk, theme)}
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => onEmail(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </LeadField>

          <LeadField
            theme={theme}
            label="Telefone / WhatsApp"
            error={
              phone.length > 0 && !phoneOk
                ? "Mínimo 10 dígitos — (xx) xxxxx-xxxx"
                : ""
            }
          >
            <input
              className={leadInputCls(phone.length > 0 && !phoneOk, theme)}
              type="tel"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={handlePhoneChange}
              onKeyDown={handleKeyDown}
            />
          </LeadField>

          {error && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`w-full rounded-xl ${theme.btnPdf} py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40`}
          >
            {saving ? "Salvando..." : "Continuar"}
          </button>

          <p
            className={`text-center text-[10px] leading-relaxed ${theme.kpiLabel}`}
          >
            Seus dados são usados apenas pela equipe TopTools Brasil para
            acompanhamento técnico e comercial.
          </p>
        </div>
      </div>
    </div>
  );
}

function useLead(theme) {
  const [pending, setPending] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const SESSION_KEY = "exaltt-lead-captured";

  const gate = (action) => {
    if (sessionStorage.getItem(SESSION_KEY)) {
      action();
      return;
    }
    setPending(() => action);
  };

  const handleConfirm = () => {
    sessionStorage.setItem(SESSION_KEY, "1");
    setName("");
    setEmail("");
    setPhone("");
    if (pending) pending();
    setPending(null);
  };

  const modal = pending ? (
    <LeadModal
      theme={theme}
      name={name}
      email={email}
      phone={phone}
      onName={setName}
      onEmail={setEmail}
      onPhone={setPhone}
      onConfirm={handleConfirm}
      onClose={() => setPending(null)}
    />
  ) : null;

  return { gate, modal };
}

// ─── REUSABLE SECTION COMPONENT ────────────────────────────────────────────────
function FormSection({ title, imageSrc, theme, children }) {
  return (
    <div
      className={`rounded-2xl p-4 border ${theme.panelBorder} ${theme.panelBg} relative mb-6 flex flex-col overflow-hidden shadow-lg ${theme.panelShadow} sm:flex-row`}
    >
      <div className="relative shrink-0 sm:w-[180px] md:w-[220px]">
        {/* 18:25 Aspect ratio constraint */}
        <img
          src={imageSrc}
          alt={title}
          className="aspect-[18/25] sm:h-full h-20 sm:w-full object-cover"
          style={{
            WebkitMaskImage:
              "linear-gradient(to right, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)",
            maskImage:
              "linear-gradient(to right, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)",
          }}
        />
      </div>
      <div className="flex-1 p-4 sm:p-6 sm:pl-0 flex flex-col justify-center relative z-10">
        <h3
          className={`mb-4 text-lg font-black uppercase tracking-wide ${theme.sectionLabelInput}`}
        >
          {title}
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function CleverMindDashboard() {
  const { config, loading } = useConfig();
  const { brand, materials, depths, machines } = config;
  const { theme, themeKey, setTheme } = useTheme();
  const { gate, modal } = useLead(theme);

  const [data, setData] = useState({ ...EMPTY_DATA });
  const [submittedData, setSubmittedData] = useState(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const toolRec = useToolRecommendation(submittedData, config);

  // Determine if the user has changed the form parameters after calculating.
  const isDirty = useMemo(() => {
    return (
      submittedData &&
      isFormComplete(data) &&
      JSON.stringify(data) !== JSON.stringify(submittedData)
    );
  }, [data, submittedData]);

  const result = useMemo(() => {
    if (!submittedData || !isFormComplete(submittedData)) return null;
    try {
      return calcAI(submittedData, config);
    } catch {
      return null;
    }
  }, [submittedData, config]);

  const recommendedDrill =
    toolRec.tools?.[0]?.code || `Nenhuma broca EXALTT compatível`;

  const maxDepthMm = useMemo(() => {
    const dep = depths[data.depthFactor];
    const d = Number(data.diameter);
    if (!dep || !Number.isFinite(dep.limiter) || !Number.isFinite(d) || d <= 0)
      return null;
    return dep.limiter * d;
  }, [depths, data.depthFactor, data.diameter]);

  const materialOptions = useMemo(() => {
    return Object.entries(materials)
      .map(([mat, info]) => ({
        id: mat,
        label: `ISO ${info.iso} - ${mat}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [materials]);

  const update = (field, value) =>
    setData((prev) => ({ ...prev, [field]: value }));

  useEffect(() => {
    if (maxDepthMm == null) return;
    setData((prev) => {
      if (prev.depthMm === "" || !Number.isFinite(Number(prev.depthMm)))
        return prev;
      const clamped = Math.min(maxDepthMm, Math.max(1, Number(prev.depthMm)));
      return clamped === Number(prev.depthMm)
        ? prev
        : { ...prev, depthMm: clamped };
    });
  }, [maxDepthMm]);

  const resetForm = () => {
    setData({ ...EMPTY_DATA });
    setSubmittedData(null);
  };

  const gerarPdf = async () => {
    if (!submittedData || !result) return;
    try {
      setGeneratingPdf(true);

      const blob = await pdf(
        <ReportPdf
          brand={brand}
          data={submittedData}
          result={result}
          tools={toolRec.tools}
        />,
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Resultado_${submittedData.material.replaceAll(" ", "-")}-ISO_${result.iso}_${recommendedDrill.replace(/\s+/g, "-")}-Ø${submittedData.diameter}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const comprarViaWhatsapp = () => {
    if (!submittedData || !result) return;

    const message = `Olá! Gostaria de cotar as seguintes ferramentas recomendadas pelo SMARTT:

*Broca Recomendada:* ${recommendedDrill}
*Geometria:* ${result.geometry.code}
*Material:* ${submittedData.material} (${result.isoDescription})
*Diâmetro:* ${submittedData.diameter} mm
*Profundidade:* ${submittedData.depthFactor} / ${submittedData.depthMm} mm

*Parâmetros de Corte Calculados:*
- VC: ${result.vc} m/min
- RPM: ${result.rpm}
- FN: ${result.fn} mm/rev
- VF: ${result.vf} mm/min

Poderiam me ajudar?`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/554721070257?text=${encodedMessage}`, "_blank");
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07111f] text-white">
        <div className="text-center space-y-3">
          <div className="mx-auto h-8 w-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin" />
          <p className="text-xs font-black tracking-widest text-slate-500 uppercase">
            Carregando configuração...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      translate="no"
      className={`min-h-screen ${theme.pageBg} ${theme.pageText} pb-16 notranslate`}
    >
      {/* ── NAVBAR (Website-like Header) ─────────────────────────────── */}
      <header className="w-full bg-[#E3CE3D] px-4 py-3 sm:px-8 sm:py-4 lg:px-16 flex items-center justify-between shadow-md z-10 relative">
        <div className="flex items-center gap-3 sm:gap-5 overflow-hidden">
          {brand.logoUrl && (
            <img
              src={brand.logoUrl}
              alt={brand.company}
              className="h-8 sm:h-10 shrink-0 object-contain"
              style={{ filter: "brightness(0)" }}
            />
          )}
          {/* Header Title and Description */}
          <div className="flex flex-col justify-center border-l border-black/20 pl-3 sm:pl-5 overflow-hidden">
            <h1 className="text-sm sm:text-base font-black text-black leading-none uppercase truncate">
              {brand.product}
            </h1>
            <p className="hidden md:block mt-1 text-[10px] lg:text-xs text-black/75 leading-tight truncate max-w-md lg:max-w-xl">
              Aplicativo técnico para recomendação de parâmetros de furação,
              relatório PDF e suporte ao time comercial/aplicação.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 ml-4 shrink-0">
          <div className="relative inline-flex items-center gap-2 text-black font-black text-xs sm:text-sm tracking-widest uppercase">
            <svg
              className="w-5 h-5 text-black hidden sm:block"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.38 0 2.5-1.12 2.5-2.5 0-.61-.23-1.17-.61-1.61-.31-.35-.5-.81-.5-1.28 0-1.04.85-1.89 1.89-1.89h1.73c2.75 0 4.99-2.24 4.99-4.99C22 7.03 17.52 2 12 2zm-4.5 9c-.83 0-1.5-.67-1.5-1.5S6.67 8 7.5 8 9 8.67 9 9.5 8.33 11 7.5 11zm3-3c-.83 0-1.5-.67-1.5-1.5S9.67 5 10.5 5 12 5.67 12 6.5 11.33 8 10.5 8zm3 0c-.83 0-1.5-.67-1.5-1.5S12.67 5 13.5 5 15 5.67 15 6.5 14.33 8 13.5 8zm3 3c-.83 0-1.5-.67-1.5-1.5S15.67 8 16.5 8 18 8.67 18 9.5 17.33 11 16.5 11z" />
            </svg>
            <select
              value={themeKey}
              onChange={(e) => setTheme(e.target.value)}
              className="appearance-none bg-transparent outline-none cursor-pointer pr-5 font-black uppercase text-black"
            >
              {THEME_KEYS.map((k) => (
                <option key={k} value={k} className="text-black bg-white">
                  {THEMES[k].label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-0 flex items-center">
              <svg
                className="h-4 w-4 text-black"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl flex flex-col gap-4 sm:gap-6 p-4 sm:p-6 lg:p-8 mt-2">
        {/* HERO SECTION (Cleaned up) */}
        <div className="mb-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div
                className={`inline-flex items-center gap-2 rounded-full border ${theme.brandBadgeBorder} ${theme.brandBadgeBg} px-3 py-1 text-xs font-black tracking-wide ${theme.brandBadgeText}`}
              >
                <span className={`h-2 w-2 rounded-full ${theme.brandDot}`} />
                <span className="truncate">
                  {brand.company}
                  {brand.line.length ? ` • ${brand.line}` : ``}
                </span>
              </div>
              <span
                className={`inline-block rounded-full border ${theme.modeBadgeBorder} ${theme.modeBadgeBg} px-3 py-1 text-xs font-bold ${theme.modeBadgeText}`}
              >
                {brand.mode}
              </span>
            </div>

            <button
              type="button"
              onClick={resetForm}
              className={`rounded-full border ${theme.brandBadgeBorder} ${theme.topToolsBadgeBg} px-4 py-2 text-xs font-bold ${theme.topToolsBadgeText} transition hover:opacity-80`}
            >
              Limpar campos
            </button>
          </div>
        </div>

        {/* ── ENTRADA DE DADOS - SECTIONS ─────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          {/* Section 1: Materials */}
          <FormSection
            title="Material"
            theme={theme}
            imageSrc="https://firebasestorage.googleapis.com/v0/b/exaltt-90a74.firebasestorage.app/o/sections%2Fbloco.png?alt=media&token=ecfa9e19-9169-4363-b3c8-2f80431923ac"
          >
            <div className="sm:col-span-2">
              <Field
                label="Material a ser Usinado de acordo com classificação ISO"
                theme={theme}
              >
                <select
                  className="input"
                  value={data.material}
                  onChange={(event) => update("material", event.target.value)}
                >
                  <option value="" disabled>
                    Selecione...
                  </option>
                  {materialOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Dureza do Material em HRC" theme={theme}>
              <input
                className="input"
                type="number"
                placeholder="—"
                value={data.hardness}
                onChange={(event) =>
                  update(
                    "hardness",
                    event.target.value === "" ? "" : Number(event.target.value),
                  )
                }
              />
            </Field>
          </FormSection>

          {/* Section 2: Dados da Máquina */}
          <FormSection
            title="Dados da Máquina"
            theme={theme}
            imageSrc="https://firebasestorage.googleapis.com/v0/b/exaltt-90a74.firebasestorage.app/o/sections%2Fmaquina.png?alt=media&token=3eda28ad-a88c-480f-a689-c452ea1f33ea"
          >
            <Field label="Máquina" theme={theme}>
              <select
                className="input"
                value={data.machine}
                onChange={(event) => update("machine", event.target.value)}
              >
                <option value="" disabled>
                  Selecione...
                </option>
                {Object.keys(machines)
                  .toSorted()
                  .map((machine) => (
                    <option key={machine}>{machine}</option>
                  ))}
              </select>
            </Field>

            <Field label="Tipo da Refrigeração" theme={theme}>
              <select
                className="input"
                value={data.coolant}
                onChange={(event) => update("coolant", event.target.value)}
              >
                <option value="" disabled>
                  Selecione...
                </option>
                <option>Interna</option>
                <option>Externa</option>
              </select>
            </Field>

            <Field label="Pressão da Refrigeração em Bars" theme={theme}>
              <input
                className="input"
                type="number"
                placeholder="—"
                value={data.pressure}
                onChange={(event) =>
                  update(
                    "pressure",
                    event.target.value === "" ? "" : Number(event.target.value),
                  )
                }
              />
            </Field>

            <Field label="Tipo da Fixação" theme={theme}>
              <select
                className="input"
                value={data.fixture}
                onChange={(event) => update("fixture", event.target.value)}
              >
                <option value="" disabled>
                  Selecione...
                </option>
                <option>Mandril Hidráulico</option>
                <option>Mandril Térmico</option>
                <option>Pinça ER</option>
                <option>Weldon</option>
                <option>Outro</option>
              </select>
            </Field>
          </FormSection>

          {/* Section 3: Dados da Ferramenta */}
          <FormSection
            title="Dados da Ferramenta"
            theme={theme}
            imageSrc="https://firebasestorage.googleapis.com/v0/b/exaltt-90a74.firebasestorage.app/o/sections%2Fbroca.png?alt=media&token=6d191edf-2f28-4130-a5c2-8217b3e450d1"
          >
            <Field label="Diâmetro da Broca" theme={theme}>
              <input
                className="input"
                type="number"
                min="2"
                max="20"
                placeholder="—"
                value={data.diameter}
                onChange={(event) => {
                  update("diameter", event.target.value);
                }}
                onBlur={(event) => {
                  if (event.target.value === "") return;
                  update(
                    "diameter",
                    Math.min(20, Math.max(2, Number(event.target.value))),
                  );
                }}
              />
            </Field>

            <Field label="Número de cortes" theme={theme}>
              <select
                className="input"
                value={data.cuttingEdges}
                onChange={(event) =>
                  update("cuttingEdges", Number(event.target.value))
                }
              >
                <option value="" disabled>
                  Selecione...
                </option>
                {[2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Fator de Profundidade" theme={theme}>
              <select
                className="input"
                value={data.depthFactor}
                onChange={(event) => update("depthFactor", event.target.value)}
              >
                <option value="" disabled>
                  Selecione...
                </option>
                {Object.keys(depths).map((depth) => (
                  <option key={depth}>{depth}</option>
                ))}
              </select>
            </Field>

            <Field
              label={
                maxDepthMm != null
                  ? `Comprimento da Broca (máx. ${maxDepthMm}mm)`
                  : "Comprimento da Broca"
              }
              theme={theme}
            >
              <input
                className="input"
                type="number"
                min="1"
                max={maxDepthMm ?? undefined}
                placeholder="—"
                value={data.depthMm}
                onChange={(event) =>
                  update(
                    "depthMm",
                    event.target.value === "" ? "" : Number(event.target.value),
                  )
                }
                onBlur={(event) => {
                  if (event.target.value === "") return;
                  let v = Number(event.target.value);
                  v = Math.max(1, v);
                  if (maxDepthMm != null) v = Math.min(maxDepthMm, v);
                  update("depthMm", v);
                }}
              />
            </Field>

            <Field label="Objetivo" theme={theme}>
              <select
                className="input"
                value={data.goal}
                onChange={(event) => update("goal", event.target.value)}
              >
                <option value="" disabled>
                  Selecione...
                </option>
                <option>Alta produtividade</option>
                <option>Maior vida útil</option>
                <option>Máxima estabilidade</option>
                <option>Furação profunda</option>
              </select>
            </Field>
          </FormSection>

          {/* Submit area */}
          <div className="mt-2 flex flex-col sm:flex-row items-end sm:items-center justify-end gap-4">
            {isDirty && (
              <p className="text-xs font-bold text-amber-500 animate-pulse text-right sm:text-left">
                ⚠️ Parâmetros alterados. Clique em Calcular para atualizar os
                resultados.
              </p>
            )}
            <button
              type="button"
              onClick={() => setSubmittedData(data)}
              disabled={!isFormComplete(data)}
              className={`w-full sm:w-auto rounded-2xl ${theme.btnPdf} px-10 py-3.5 font-black text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-40`}
            >
              Calcular
            </button>
          </div>
        </div>

        {submittedData && result && (
          <div className="fade-in flex flex-col gap-4 sm:gap-6 mt-4">
            {/* ── TOOL RECOMMENDATION ─────────────────────────────────────── */}
            <div
              className={`rounded-2xl border ${theme.panelBorder} ${theme.panelBg} p-4 shadow-lg sm:p-6`}
            >
              <p
                className={`text-xs font-black tracking-[0.18em] ${theme.sectionLabelResult}`}
              >
                FERRAMENTAS EXALTT RECOMENDADAS
              </p>
              {toolRec.loading && (
                <div className="mt-4 flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin" />
                  <span className={`text-xs ${theme.kpiLabel}`}>
                    Buscando ferramentas…
                  </span>
                </div>
              )}
              {!toolRec.loading && toolRec.error && (
                <p className={`fade-in mt-4 text-xs ${theme.kpiLabel}`}>
                  {toolRec.error}
                </p>
              )}
              {!toolRec.loading &&
                !toolRec.error &&
                toolRec.tools.length === 0 && (
                  <p className={`fade-in mt-4 text-xs ${theme.kpiLabel}`}>
                    Nenhuma ferramenta encontrada no catálogo para esta
                    configuração.
                  </p>
                )}
              {!toolRec.loading && toolRec.tools.length > 0 && (
                <div className="fade-in mt-4 space-y-2">
                  {toolRec.tools.map((tool, i) => (
                    <div
                      key={tool.code}
                      className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border ${i === 0 ? theme.calcBadgeBorder : theme.resultBorder} ${i === 0 ? theme.calcBadgeBg : theme.resultBg} px-4 py-3`}
                    >
                      {i === 0 && (
                        <span
                          className={`shrink-0 rounded-full border ${theme.calcBadgeBorder} ${theme.calcBadgeBg} px-2 py-0.5 text-[10px] font-black ${theme.calcBadgeText}`}
                        >
                          ★ 1ª opção
                        </span>
                      )}
                      <span
                        className={`font-black font-mono text-sm ${i === 0 ? theme.calcBadgeText : theme.resultValue}`}
                      >
                        {tool.code}
                      </span>
                      <span className={`text-xs ${theme.kpiLabel}`}>
                        Ø{tool.diameter?.toFixed(2)} mm
                      </span>
                      <span className={`text-xs ${theme.kpiLabel}`}>
                        {tool.depthRatio}
                      </span>
                      <span className={`text-xs ${theme.kpiLabel}`}>
                        {tool.coolant === "internal"
                          ? "Refrigeração interna"
                          : tool.coolant === "external"
                            ? "Refrigeração externa"
                            : ""}
                      </span>
                      {tool.totalLength && (
                        <span
                          className={`sm:ml-auto text-xs ${theme.kpiLabel}`}
                        >
                          L {tool.totalLength} mm
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── PRINT AREA ─────────────────────────────────────── */}
            <div
              id="print-area"
              className="rounded-2xl border border-slate-700 bg-white p-4 text-slate-950 print-area shadow-lg sm:p-6"
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  {brand.logoUrl && (
                    <img
                      src={brand.logoUrl}
                      alt={brand.company}
                      className="h-10 sm:h-12 object-contain"
                      style={{ filter: "brightness(0)" }}
                    />
                  )}
                  {console.log(brand)}
                  <h2 className="text-2xl font-black">{brand.product}</h2>
                  <p className="text-sm text-slate-600">
                    Resultado para visualização e impressão
                  </p>
                </div>
                <div className="text-right text-sm text-slate-600">
                  <p>Data: {new Date().toLocaleDateString("pt-BR")}</p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <PrintRow
                  label="Material a ser Usinado"
                  value={`${submittedData.material} • ${result.isoDescription}`}
                />
                <PrintRow
                  label="Classe do Material"
                  value={result.materialClass}
                />
                <PrintRow
                  label="Dureza"
                  value={`${submittedData.hardness} HRC`}
                />
                <PrintRow
                  label="Número de cortes"
                  value={`${submittedData.cuttingEdges}`}
                />
                <PrintRow label="Broca" value={recommendedDrill} />
                <PrintRow
                  label="Geometria EXALTT"
                  value={`${result.geometry.code} — ${result.geometry.name}`}
                />
                <PrintRow
                  label="Aplicação Geometria"
                  value={result.geometry.application}
                />
                <PrintRow
                  label="Profundidade"
                  value={`${submittedData.depthFactor} / ${submittedData.depthMm} mm`}
                />
                <PrintRow label="Máquina" value={submittedData.machine} />
                <PrintRow
                  label="Refrigeração"
                  value={`${submittedData.coolant} • ${submittedData.pressure} bar`}
                />
                <PrintRow
                  label="Tipo da Fixação"
                  value={submittedData.fixture}
                />
              </div>

              <h3 className="mt-8 text-lg font-black">Resultados de Corte</h3>
              <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                <PrintKpi
                  label="Velocidade de Corte (VC)"
                  value={`${result.vc} m/min`}
                />
                <PrintKpi label="RPM / N" value={result.rpm} />
                <PrintKpi
                  label="Avanço por volta (FN)"
                  value={`${result.fn} mm/rev`}
                />
                <PrintKpi label="Avanço (VF)" value={`${result.vf} mm/min`} />
                <PrintKpi
                  label="Vida útil estimada"
                  value={`${result.life} furos`}
                />
                <PrintKpi label="Potência" value={`${result.power} kW`} />
                <PrintKpi label="Torque" value={`${result.torque} Nm`} />
              </div>

              <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
                <p className="font-bold text-slate-900 mb-1">Recomendação</p>
                <p>
                  Usar broca {recommendedDrill} com geometria{" "}
                  {result.geometry.code} para {result.geometry.application}{" "}
                  Estratégia ajustada para {submittedData.depthFactor},
                  considerando {submittedData.machine}, refrigeração{" "}
                  {submittedData.coolant} e objetivo de {submittedData.goal}. A
                  potência exibida já inclui margem de segurança de 25% para
                  garantia da máquina.
                </p>
              </div>
            </div>

            {/* ── ACTION BUTTONS ─────────────────────────────────────── */}
            <div className="mt-6 mb-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => comprarViaWhatsapp()}
                className={`w-full sm:w-auto min-w-[250px] rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] py-4 text-lg font-black text-white shadow-lg transition`}
              >
                Comprar via WhatsApp
              </button>

              <button
                onClick={() => gate(gerarPdf)}
                disabled={generatingPdf}
                className={`w-full sm:w-auto min-w-[250px] rounded-2xl ${theme.btnPdf} py-4 text-lg font-black text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {generatingPdf ? "Gerando PDF..." : "Gerar PDF"}
              </button>
            </div>
          </div>
        )}
      </section>

      <style>{`
        .input { width:100%; border:1px solid ${theme.inputBorder}; background:${theme.inputBackground}; border-radius:.85rem; padding:.7rem .8rem; color:${theme.inputText}; outline:none; font-size:15px; }
        .input:focus { border-color:${theme.inputBorderFocus}; box-shadow:0 0 0 3px ${theme.inputFocusRing}; }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }
      `}</style>
      <style>{`
        .btn { border-radius:.85rem; padding:.75rem; text-align:center; font-weight:800; color:white; box-shadow:0 8px 18px rgba(0,0,0,.22); }
        button, a { touch-action:manipulation; -webkit-tap-highlight-color:transparent; }
        @media print {
          body { background:white!important; }
          .no-print, header, section > section:first-of-type, .border.border-slate-800.bg-slate-900.p-6:first-child { display:none!important; }
          main { background:white!important; color:black!important; padding:0!important; }
          .print-area { display:block!important; border:none!important; box-shadow:none!important; margin:0!important; padding:20px!important; color:black!important; }
          #print-area { page-break-inside:avoid; }
          .print-area * { color:black!important; }
        }
      `}</style>
      {modal}
    </main>
  );
}

function Field({ label, children, theme }) {
  return (
    <label className="block">
      <span className={`mb-1.5 block text-xs font-bold ${theme.pageText}`}>
        {label}
      </span>
      {children}
    </label>
  );
}

function PrintRow({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-slate-950">{value}</p>
    </div>
  );
}

function PrintKpi({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}
