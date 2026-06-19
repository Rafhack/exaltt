import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 28,
    backgroundColor: "#ffffff",
    fontSize: 10,
    color: "#0f172a",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: 1,
    borderColor: "#e2e8f0",
    paddingBottom: 14,
  },

  logo: {
    width: 120,
    height: 40,
    objectFit: "contain",
  },

  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },

  headerContent: {
    marginLeft: 16,
  },

  brand: {
    fontSize: 11,
    color: "#1d4ed8",
    fontWeight: "bold",
  },

  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 4,
  },

  subtitle: {
    marginTop: 4,
    color: "#64748b",
  },

  small: {
    fontSize: 9,
    color: "#64748b",
    textAlign: "right",
  },

  section: {
    marginTop: 18,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  row: {
    width: "48%",
    border: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 10,
  },

  label: {
    fontSize: 8,
    textTransform: "uppercase",
    color: "#64748b",
    fontWeight: "bold",
  },

  value: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "bold",
    color: "#020617",
  },

  resultsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
  },

  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  kpi: {
    width: "23%",
    border: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 10,
  },

  kpiLabel: {
    fontSize: 8,
    color: "#64748b",
  },

  kpiValue: {
    marginTop: 5,
    fontSize: 14,
    fontWeight: "bold",
  },

  recommendation: {
    marginTop: 24,
    border: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 14,
  },

  recommendationTitle: {
    fontWeight: "bold",
    marginBottom: 6,
  },

  recommendationText: {
    lineHeight: 1,
    color: "#334155",
  },
});

function uncaptalize(str) {
  if (!str || !str.length) return str;
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function PdfRow({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function PdfKpi({ label, value }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
    </View>
  );
}

export function ReportPdf({ brand, data, result, email }) {
  console.log(`LOGO: ${brand.logoUrl}`);
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* HEADER */}

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image style={styles.logo} src={brand.logoUrl} />

            <View style={styles.headerContent}>
              <Text style={styles.brand}>
                {brand.company} • {brand.line}
              </Text>

              <Text style={styles.title}>{brand.product}</Text>

              <Text style={styles.subtitle}>
                Resultado AI para visualização e impressão
              </Text>
            </View>
          </View>

          <View>
            <Text style={styles.small}>Usuário: {email}</Text>

            <Text style={styles.small}>
              Data: {new Date().toLocaleDateString("pt-BR")}
            </Text>
          </View>
        </View>

        {/* DETAILS */}

        <View style={styles.section}>
          <View style={styles.grid}>
            <PdfRow
              label="Material"
              value={`${data.material} • ${result.isoDescription}`}
            />

            <PdfRow label="Classe do Material" value={result.materialClass} />

            <PdfRow label="Dureza" value={`${data.hardness} HRC`} />

            <PdfRow label="Broca" value={`EXALTT HPC Ø${data.diameter} mm`} />

            <PdfRow
              label="Geometria EXALTT"
              value={`${result.geometry.code} — ${result.geometry.name}`}
            />

            <PdfRow
              label="Aplicação Geometria"
              value={result.geometry.application}
            />

            <PdfRow
              label="Profundidade"
              value={`${data.depthFactor} / ${data.depthMm} mm`}
            />

            <PdfRow label="Máquina" value={data.machine} />

            <PdfRow
              label="Refrigeração"
              value={`${data.coolant} • ${data.pressure} bar`}
            />
          </View>
        </View>

        {/* RESULTS */}

        <View style={styles.section}>
          <Text style={styles.resultsTitle}>Resultados de Corte</Text>

          <View style={styles.kpiGrid}>
            <PdfKpi label="Vc" value={`${result.vc} m/min`} />

            <PdfKpi label="RPM" value={result.rpm} />

            <PdfKpi label="fn" value={`${result.fn} mm/rev`} />

            <PdfKpi label="Vf" value={`${result.vf} mm/min`} />

            <PdfKpi label="Vida" value={`${result.life} furos`} />

            <PdfKpi label="Potência +25%" value={`${result.power} kW`} />

            <PdfKpi label="Torque" value={`${result.torque} Nm`} />

            <PdfKpi label="Score" value={`${result.stability}%`} />
          </View>
        </View>

        {/* RECOMMENDATION */}

        <View style={styles.recommendation}>
          <Text style={styles.recommendationTitle}>Recomendação AI</Text>

          <Text style={styles.recommendationText}>
            {`Usar broca EXALTT HPC Ø${data.diameter} mm com geometria ${result.geometry.code} ` +
              `para ${uncaptalize(result.geometry.application)} Estratégia ajustada para ` +
              `${data.depthFactor}, considerando ${data.machine}, refrigeração ${uncaptalize(data.coolant)} ` +
              `e objetivo de ${uncaptalize(data.goal)}. A potência exibida já inclui margem de segurança de 25%.`}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
