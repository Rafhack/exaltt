import { useMemo, useState, useEffect } from "react";
import { THEMES, THEME_KEYS, DEFAULT_THEME, getTheme } from "./themes.js";
import { getFnForDiameter } from "./data/fnTable.js";
import { pdf } from "@react-pdf/renderer";
import { ReportPdf } from "./ReportPdf";
import { buildDefaultConfig } from "./data/defaults.js";

// ─── CONFIG FALLBACK (used while loading or when API is unreachable) ──────────
const FALLBACK_CONFIG = buildDefaultConfig();

// ─── API URL ───────────────────────────────────────────────────────────────────
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

// ─── useConfig hook ────────────────────────────────────────────────────────────
// Fetches config from the REST API. Falls back to FALLBACK_CONFIG on error
// or when VITE_API_BASE_URL is not set (pure offline mode).
function useConfig() {
  const [config, setConfig] = useState(FALLBACK_CONFIG);
  const [loading, setLoading] = useState(!!API_BASE_URL);

  useEffect(() => {
    if (!API_BASE_URL) return; // no API configured — use fallback silently
    fetch(`${API_BASE_URL}/api/config`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => setConfig({ ...FALLBACK_CONFIG, ...data }))
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

// alignedEmail is now called inside the component where NOTEBOOK_EMAIL is in scope

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

function buildMessage(data, result) {
  return [
    "Resultado AI EXALTT - Clever Mind Drilling AI",
    "",
    `Material: ${data.material}`,
    `Classificação ISO: ${result.isoDescription}`,
    `Classe do material: ${result.materialClass}`,
    `Dureza: ${data.hardness} HRC`,
    `Broca: EXALTT HPC Ø${data.diameter} mm`,
    `Geometria EXALTT: ${result.geometry.code} — ${result.geometry.name}`,
    `Aplicação da geometria: ${result.geometry.application}`,
    `Profundidade: ${data.depthFactor} / ${data.depthMm} mm`,
    `Máquina: ${data.machine}`,
    `Refrigeração: ${data.coolant} - ${data.pressure} bar`,
    "",
    `Vc: ${result.vc} m/min`,
    `RPM: ${result.rpm}`,
    `fn: ${result.fn} mm/rev`,
    `Vf: ${result.vf} mm/min`,
    `Vida estimada: ${result.life} furos`,
    `Potência com margem máquina (+25%): ${result.power} kW`,
    `Torque: ${result.torque} Nm`,
    `Stability Score: ${result.stability}%`,
  ].join("\n");
}

// ─── Empty state ───────────────────────────────────────────────────────────────
// The form starts fully empty — no pre-filled values — so the user must
// explicitly choose every parameter before a calculation is produced.
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

// Placeholder shown in the results panel before the user fills in the form
const EMPTY_RESULT = {
  vc: "—",
  rpm: "—",
  fn: "—",
  vf: "—",
  life: "—",
  cuttingPower: "—",
  power: "—",
  torque: "—",
  stability: "—",
  iso: "—",
  materialClass: "—",
  isoDescription: "Preencha os campos para calcular.",
  geometry: { code: "—", name: "—", application: "—" },
  baseVc: "—",
};

// True once every required input has a value — only then do we attempt calcAI
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

export default function CleverMindDashboard() {
  const { config, loading } = useConfig();
  const { brand, materials, depths, machines } = config;
  const { theme, themeKey, setTheme } = useTheme();

  const [data, setData] = useState({ ...EMPTY_DATA });
  const [status, setStatus] = useState("Sistema AI pronto.");
  const [pdfLink, setPdfLink] = useState("");
  const [emailLink, setEmailLink] = useState("");
  const [lastPdfUrl, setLastPdfUrl] = useState("");
  const [shareStatus, setShareStatus] = useState(
    "Use Salvar PDF, E-mail manual ou Copiar Resumo.",
  );

  const result = useMemo(() => {
    if (!isFormComplete(data)) return EMPTY_RESULT;
    try {
      return calcAI(data, config);
    } catch {
      return EMPTY_RESULT;
    }
  }, [data, config]);

  const email = brand.notebookEmail;

  // Profundidade máxima permitida (mm) = limiter do fator de profundidade × diâmetro da broca.
  // Só é calculável quando ambos os campos dependentes já foram preenchidos.
  const maxDepthMm = useMemo(() => {
    const dep = depths[data.depthFactor];
    const d = Number(data.diameter);
    if (!dep || !Number.isFinite(dep.limiter) || !Number.isFinite(d) || d <= 0)
      return null;
    return dep.limiter * d;
  }, [depths, data.depthFactor, data.diameter]);

  const update = (field, value) =>
    setData((prev) => ({ ...prev, [field]: value }));

  // Re-clamp depthMm automatically if a change to depthFactor/diameter lowers the limit
  // below the value the user already typed.
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
    setStatus("Sistema AI pronto.");
    setPdfLink("");
    setEmailLink("");
    setShareStatus("Use Salvar PDF, E-mail manual ou Copiar Resumo.");
  };

  const buildPdf = async () => {
    return pdf(
      <ReportPdf brand={brand} data={data} result={result} email={email} />,
    ).toBlob();
  };

  const copiarResumo = async () => {
    try {
      const message = buildMessage(data, result);

      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
        setShareStatus(
          "Resumo técnico copiado. Cole manualmente em e-mail, WhatsApp ou CRM.",
        );
        return;
      }

      setShareStatus(
        "Clipboard indisponível. Use o PDF salvo ou e-mail manual.",
      );
    } catch {
      setShareStatus(
        "Não foi possível copiar automaticamente. Use Salvar PDF.",
      );
    }
  };

  const gerarPdf = async () => {
    try {
      setStatus("Gerando PDF...");

      const blob = await buildPdf();

      if (
        lastPdfUrl &&
        lastPdfUrl.startsWith("blob:") &&
        typeof URL !== "undefined" &&
        URL.revokeObjectURL
      ) {
        URL.revokeObjectURL(lastPdfUrl);
      }

      if (typeof URL === "undefined" || !URL.createObjectURL) {
        throw new Error("Recurso de PDF indisponível neste navegador.");
      }

      const url = URL.createObjectURL(blob);
      const subject = `Resultado AI EXALTT - ${data.material} - Ø${data.diameter}`;
      const message = buildMessage(data, result);

      setLastPdfUrl(url);
      setPdfLink(url);
      setEmailLink(
        `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`,
      );

      setStatus("PDF gerado com sucesso");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erro ao gerar PDF.");
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
      className={`min-h-screen ${theme.pageBg} ${theme.pageText} p-2 sm:p-4 pb-16`}
    >
      <section className="mx-auto max-w-7xl space-y-3 sm:space-y-4">
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
                    {brand.company} • {brand.line}
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

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
          <Kpi label="Vc" value={result.vc} unit="m/min" theme={theme} />
          <Kpi label="RPM" value={result.rpm} theme={theme} />
          <Kpi label="fn" value={result.fn} unit="mm/rev" theme={theme} />
          <Kpi label="Vf" value={result.vf} unit="mm/min" theme={theme} />
          <Kpi label="Vida" value={result.life} unit="furos" theme={theme} />
          <Kpi
            label="Potência +25%"
            value={result.power}
            unit="kW"
            theme={theme}
          />
          <Kpi label="Torque" value={result.torque} unit="Nm" theme={theme} />
          <Kpi label="Score" value={result.stability} unit="%" theme={theme} />
        </section>

        <section className="grid grid-cols-1 gap-3 lg:grid-cols-3 lg:gap-4">
          <div
            className={`rounded-2xl border ${theme.panelBorder} ${theme.panelBg} p-4 shadow-lg ${theme.panelShadow} sm:p-5`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p
                  className={`text-xs font-black tracking-[0.18em] ${theme.sectionLabelInput}`}
                >
                  APLICAÇÃO
                </p>
                <h2 className="text-xl font-black">Entrada AI</h2>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className={`rounded-full ${theme.topToolsBadgeBg} px-3 py-1 text-xs font-bold ${theme.topToolsBadgeText} transition hover:opacity-80`}
              >
                Limpar campos
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Material / Classificação ISO" theme={theme}>
                  <select
                    className="input"
                    value={data.material}
                    onChange={(event) => update("material", event.target.value)}
                  >
                    <option value="" disabled>
                      Selecione...
                    </option>
                    {Object.entries(materials).map(([material, info]) => (
                      <option key={material} value={material}>
                        {material} • ISO {info.iso}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="HRC" theme={theme}>
                  <input
                    className="input"
                    type="number"
                    placeholder="—"
                    value={data.hardness}
                    onChange={(event) =>
                      update(
                        "hardness",
                        event.target.value === ""
                          ? ""
                          : Number(event.target.value),
                      )
                    }
                  />
                </Field>
              </div>

              <div
                className={`mt-3 rounded-2xl border ${theme.isoBorder} ${theme.isoBg} p-3 text-sm ${theme.isoText}`}
              >
                <p className="font-bold">{result.isoDescription}</p>
                <p className={`mt-1 ${theme.isoLabel}`}>
                  {result.materialClass}
                </p>
              </div>

              <Field label="Ø Broca" theme={theme}>
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

              <div className="grid grid-cols-2 gap-2">
                <Field label="Prof." theme={theme}>
                  <select
                    className="input"
                    value={data.depthFactor}
                    onChange={(event) =>
                      update("depthFactor", event.target.value)
                    }
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
                  label={maxDepthMm != null ? `mm (máx. ${maxDepthMm})` : "mm"}
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
                        event.target.value === ""
                          ? ""
                          : Number(event.target.value),
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
              </div>

              <Field label="Máquina" theme={theme}>
                <select
                  className="input"
                  value={data.machine}
                  onChange={(event) => update("machine", event.target.value)}
                >
                  <option value="" disabled>
                    Selecione...
                  </option>
                  {Object.keys(machines).map((machine) => (
                    <option key={machine}>{machine}</option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-2">
                <Field label="Refrig." theme={theme}>
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
                <Field label="bar" theme={theme}>
                  <input
                    className="input"
                    type="number"
                    placeholder="—"
                    value={data.pressure}
                    onChange={(event) =>
                      update(
                        "pressure",
                        event.target.value === ""
                          ? ""
                          : Number(event.target.value),
                      )
                    }
                  />
                </Field>
              </div>

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
          </div>

          <div
            className={`rounded-2xl border ${theme.panelBorder} ${theme.panelBg} p-4 shadow-lg ${theme.panelShadow} sm:p-5 lg:col-span-2`}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p
                  className={`text-xs font-black tracking-[0.18em] ${theme.sectionLabelResult}`}
                >
                  RESULTADO TÉCNICO
                </p>
                <h2 className="text-xl font-black">Resultado AI + PDF</h2>
              </div>
              <span
                className={`rounded-full border ${theme.calcBadgeBorder} ${theme.calcBadgeBg} px-3 py-1 text-xs font-bold ${theme.calcBadgeText}`}
              >
                Parâmetros calculados
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <Result
                label="Material"
                value={`${data.material} • ${result.isoDescription}`}
                theme={theme}
              />
              <Result
                label="Classe ISO"
                value={result.materialClass}
                theme={theme}
              />
              <Result
                label="Broca Recomendada"
                value={`EXALTT HPC Ø${data.diameter}`}
                theme={theme}
              />
              <Result
                label="Geometria EXALTT"
                value={`${result.geometry.code} — ${result.geometry.name}`}
                theme={theme}
              />
              <Result
                label="Aplicação Geometria"
                value={result.geometry.application}
                theme={theme}
              />
              <Result
                label="Profundidade"
                value={`${data.depthFactor} / ${data.depthMm} mm`}
                theme={theme}
              />
              <Result
                label="Vc Base"
                value={`${result.baseVc} m/min`}
                theme={theme}
              />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                onClick={gerarPdf}
                disabled={!isFormComplete(data)}
                className={`w-full rounded-2xl ${theme.btnPdf} py-3 font-black text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-40`}
              >
                Gerar PDF
              </button>
              <button
                onClick={copiarResumo}
                disabled={!isFormComplete(data)}
                className={`w-full rounded-2xl ${theme.btnCopy} py-3 font-black text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-40`}
              >
                Copiar Resumo
              </button>
            </div>

            <p
              className={`mt-2 rounded-2xl border ${theme.statusBorder} ${theme.statusBg} p-2 text-xs ${theme.statusText}`}
            >
              {status}
            </p>
            <p
              className={`mt-2 rounded-2xl border ${theme.shareBorder} ${theme.shareBg} p-2 text-xs ${theme.shareText}`}
            >
              {shareStatus}
            </p>
            {pdfLink && (
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 no-print">
                <a
                  className={`btn ${theme.btnLink}`}
                  href={pdfLink}
                  download={`Resultado_AI_${data.material.replaceAll(" ", "-")}-ISO_${result.iso}_EXALTT-HPC-Ø${data.diameter}.pdf`}
                >
                  Salvar PDF
                </a>
                {emailLink && (
                  <a className={`btn ${theme.btnLink}`} href={emailLink}>
                    E-mail manual
                  </a>
                )}
                <button
                  className={`btn ${theme.btnLink}`}
                  onClick={copiarResumo}
                >
                  Copiar Resumo
                </button>
              </div>
            )}

            <div
              id="print-area"
              className="mt-4 rounded-2xl border border-slate-700 bg-white p-3 text-slate-950 print-area sm:p-4"
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <p className="text-sm font-black text-blue-700">
                    {brand.company} • {brand.line}
                  </p>
                  <h2 className="text-2xl font-black">
                    Clever Mind – Drilling AI
                  </h2>
                  <p className="text-sm text-slate-600">
                    Resultado AI para visualização e impressão
                  </p>
                </div>
                <div className="text-right text-sm text-slate-600">
                  <p>Usuário: {email}</p>
                  <p>Data: {new Date().toLocaleDateString("pt-BR")}</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                <PrintRow
                  label="Material"
                  value={`${data.material} • ${result.isoDescription}`}
                />
                <PrintRow
                  label="Classe do Material"
                  value={result.materialClass}
                />
                <PrintRow label="Dureza" value={`${data.hardness} HRC`} />
                <PrintRow
                  label="Número de cortes"
                  value={`${data.cuttingEdges}`}
                />
                <PrintRow
                  label="Broca"
                  value={`EXALTT HPC Ø${data.diameter} mm`}
                />
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
                  value={`${data.depthFactor} / ${data.depthMm} mm`}
                />
                <PrintRow label="Máquina" value={data.machine} />
                <PrintRow
                  label="Refrigeração"
                  value={`${data.coolant} • ${data.pressure} bar`}
                />
              </div>

              <h3 className="mt-6 text-lg font-black">Resultados de Corte</h3>
              <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                <PrintKpi label="Vc" value={`${result.vc} m/min`} />
                <PrintKpi label="RPM / N" value={result.rpm} />
                <PrintKpi label="fn" value={`${result.fn} mm/rev`} />
                <PrintKpi label="Vf" value={`${result.vf} mm/min`} />
                <PrintKpi label="Vida" value={`${result.life} furos`} />
                <PrintKpi label="Potência +25%" value={`${result.power} kW`} />
                <PrintKpi
                  label="Torque c/ margem"
                  value={`${result.torque} Nm`}
                />
                <PrintKpi label="Score" value={`${result.stability}%`} />
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-bold text-slate-900">Recomendação AI</p>
                <p>
                  Usar broca EXALTT HPC Ø{data.diameter} mm com geometria{" "}
                  {result.geometry.code} para {result.geometry.application}{" "}
                  Estratégia ajustada para {data.depthFactor}, considerando{" "}
                  {data.machine}, refrigeração {data.coolant} e objetivo de{" "}
                  {data.goal}. A potência exibida já inclui margem de segurança
                  de 25% para garantia da máquina.
                </p>
              </div>
            </div>
          </div>
        </section>
      </section>

      <style>{`
        .input{width:100%;border:1px solid ${theme.inputBorder};background:${theme.inputBg};border-radius:.85rem;padding:.7rem .8rem;color:${theme.inputText};outline:none;font-size:15px}.input:focus{border-color:${theme.inputBorderFocus};box-shadow:0 0 0 3px ${theme.inputFocusRing}}
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
    </main>
  );
}

function Kpi({ label, value, unit, theme }) {
  return (
    <div className={`rounded-xl border ${theme.kpiBorder} ${theme.kpiBg} p-3`}>
      <p className={`text-xs ${theme.kpiLabel}`}>{label}</p>
      <p className={`mt-1 text-xl font-black ${theme.kpiValue}`}>{value}</p>
      {unit && <p className={`text-[11px] ${theme.kpiUnit}`}>{unit}</p>}
    </div>
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

function Result({ label, value, theme }) {
  return (
    <div
      className={`rounded-xl border ${theme.resultBorder} ${theme.resultBg} p-3`}
    >
      <p className={`text-xs ${theme.resultLabel}`}>{label}</p>
      <p className={`mt-1 text-sm font-bold ${theme.resultValue}`}>{value}</p>
    </div>
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
