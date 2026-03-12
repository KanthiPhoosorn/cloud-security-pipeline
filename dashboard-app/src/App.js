import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

// Mock data — in production this comes from PostgreSQL API
const MOCK_FINDINGS = [
  { event_id: "prowler-findings/audit-test-1", severity: "HIGH",     resource_type: "security_group", status: "REMEDIATED", approver: "kanthiphs", avg_mttr: 12 },
  { event_id: "prowler-findings/iam-test-2",   severity: "CRITICAL", resource_type: "iam_role",       status: "REMEDIATED", approver: "kanthiphs", avg_mttr: 18 },
  { event_id: "prowler-findings/s3-test-2",    severity: "HIGH",     resource_type: "s3_bucket",      status: "REMEDIATED", approver: "kanthiphs", avg_mttr: 8  },
  { event_id: "test/sg-003",                   severity: "MEDIUM",   resource_type: "security_group", status: "OPEN",       approver: null,        avg_mttr: null },
  { event_id: "test/sg-001",                   severity: "HIGH",     resource_type: "security_group", status: "REMEDIATED", approver: "kanthiphs", avg_mttr: 126 },
  { event_id: "test/iam-001",                  severity: "CRITICAL", resource_type: "iam_role",       status: "REMEDIATED", approver: "kanthiphs", avg_mttr: 135 },
];

const SEVERITY_WEIGHTS = { CRITICAL: 64, HIGH: 16, MEDIUM: 4, LOW: 1 };
const SEVERITY_COLORS  = { CRITICAL: "#ef4444", HIGH: "#f97316", MEDIUM: "#eab308", LOW: "#22c55e", OPEN: "#6b7280" };

function computeSecureScore(findings) {
  const total = findings.length;
  if (total === 0) return 100;
  const open = findings.filter(f => f.status === "OPEN");
  const penalty = open.reduce((sum, f) => sum + (SEVERITY_WEIGHTS[f.severity] || 1), 0);
  const maxPenalty = total * SEVERITY_WEIGHTS["CRITICAL"];
  return Math.max(0, Math.round(100 - (penalty / maxPenalty) * 100));
}

function ScoreGauge({ score }) {
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#eab308" : "#ef4444";
  return (
    <div style={{ textAlign: "center", padding: "20px" }}>
      <div style={{ fontSize: "80px", fontWeight: "bold", color }}>{score}</div>
      <div style={{ fontSize: "20px", color: "#9ca3af" }}>Cloud Secure Score</div>
      <div style={{
        width: "200px", height: "12px", background: "#374151",
        borderRadius: "6px", margin: "12px auto"
      }}>
        <div style={{
          width: `${score}%`, height: "100%", background: color,
          borderRadius: "6px", transition: "width 1s ease"
        }} />
      </div>
    </div>
  );
}

export default function App() {
  const [findings]  = useState(MOCK_FINDINGS);
  const [activeTab, setActiveTab] = useState("overview");
  const score = computeSecureScore(findings);

  // Severity distribution for pie chart
  const severityData = Object.entries(
    findings.reduce((acc, f) => {
      acc[f.severity] = (acc[f.severity] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  // MTTR by severity
  const mttrData = Object.entries(
    findings.filter(f => f.avg_mttr).reduce((acc, f) => {
      if (!acc[f.severity]) acc[f.severity] = { total: 0, count: 0 };
      acc[f.severity].total += f.avg_mttr;
      acc[f.severity].count += 1;
      return acc;
    }, {})
  ).map(([severity, { total, count }]) => ({
    severity,
    mttr: Math.round(total / count)
  }));

  // Status counts
  const remediated = findings.filter(f => f.status === "REMEDIATED").length;
  const open       = findings.filter(f => f.status === "OPEN").length;

  const styles = {
    app:     { background: "#111827", minHeight: "100vh", color: "#f9fafb", fontFamily: "monospace" },
    header:  { background: "#1f2937", padding: "16px 24px", borderBottom: "1px solid #374151", display: "flex", alignItems: "center", gap: "12px" },
    title:   { fontSize: "20px", fontWeight: "bold", color: "#60a5fa" },
    nav:     { display: "flex", gap: "8px", padding: "16px 24px", borderBottom: "1px solid #374151" },
    tab:     { padding: "8px 16px", borderRadius: "6px", cursor: "pointer", border: "none", fontFamily: "monospace" },
    grid:    { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", padding: "24px" },
    card:    { background: "#1f2937", borderRadius: "8px", padding: "20px", border: "1px solid #374151" },
    label:   { color: "#9ca3af", fontSize: "12px", textTransform: "uppercase", marginBottom: "8px" },
    bigNum:  { fontSize: "48px", fontWeight: "bold" },
    table:   { width: "100%", borderCollapse: "collapse", margin: "0 24px", width: "calc(100% - 48px)" },
    th:      { textAlign: "left", padding: "8px 12px", color: "#9ca3af", fontSize: "12px", borderBottom: "1px solid #374151" },
    td:      { padding: "10px 12px", borderBottom: "1px solid #1f2937", fontSize: "13px" },
  };

  const tabStyle = (t) => ({
    ...styles.tab,
    background: activeTab === t ? "#3b82f6" : "#374151",
    color: activeTab === t ? "white" : "#9ca3af"
  });

  return (
    <div style={styles.app}>
      <div style={styles.header}>
        <span style={{ fontSize: "24px" }}>🔐</span>
        <span style={styles.title}>Cloud Security Pipeline — Dashboard</span>
        <span style={{ marginLeft: "auto", color: "#9ca3af", fontSize: "12px" }}>
          {new Date().toLocaleString()}
        </span>
      </div>

      <div style={styles.nav}>
        {["overview", "findings", "mttr"].map(t => (
          <button key={t} style={tabStyle(t)} onClick={() => setActiveTab(t)}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div>
          <div style={styles.grid}>
            <div style={styles.card}>
              <ScoreGauge score={score} />
            </div>
            <div style={styles.card}>
              <div style={styles.label}>Total Findings</div>
              <div style={{ ...styles.bigNum, color: "#60a5fa" }}>{findings.length}</div>
            </div>
            <div style={styles.card}>
              <div style={styles.label}>Remediated</div>
              <div style={{ ...styles.bigNum, color: "#22c55e" }}>{remediated}</div>
            </div>
            <div style={styles.card}>
              <div style={styles.label}>Open</div>
              <div style={{ ...styles.bigNum, color: "#ef4444" }}>{open}</div>
            </div>
          </div>

          <div style={{ ...styles.card, margin: "0 24px 24px" }}>
            <div style={styles.label}>Findings by Severity</div>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={severityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {severityData.map((entry) => (
                    <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] || "#6b7280"} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === "findings" && (
        <div style={{ padding: "24px" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                {["Event ID", "Severity", "Resource Type", "Status", "Approver"].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {findings.map(f => (
                <tr key={f.event_id}>
                  <td style={styles.td}>{f.event_id.split("/").pop()}</td>
                  <td style={{ ...styles.td, color: SEVERITY_COLORS[f.severity] }}>{f.severity}</td>
                  <td style={styles.td}>{f.resource_type}</td>
                  <td style={{ ...styles.td, color: f.status === "REMEDIATED" ? "#22c55e" : "#ef4444" }}>{f.status}</td>
                  <td style={styles.td}>{f.approver || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "mttr" && (
        <div style={{ ...styles.card, margin: "24px" }}>
          <div style={styles.label}>Mean Time To Remediate (minutes)</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={mttrData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="severity" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip contentStyle={{ background: "#1f2937", border: "1px solid #374151" }} />
              <Bar dataKey="mttr" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
