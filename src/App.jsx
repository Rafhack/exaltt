import { useMemo, useState, useEffect } from "react";
import { THEMES, THEME_KEYS, DEFAULT_THEME, getTheme } from "./themes.js";
import { getFnForDiameter } from "./data/fnTable.js";
import { pdf } from "@react-pdf/renderer";
import { ReportPdf } from "./ReportPdf";
import { buildDefaultConfig } from "./data/defaults.js";

// ─── FIX MACHINE TYPO & CONFIG FALLBACK ────────────────────────────────────────
const rawFallback = buildDefaultConfig();
if (rawFallback.machines && rawFallback.machines["HASS VF-5-50XT"]) {
  rawFallback.machines["HAAS VF-5-50XT"] =
    rawFallback.machines["HASS VF-5-50XT"];
  delete rawFallback.machines["HASS VF-5-50XT"];
}
const FALLBACK_CONFIG = rawFallback;

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
        const merged = { ...FALLBACK_CONFIG, ...data };
        // Programmatic fix for API data if it still sends the typo
        if (merged.machines && merged.machines["HASS VF-5-50XT"]) {
          merged.machines["HAAS VF-5-50XT"] = merged.machines["HASS VF-5-50XT"];
          delete merged.machines["HASS VF-5-50XT"];
        }
        setConfig(merged);
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

export default function CleverMindDashboard() {
  const { config, loading } = useConfig();
  const { brand, materials, depths, machines } = config;
  const { theme, themeKey, setTheme } = useTheme();
  const { gate, modal } = useLead(theme);

  const [data, setData] = useState({ ...EMPTY_DATA });
  const [submittedData, setSubmittedData] = useState(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const toolRec = useToolRecommendation(submittedData, config);

  const result = useMemo(() => {
    if (!submittedData || !isFormComplete(submittedData)) return null;
    try {
      return calcAI(submittedData, config);
    } catch {
      return null;
    }
  }, [submittedData, config]);

  const email = brand.notebookEmail;
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
          email={email}
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
      className={`min-h-screen ${theme.pageBg} ${theme.pageText} p-2 sm:p-4 pb-16 notranslate`}
    >
      <section className="mx-auto max-w-7xl flex flex-col gap-4 sm:gap-6">
        <header
          className={`overflow-hidden rounded-3xl border ${theme.headerBorder} ${theme.headerBg} p-4 shadow-xl ${theme.headerShadow} sm:p-5`}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              {brand.logoUrl && (
                <img
                  src={brand.logoUrl}
                  alt={brand.company}
                  className="h-10 max-w-[100px] self-start sm:self-center object-contain sm:h-14 sm:max-w-[140px] md:h-16 md:max-w-[160px]"
                  style={{ filter: theme.logoFilter }}
                />
              )}
              <div className="min-w-0">
                <div
                  className={`inline-flex max-w-full items-center gap-2 rounded-full border ${theme.brandBadgeBorder} ${theme.brandBadgeBg} px-3 py-1 text-xs font-black tracking-wide ${theme.brandBadgeText}`}
                >
                  <span className={`h-2 w-2 rounded-full ${theme.brandDot}`} />
                  <span className="truncate">
                    {brand.company}
                    {brand.line.length ? ` • ${brand.line}` : ``}
                  </span>
                </div>
                <h1 className="mt-2 break-words text-xl font-black leading-tight tracking-tight sm:text-3xl md:text-4xl">
                  {brand.product}
                </h1>
                <p
                  className={`mt-2 text-xs leading-relaxed sm:text-sm ${theme.pageText}`}
                >
                  Aplicativo técnico para recomendação de parâmetros de furação,
                  relatório PDF e suporte ao time comercial/aplicação.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 md:items-end">
              <span
                className={`self-start rounded-full border ${theme.modeBadgeBorder} ${theme.modeBadgeBg} px-4 py-2 text-xs font-bold ${theme.modeBadgeText} md:self-auto`}
              >
                {brand.mode}
              </span>
              <select
                value={themeKey}
                onChange={(e) => setTheme(e.target.value)}
                className={`w-full rounded-xl border ${theme.brandBadgeBorder} ${theme.brandBadgeBg} ${theme.brandBadgeText} px-3 py-2 text-xs font-bold outline-none cursor-pointer sm:w-auto`}
              >
                {THEME_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {THEMES[k].label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {/* ── ENTRADA DE DADOS ─────────────────────────────────────── */}
        <div
          className={`rounded-2xl border ${theme.panelBorder} ${theme.panelBg} p-4 shadow-lg ${theme.panelShadow} sm:p-5`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p
                className={`text-xs font-black tracking-[0.18em] ${theme.sectionLabelInput}`}
              >
                APLICAÇÃO
              </p>
              <h2 className="text-xl font-black">Dados de Entrada</h2>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className={`rounded-full ${theme.topToolsBadgeBg} px-4 py-1.5 text-xs font-bold ${theme.topToolsBadgeText} transition hover:opacity-80 self-start sm:self-auto`}
            >
              Limpar campos
            </button>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          </div>
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => setSubmittedData(data)}
              disabled={!isFormComplete(data)}
              className={`rounded-2xl ${theme.btnPdf} px-10 py-3.5 font-black text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-40`}
            >
              Calcular
            </button>
          </div>
        </div>

        {submittedData && result && (
          <>
            {/* ── TOOL RECOMMENDATION ─────────────────────────────────────── */}
            <div
              className={`rounded-2xl border ${theme.panelBorder} ${theme.panelBg} p-4 shadow-lg sm:p-5`}
            >
              <p
                className={`text-xs font-black tracking-[0.18em] ${theme.sectionLabelResult}`}
              >
                FERRAMENTAS EXALTT RECOMENDADAS
              </p>
              {toolRec.loading && (
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin" />
                  <span className={`text-xs ${theme.kpiLabel}`}>
                    Buscando ferramentas…
                  </span>
                </div>
              )}
              {!toolRec.loading && toolRec.error && (
                <p className={`mt-3 text-xs ${theme.kpiLabel}`}>
                  {toolRec.error}
                </p>
              )}
              {!toolRec.loading &&
                !toolRec.error &&
                toolRec.tools.length === 0 && (
                  <p className={`mt-3 text-xs ${theme.kpiLabel}`}>
                    Nenhuma ferramenta encontrada no catálogo para esta
                    configuração.
                  </p>
                )}
              {!toolRec.loading && toolRec.tools.length > 0 && (
                <div className="mt-3 space-y-2">
                  {toolRec.tools.map((tool, i) => (
                    <div
                      key={tool.code}
                      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border ${i === 0 ? theme.calcBadgeBorder : theme.resultBorder} ${i === 0 ? theme.calcBadgeBg : theme.resultBg} px-3 py-2.5`}
                    >
                      {i === 0 && (
                        <span
                          className={`shrink-0 rounded-full ${theme.calcBadgeBg} border ${theme.calcBadgeBorder} px-2 py-0.5 text-[10px] font-black ${theme.calcBadgeText}`}
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
                          ? "Refrig. interna"
                          : tool.coolant === "external"
                            ? "Refrig. externa"
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
              className="rounded-2xl border border-slate-700 bg-white p-3 text-slate-950 print-area shadow-lg sm:p-5"
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <p className="text-sm font-black text-blue-700">
                    {brand.company}
                    {brand.line.length ? ` • ${brand.line}` : ``}
                  </p>
                  <h2 className="text-2xl font-black">
                    Clever Mind – Drilling
                  </h2>
                  <p className="text-sm text-slate-600">
                    Resultado para visualização e impressão
                  </p>
                </div>
                <div className="text-right text-sm text-slate-600">
                  <p>Usuário: {email}</p>
                  <p>Data: {new Date().toLocaleDateString("pt-BR")}</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
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
              </div>

              <h3 className="mt-6 text-lg font-black">Resultados de Corte</h3>
              <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
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

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-bold text-slate-900">Recomendação</p>
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

            {/* ── PDF BUTTON ─────────────────────────────────────── */}
            <div className="mt-2 mb-10 flex flex-col items-center">
              <button
                onClick={() => gate(gerarPdf)}
                disabled={generatingPdf}
                className={`w-full max-w-md rounded-2xl ${theme.btnPdf} py-4 text-lg font-black text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {generatingPdf ? "Gerando PDF..." : "Gerar PDF"}
              </button>
            </div>
          </>
        )}
      </section>

      <style>{`
        .input{width:100%;border:1px solid ${theme.inputBorder};background:${theme.inputBackground};border-radius:.85rem;padding:.7rem .8rem;color:${theme.inputText};outline:none;font-size:15px}.input:focus{border-color:${theme.inputBorderFocus};box-shadow:0 0 0 3px ${theme.inputFocusRing}}
      `}</style>
      <style>{`
        .btn{border-radius:.85rem;padding:.75rem;text-align:center;font-weight:800;color:white;box-shadow:0 8px 18px rgba(0,0,0,.22)}
        button,a{touch-action:manipulation;-webkit-tap-highlight-color:transparent}
        @media print{
          body{background:white!important}.no-print, header, section > section:first-of-type, .rounded-3xl.border.border-slate-800.bg-slate-900.p-6:first-child{display:none!important}
          main{background:white!important;color:black!important;padding:0!important}.print-area{display:block!important;border:none!important;box-shadow:none!important;margin:0!important;padding:20px!important;color:black!important}
          #print-area{page-break-inside:avoid}.print-area *{color:black!important}
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
