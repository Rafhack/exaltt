import { useMemo, useState, useEffect } from "react";
import { THEMES, THEME_KEYS, DEFAULT_THEME, getTheme } from "./themes.js";
import { getFnForDiameter } from "./data/fnTable.js";
import { pdf } from "@react-pdf/renderer";
import { ReportPdf } from "./ReportPdf";

// ─── CONFIG FALLBACK (used while loading or when API is unreachable) ──────────
const FALLBACK_CONFIG = {
  brand: {
    company: "TopTools Brasil",
    line: "EXALTT",
    product: "Clever Mind – Drilling AI",
    mode: "Backup",
    notebookEmail: "silvio@toptools.com.br",
  },
  materials: {
    // ISO P — Aços carbono, ligados e ferramenta
    "SAE 1020": {
      vc: 135,
      fn: 0.26,
      life: 1800,
      iso: "P",
      materialClass: "Aço carbono baixo carbono",
    },
    "SAE 1045": {
      vc: 125,
      fn: 0.22,
      life: 1500,
      iso: "P",
      materialClass: "Aço carbono médio carbono",
    },
    "SAE 4140": {
      vc: 115,
      fn: 0.24,
      life: 1200,
      iso: "P",
      materialClass: "Aço ligado beneficiado",
    },
    "SAE 8620": {
      vc: 86,
      fn: 0.19,
      life: 2300,
      iso: "P",
      materialClass: "Aço ligado para cementação",
    },
    "SAE 52100": {
      vc: 75,
      fn: 0.16,
      life: 950,
      iso: "P",
      materialClass: "Aço rolamento alto carbono/cromo",
    },
    D2: {
      vc: 58,
      fn: 0.13,
      life: 720,
      iso: "H",
      materialClass: "Aço ferramenta alto cromo endurecido",
    },
    VC131: {
      vc: 55,
      fn: 0.12,
      life: 680,
      iso: "H",
      materialClass: "Aço ferramenta similar D2 / alta dureza",
    },

    // ISO M — Aços inoxidáveis
    "Inox 304": {
      vc: 68,
      fn: 0.16,
      life: 850,
      iso: "M",
      materialClass: "Aço inoxidável austenítico",
    },
    "Inox 316": {
      vc: 62,
      fn: 0.15,
      life: 780,
      iso: "M",
      materialClass: "Aço inoxidável austenítico com molibdênio",
    },
    "Inox 410": {
      vc: 75,
      fn: 0.17,
      life: 900,
      iso: "M",
      materialClass: "Aço inoxidável martensítico",
    },
    "Inox 420": {
      vc: 65,
      fn: 0.14,
      life: 760,
      iso: "M",
      materialClass: "Aço inoxidável martensítico endurecível",
    },

    // ISO K — Ferros fundidos
    "Ferro Fundido Cinzento": {
      vc: 120,
      fn: 0.28,
      life: 1800,
      iso: "K",
      materialClass: "Ferro fundido cinzento",
    },
    "Ferro Fundido Nodular": {
      vc: 105,
      fn: 0.25,
      life: 1600,
      iso: "K",
      materialClass: "Ferro fundido nodular",
    },

    // ISO N — Materiais não ferrosos
    "Alumínio 6061": {
      vc: 220,
      fn: 0.3,
      life: 2400,
      iso: "N",
      materialClass: "Alumínio usinável série 6000",
    },
    "Alumínio 7075": {
      vc: 190,
      fn: 0.26,
      life: 2100,
      iso: "N",
      materialClass: "Alumínio aeronáutico alta resistência",
    },
    "Alumínio Fundido": {
      vc: 180,
      fn: 0.28,
      life: 2000,
      iso: "N",
      materialClass: "Alumínio fundido com silício",
    },
    "Cobre Eletrolítico": {
      vc: 120,
      fn: 0.18,
      life: 1500,
      iso: "N",
      materialClass: "Cobre puro de alta condutividade",
    },
    Latão: {
      vc: 180,
      fn: 0.24,
      life: 2200,
      iso: "N",
      materialClass: "Liga cobre-zinco / brass",
    },
    Bronze: {
      vc: 115,
      fn: 0.2,
      life: 1600,
      iso: "N",
      materialClass: "Liga cobre-estanho / bronze",
    },
    "Cobre Berílio": {
      vc: 95,
      fn: 0.16,
      life: 1250,
      iso: "N",
      materialClass: "Liga cobre-berílio alta resistência",
    },

    // ISO S — Superligas resistentes ao calor
    "Inconel 625": {
      vc: 32,
      fn: 0.08,
      life: 420,
      iso: "S",
      materialClass: "Superliga níquel resistente ao calor",
    },
    "Inconel 718": {
      vc: 28,
      fn: 0.07,
      life: 360,
      iso: "S",
      materialClass: "Superliga níquel endurecida por precipitação",
    },
    "Titânio Ti6Al4V": {
      vc: 45,
      fn: 0.1,
      life: 520,
      iso: "S",
      materialClass: "Liga de titânio aeroespacial",
    },

    // ISO H — Materiais endurecidos
    "Aço Temperado 45 HRC": {
      vc: 48,
      fn: 0.1,
      life: 600,
      iso: "H",
      materialClass: "Aço endurecido até 45 HRC",
    },
    "Aço Temperado 55 HRC": {
      vc: 35,
      fn: 0.08,
      life: 430,
      iso: "H",
      materialClass: "Aço endurecido até 55 HRC",
    },
    "Aço Temperado 60 HRC": {
      vc: 28,
      fn: 0.06,
      life: 320,
      iso: "H",
      materialClass: "Aço endurecido até 60 HRC",
    },
  },
  isoClasses: {
    P: "ISO P — Aços",
    M: "ISO M — Aços inoxidáveis",
    K: "ISO K — Ferros fundidos",
    N: "ISO N — Não ferrosos",
    S: "ISO S — Superligas resistentes ao calor",
    H: "ISO H — Materiais endurecidos",
  },
  geometries: {
    XTA: {
      code: "XTA",
      name: "Geometria para Aços",
      application: "Aplicar em aços carbono, baixa liga e aços ligados ISO P.",
      iso: ["P"],
    },
    XTH: {
      code: "XTH",
      name: "Geometria para Ferro Fundido",
      application: "Aplicar em ferro fundido cinzento e nodular ISO K.",
      iso: ["K"],
    },
    XTS: {
      code: "XTS",
      name: "Geometria para Não Ferrosos",
      application:
        "Aplicar em não ferrosos ISO N, inclusive alumínio, cobre e ligas de cobre.",
      iso: ["N"],
    },
    XTL: {
      code: "XTL",
      name: "Geometria para Inox e Superligas",
      application:
        "Aplicar em aços inoxidáveis ISO M, titânio, Inconel e superligas resistentes ao calor ISO S.",
      iso: ["M", "S"],
    },
  },
  depths: {
    "3xD": { vc: 1.05, fn: 1.03, life: 1.08, risk: 99 },
    "5xD": { vc: 1, fn: 1, life: 1, risk: 98 },
    "8xD": { vc: 0.92, fn: 0.94, life: 0.88, risk: 91 },
    "12xD": { vc: 0.84, fn: 0.88, life: 0.76, risk: 84 },
  },
  machines: {
    "Romi D800": { vc: 1, fn: 1, stability: 98 },
    "HASS VF-5-50XT": { vc: 1.03, fn: 1.02, stability: 97 },
    "Fanuc Robodrill D14Mi": { vc: 1.03, fn: 1.02, stability: 97 },
    "Fanuc Robodrill D21Mi": { vc: 1.04, fn: 1.03, stability: 98 },
    "Brother Speedio R450-X": { vc: 1.06, fn: 1.04, stability: 99 },
    "Brother Speedio R650-X": { vc: 1.06, fn: 1.04, stability: 99 },
    "Mazak VTC 200C": { vc: 1.03, fn: 1.02, stability: 97 },
    "Mazak VTC-EZ30": { vc: 1.04, fn: 1.03, stability: 98 },
    "Heller H4000": { vc: 1.05, fn: 1.04, stability: 99 },
    "Heller H8000": { vc: 1.06, fn: 1.05, stability: 99 },
    "Okuma MB-4000H": { vc: 1.04, fn: 1.03, stability: 98 },
    "Okuma MB-5000HII": { vc: 1.05, fn: 1.04, stability: 99 },
    "Deckel Maho DMU50": { vc: 1.02, fn: 1.01, stability: 97 },
  },
};

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
  },
  config,
) {
  const d = Number(diameter);
  const h = Number(hardness);
  const p = Number(pressure);

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
  const vf = Math.round(fn * rpm);
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

export default function CleverMindDashboard() {
  const { config, loading } = useConfig();
  const { brand, materials, depths, machines } = config;
  const { theme, themeKey, setTheme } = useTheme();

  const [data, setData] = useState({
    material: "SAE 4140",
    diameter: 12,
    hardness: 32,
    depthFactor: "5xD",
    depthMm: 60,
    machine: "Romi D800",
    coolant: "Interna",
    pressure: 20,
    goal: "Alta produtividade",
  });
  const [status, setStatus] = useState("Sistema AI pronto.");
  const [pdfLink, setPdfLink] = useState("");
  const [emailLink, setEmailLink] = useState("");
  const [lastPdfUrl, setLastPdfUrl] = useState("");
  const [shareStatus, setShareStatus] = useState(
    "Use Salvar PDF, E-mail manual ou Copiar Resumo.",
  );

  const result = useMemo(() => {
    try {
      return calcAI(data, config);
    } catch {
      return calcAI(
        { ...data, diameter: 12, hardness: 32, pressure: 20 },
        config,
      );
    }
  }, [data, config]);

  const email = brand.notebookEmail;

  const update = (field, value) =>
    setData((prev) => ({ ...prev, [field]: value }));

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
              <span
                className={`rounded-full ${theme.topToolsBadgeBg} px-3 py-1 text-xs font-bold ${theme.topToolsBadgeText}`}
              >
                {brand.company}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Material / Classificação ISO" theme={theme}>
                  <select
                    className="input"
                    value={data.material}
                    onChange={(event) => update("material", event.target.value)}
                  >
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
                    value={data.hardness}
                    onChange={(event) =>
                      update("hardness", Number(event.target.value))
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
                  value={data.diameter}
                  onChange={(event) =>
                    update("diameter", Number(event.target.value))
                  }
                />
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
                    {Object.keys(depths).map((depth) => (
                      <option key={depth}>{depth}</option>
                    ))}
                  </select>
                </Field>
                <Field label="mm" theme={theme}>
                  <input
                    className="input"
                    type="number"
                    value={data.depthMm}
                    onChange={(event) =>
                      update("depthMm", Number(event.target.value))
                    }
                  />
                </Field>
              </div>

              <Field label="Máquina" theme={theme}>
                <select
                  className="input"
                  value={data.machine}
                  onChange={(event) => update("machine", event.target.value)}
                >
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
                    <option>Interna</option>
                    <option>Externa</option>
                  </select>
                </Field>
                <Field label="bar" theme={theme}>
                  <input
                    className="input"
                    type="number"
                    value={data.pressure}
                    onChange={(event) =>
                      update("pressure", Number(event.target.value))
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
                className={`w-full rounded-2xl ${theme.btnPdf} py-3 font-black text-white shadow-lg`}
              >
                Gerar PDF
              </button>
              <button
                onClick={copiarResumo}
                className={`w-full rounded-2xl ${theme.btnCopy} py-3 font-black text-white shadow-lg`}
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
                  download={`Resultado_AI_${data.material.replaceAll(" ", "-")}-ISO_${result.iso}_EXALTT-HPC-D4_${data.diameter}.pdf`}
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
