import { useState, useEffect, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area, LineChart, Line
} from "recharts";

const FINDINGS = [
  { event_id: "prowler-findings/audit-test-1",  severity: "HIGH",     resource_type: "security_group", resource_id: "sg-0a74a37c60d6b6aa4",      status: "REMEDIATED", approver: "kanthiphs", check_id: "CKV_AWS_24", description: "SSH open to 0.0.0.0/0",        mttr: 12,  ts: "2026-03-12 14:43" },
  { event_id: "prowler-findings/iam-test-2",    severity: "CRITICAL", resource_type: "iam_role",       resource_id: "vulnerable-lab-role",          status: "REMEDIATED", approver: "kanthiphs", check_id: "CKV_AWS_40", description: "IAM wildcard permissions",     mttr: 18,  ts: "2026-03-12 14:53" },
  { event_id: "prowler-findings/s3-test-2",     severity: "HIGH",     resource_type: "s3_bucket",      resource_id: "vulnerable-lab-bucket-9811f340",status: "REMEDIATED", approver: "kanthiphs", check_id: "CKV_AWS_53", description: "S3 public access enabled",     mttr: 8,   ts: "2026-03-12 14:59" },
  { event_id: "prowler-findings/slack-test-f3", severity: "HIGH",     resource_type: "security_group", resource_id: "sg-0e3cc70cb5a40de12",         status: "REMEDIATED", approver: "kanthiphs", check_id: "CKV_AWS_24", description: "SSH open to 0.0.0.0/0",        mttr: 4,   ts: "2026-03-12 14:43" },
  { event_id: "test/sg-001",                    severity: "HIGH",     resource_type: "security_group", resource_id: "sg-0ad3fe56d4ed62eb0",          status: "REMEDIATED", approver: "kanthiphs", check_id: "CKV_AWS_24", description: "MySQL open to 0.0.0.0/0",      mttr: 126, ts: "2026-03-11 20:46" },
  { event_id: "test/iam-001",                   severity: "CRITICAL", resource_type: "iam_role",       resource_id: "vulnerable-lab-role",          status: "REMEDIATED", approver: "kanthiphs", check_id: "CKV_AWS_40", description: "IAM wildcard permissions",     mttr: 135, ts: "2026-03-11 20:53" },
  { event_id: "test/s3-001",                    severity: "HIGH",     resource_type: "s3_bucket",      resource_id: "vulnerable-lab-bucket-08a9fb37",status: "REMEDIATED", approver: "kanthiphs", check_id: "CKV_AWS_53", description: "S3 public access enabled",     mttr: 10,  ts: "2026-03-11 21:01" },
  { event_id: "live/rdp-open",                  severity: "MEDIUM",   resource_type: "security_group", resource_id: "sg-abc123",                    status: "OPEN",       approver: null,        check_id: "CKV_AWS_25", description: "RDP open to 0.0.0.0/0",        mttr: null,ts: "2026-03-12 15:10" },
  { event_id: "live/ec2-imds",                  severity: "LOW",      resource_type: "ec2_instance",   resource_id: "i-0a69fd8c556b5d0d1",          status: "OPEN",       approver: null,        check_id: "CKV_AWS_79", description: "EC2 IMDSv1 enabled",           mttr: null,ts: "2026-03-12 15:10" },
];

const SEVERITY_W = { CRITICAL: 64, HIGH: 16, MEDIUM: 4, LOW: 1 };
const SEV_COLOR  = { CRITICAL: "#ff2d55", HIGH: "#ff9500", MEDIUM: "#ffd60a", LOW: "#30d158", OPEN: "#636366" };
const SEV_GLOW   = { CRITICAL: "0 0 12px #ff2d5599", HIGH: "0 0 12px #ff950099", MEDIUM: "0 0 12px #ffd60a99", LOW: "0 0 12px #30d15899" };

function computeScore(findings) {
  const open = findings.filter(f => f.status === "OPEN");
  if (open.length === 0) return 100;
  const penalty = open.reduce((s, f) => s + (SEVERITY_W[f.severity] || 1), 0);
  const maxP = findings.length * SEVERITY_W["CRITICAL"];
  return Math.max(0, Math.round(100 - (penalty / maxP) * 100));
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:       #030712;
    --bg2:      #0a0f1e;
    --bg3:      #0d1526;
    --border:   #1a2540;
    --border2:  #243352;
    --accent:   #00d4ff;
    --accent2:  #0088ff;
    --green:    #00ff88;
    --red:      #ff2d55;
    --orange:   #ff9500;
    --yellow:   #ffd60a;
    --text:     #e2e8f0;
    --text2:    #94a3b8;
    --text3:    #475569;
  }

  body {
    background: var(--bg);
    font-family: 'Share Tech Mono', monospace;
    color: var(--text);
    overflow-x: hidden;
  }

  .scanline {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px);
    pointer-events: none; z-index: 9999;
  }

  .grid-bg {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background-image:
      linear-gradient(rgba(0, 212, 255, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0, 212, 255, 0.03) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none; z-index: 0;
  }

  .app { position: relative; z-index: 1; min-height: 100vh; }

  /* HEADER */
  .header {
    display: flex; align-items: center; gap: 16px;
    padding: 0 24px; height: 64px;
    background: rgba(10, 15, 30, 0.95);
    border-bottom: 1px solid var(--border2);
    backdrop-filter: blur(12px);
    position: sticky; top: 0; z-index: 100;
  }
  .header-logo {
    font-family: 'Orbitron', sans-serif;
    font-size: 18px; font-weight: 900;
    color: var(--accent);
    text-shadow: 0 0 20px var(--accent);
    letter-spacing: 2px;
  }
  .header-sub { color: var(--text3); font-size: 11px; }
  .header-right { margin-left: auto; display: flex; align-items: center; gap: 20px; }
  .live-badge {
    display: flex; align-items: center; gap: 6px;
    color: var(--green); font-size: 11px;
  }
  .live-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--green);
    box-shadow: 0 0 8px var(--green);
    animation: pulse 1.5s infinite;
  }
  @keyframes pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.5; transform:scale(0.8); } }

  .time { color: var(--text3); font-size: 12px; }

  /* TABS */
  .tabs {
    display: flex; gap: 2px; padding: 12px 24px;
    background: rgba(10,15,30,0.8);
    border-bottom: 1px solid var(--border);
  }
  .tab {
    padding: 8px 20px; font-family: 'Share Tech Mono', monospace;
    font-size: 12px; letter-spacing: 1px; cursor: pointer;
    border: 1px solid var(--border2); background: transparent;
    color: var(--text3); transition: all 0.2s; clip-path: polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%);
  }
  .tab:hover { color: var(--accent); border-color: var(--accent); }
  .tab.active {
    background: rgba(0, 212, 255, 0.1);
    border-color: var(--accent); color: var(--accent);
    text-shadow: 0 0 8px var(--accent);
    box-shadow: inset 0 0 20px rgba(0,212,255,0.05);
  }

  /* MAIN */
  .main { padding: 20px 24px; }

  /* CARDS GRID */
  .kpi-grid { display: grid; grid-template-columns: 280px 1fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px; }

  .card {
    background: var(--bg2);
    border: 1px solid var(--border2);
    padding: 20px;
    position: relative; overflow: hidden;
    clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
  }
  .card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, var(--accent), transparent);
  }
  .card-label {
    font-size: 10px; letter-spacing: 2px; color: var(--text3);
    text-transform: uppercase; margin-bottom: 8px;
  }
  .card-value { font-family: 'Orbitron', sans-serif; font-size: 40px; font-weight: 700; }

  /* SCORE CARD */
  .score-card {
    background: var(--bg2); border: 1px solid var(--border2);
    padding: 20px; text-align: center; position: relative; overflow: hidden;
    clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
  }
  .score-num {
    font-family: 'Orbitron', sans-serif;
    font-size: 64px; font-weight: 900; line-height: 1;
    background: linear-gradient(135deg, var(--green), var(--accent));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    filter: drop-shadow(0 0 20px var(--green));
  }
  .score-label { font-size: 10px; letter-spacing: 3px; color: var(--text3); margin: 6px 0; }
  .score-bar-bg { height: 4px; background: var(--border); border-radius: 2px; margin: 10px 0 4px; }
  .score-bar { height: 4px; background: linear-gradient(90deg, var(--green), var(--accent)); border-radius: 2px; transition: width 1.5s ease; box-shadow: 0 0 8px var(--green); }
  .score-tier { font-size: 10px; color: var(--green); letter-spacing: 1px; }

  /* TWO COL */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px; }

  /* SECTION TITLE */
  .section-title {
    font-size: 10px; letter-spacing: 3px; color: var(--accent);
    margin-bottom: 16px; display: flex; align-items: center; gap: 8px;
  }
  .section-title::after { content: ''; flex: 1; height: 1px; background: var(--border2); }

  /* TABLE */
  .findings-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .findings-table th {
    text-align: left; padding: 8px 12px;
    color: var(--text3); font-size: 10px; letter-spacing: 1px;
    border-bottom: 1px solid var(--border2); font-weight: normal;
  }
  .findings-table td { padding: 10px 12px; border-bottom: 1px solid rgba(26,37,64,0.5); }
  .findings-table tr:hover td { background: rgba(0,212,255,0.03); }

  .sev-badge {
    display: inline-block; padding: 2px 8px; font-size: 10px;
    letter-spacing: 1px; border-radius: 2px; font-weight: bold;
  }

  .status-badge {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 2px 8px; font-size: 10px; border-radius: 2px;
  }
  .status-dot { width: 5px; height: 5px; border-radius: 50%; }

  /* RESOURCE TYPE */
  .res-type {
    font-size: 10px; color: var(--text3); background: var(--bg3);
    padding: 2px 6px; border-radius: 2px; border: 1px solid var(--border);
  }

  /* TOOLTIP */
  .custom-tooltip {
    background: var(--bg2); border: 1px solid var(--border2);
    padding: 10px 14px; font-size: 11px;
  }

  /* ACTIVITY FEED */
  .feed-item {
    display: flex; gap: 12px; align-items: flex-start;
    padding: 10px 0; border-bottom: 1px solid var(--border);
    font-size: 12px;
  }
  .feed-icon { font-size: 16px; margin-top: 1px; }
  .feed-text { color: var(--text2); line-height: 1.5; }
  .feed-time { color: var(--text3); font-size: 10px; margin-top: 2px; }

  /* STATS ROW */
  .stat-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 12px; }
  .stat-key { color: var(--text3); }
  .stat-val { color: var(--text); font-family: 'Orbitron', sans-serif; font-size: 13px; }

  /* COMPLIANCE */
  .compliance-bar { margin-bottom: 14px; }
  .compliance-header { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 11px; }
  .compliance-name { color: var(--text2); }
  .compliance-pct  { color: var(--accent); font-family: 'Orbitron', sans-serif; font-size: 12px; }
  .bar-bg { height: 6px; background: var(--border); border-radius: 3px; }
  .bar-fill { height: 6px; border-radius: 3px; transition: width 1.5s ease; }

  /* TERMINAL */
  .terminal {
    background: var(--bg); border: 1px solid var(--border2);
    padding: 16px; font-size: 11px; line-height: 1.8;
    max-height: 200px; overflow-y: auto;
  }
  .terminal::-webkit-scrollbar { width: 4px; }
  .terminal::-webkit-scrollbar-thumb { background: var(--border2); }
  .t-green { color: var(--green); }
  .t-blue  { color: var(--accent); }
  .t-orange{ color: var(--orange); }
  .t-red   { color: var(--red); }
  .t-gray  { color: var(--text3); }
`;

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div style={{ color: "var(--accent)", marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>{p.name}: {p.value}{p.name === "mttr" ? " min" : ""}</div>
      ))}
    </div>
  );
}

export default function App() {
  const [tab, setTab]       = useState("overview");
  const [time, setTime]     = useState(new Date());
  const [score]             = useState(() => computeScore(FINDINGS));
  const [counter, setCounter] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (counter < score) {
      const t = setTimeout(() => setCounter(c => Math.min(c + 2, score)), 20);
      return () => clearTimeout(t);
    }
  }, [counter, score]);

  const remediated = FINDINGS.filter(f => f.status === "REMEDIATED").length;
  const open       = FINDINGS.filter(f => f.status === "OPEN").length;
  const critical   = FINDINGS.filter(f => f.severity === "CRITICAL").length;

  const severityDist = Object.entries(
    FINDINGS.reduce((a, f) => { a[f.severity] = (a[f.severity]||0)+1; return a; }, {})
  ).map(([name, value]) => ({ name, value }));

  const statusDist = [
    { name: "REMEDIATED", value: remediated, color: "#30d158" },
    { name: "OPEN",       value: open,       color: "#ff2d55"  },
  ];

  const mttrData = Object.entries(
    FINDINGS.filter(f => f.mttr).reduce((a, f) => {
      if (!a[f.severity]) a[f.severity] = { total: 0, count: 0 };
      a[f.severity].total += f.mttr; a[f.severity].count++;
      return a;
    }, {})
  ).map(([severity, { total, count }]) => ({
    severity, mttr: Math.round(total / count), fill: SEV_COLOR[severity]
  })).sort((a,b) => SEVERITY_W[b.severity] - SEVERITY_W[a.severity]);

  const trendData = [
    { day: "Mar 6",  findings: 2, remediated: 1 },
    { day: "Mar 7",  findings: 3, remediated: 2 },
    { day: "Mar 8",  findings: 1, remediated: 1 },
    { day: "Mar 9",  findings: 4, remediated: 3 },
    { day: "Mar 10", findings: 2, remediated: 2 },
    { day: "Mar 11", findings: 5, remediated: 4 },
    { day: "Mar 12", findings: FINDINGS.length, remediated },
  ];

  const compliance = [
    { name: "CIS AWS Benchmark",   pct: 87, color: "#00d4ff" },
    { name: "AWS Security Hub",    pct: 92, color: "#00ff88" },
    { name: "PCI-DSS",             pct: 78, color: "#ff9500" },
    { name: "SOC 2 Type II",       pct: 83, color: "#bf5af2" },
  ];

  const scoreColor = score >= 90 ? "#30d158" : score >= 70 ? "#ffd60a" : "#ff2d55";

  return (
    <>
      <style>{css}</style>
      <div className="scanline" />
      <div className="grid-bg" />
      <div className="app">

        {/* HEADER */}
        <div className="header">
          <span style={{ fontSize: 22 }}>🔐</span>
          <div>
            <div className="header-logo">CLOUD SECURITY PIPELINE</div>
            <div className="header-sub">AUTOMATED THREAT DETECTION & REMEDIATION // AWS ap-southeast-1</div>
          </div>
          <div className="header-right">
            <div className="live-badge"><div className="live-dot" />LIVE MONITORING</div>
            <div className="time">{time.toLocaleString()}</div>
          </div>
        </div>

        {/* TABS */}
        <div className="tabs">
          {[["overview","OVERVIEW"],["findings","FINDINGS"],["mttr","MTTR ANALYSIS"],["compliance","COMPLIANCE"],["audit","AUDIT LOG"]].map(([k,l]) => (
            <button key={k} className={`tab ${tab===k?"active":""}`} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        <div className="main">

          {/* ── OVERVIEW ── */}
          {tab === "overview" && (
            <>
              <div className="kpi-grid">
                {/* Score */}
                <div className="score-card">
                  <div className="card-label">CLOUD SECURE SCORE</div>
                  <div className="score-num">{counter}</div>
                  <div className="score-label">/ 100</div>
                  <div className="score-bar-bg">
                    <div className="score-bar" style={{ width: `${counter}%`, background: `linear-gradient(90deg, ${scoreColor}, var(--accent))`, boxShadow: `0 0 8px ${scoreColor}` }} />
                  </div>
                  <div className="score-tier" style={{ color: scoreColor }}>
                    {score >= 90 ? "★ EXCELLENT" : score >= 70 ? "▲ GOOD" : "⚠ NEEDS ATTENTION"}
                  </div>
                </div>

                {[
                  { label: "TOTAL FINDINGS",   value: FINDINGS.length, color: "var(--accent)" },
                  { label: "REMEDIATED",        value: remediated,      color: "var(--green)"  },
                  { label: "OPEN",              value: open,            color: "var(--red)"    },
                  { label: "CRITICAL",          value: critical,        color: "#ff2d55"       },
                ].map(({ label, value, color }) => (
                  <div key={label} className="card">
                    <div className="card-label">{label}</div>
                    <div className="card-value" style={{ color, textShadow: `0 0 20px ${color}` }}>{value}</div>
                    <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 8 }}>
                      {label === "TOTAL FINDINGS"  && `ACCOUNT 951510214540`}
                      {label === "REMEDIATED"      && `${Math.round(remediated/FINDINGS.length*100)}% RESOLUTION RATE`}
                      {label === "OPEN"            && `REQUIRES ATTENTION`}
                      {label === "CRITICAL"        && `HIGHEST PRIORITY`}
                    </div>
                  </div>
                ))}
              </div>

              <div className="two-col">
                {/* Trend */}
                <div className="card">
                  <div className="section-title">WEEKLY TREND</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="gf" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ff2d55" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#ff2d55" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00ff88" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#00ff88" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="day" stroke="var(--text3)" tick={{ fontSize: 10 }} />
                      <YAxis stroke="var(--text3)" tick={{ fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="findings"   stroke="#ff2d55" fill="url(#gf)" strokeWidth={2} name="findings" />
                      <Area type="monotone" dataKey="remediated" stroke="#00ff88" fill="url(#gr)" strokeWidth={2} name="remediated" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Severity pie */}
                <div className="card">
                  <div className="section-title">SEVERITY DISTRIBUTION</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={severityDist} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                        {severityDist.map((e) => (
                          <Cell key={e.name} fill={SEV_COLOR[e.name]} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Activity feed */}
              <div className="card">
                <div className="section-title">RECENT ACTIVITY</div>
                {FINDINGS.slice(0, 5).map(f => (
                  <div key={f.event_id} className="feed-item">
                    <div className="feed-icon">{f.status === "REMEDIATED" ? "✅" : "🔴"}</div>
                    <div style={{ flex: 1 }}>
                      <div className="feed-text">
                        <span style={{ color: SEV_COLOR[f.severity] }}>[{f.severity}]</span>{" "}
                        <span style={{ color: "var(--text)" }}>{f.description}</span>{" "}
                        <span className="res-type">{f.resource_type}</span>
                      </div>
                      <div className="feed-time">
                        {f.resource_id} · {f.ts}{f.approver ? ` · approved by ${f.approver}` : ""}
                      </div>
                    </div>
                    <div>
                      <span className="status-badge" style={{
                        background: f.status === "REMEDIATED" ? "rgba(48,209,88,0.1)" : "rgba(255,45,85,0.1)",
                        border: `1px solid ${f.status === "REMEDIATED" ? "#30d15833" : "#ff2d5533"}`
                      }}>
                        <span className="status-dot" style={{ background: f.status === "REMEDIATED" ? "#30d158" : "#ff2d55" }} />
                        <span style={{ color: f.status === "REMEDIATED" ? "#30d158" : "#ff2d55", fontSize: 10 }}>{f.status}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── FINDINGS ── */}
          {tab === "findings" && (
            <div className="card">
              <div className="section-title">ALL FINDINGS — {FINDINGS.length} TOTAL</div>
              <table className="findings-table">
                <thead>
                  <tr>
                    {["CHECK ID","SEVERITY","RESOURCE TYPE","RESOURCE ID","DESCRIPTION","STATUS","APPROVER","TIME"].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FINDINGS.map(f => (
                    <tr key={f.event_id}>
                      <td style={{ color: "var(--accent)", fontFamily: "monospace" }}>{f.check_id}</td>
                      <td>
                        <span className="sev-badge" style={{
                          color: SEV_COLOR[f.severity],
                          background: SEV_COLOR[f.severity] + "22",
                          border: `1px solid ${SEV_COLOR[f.severity]}44`,
                          boxShadow: SEV_GLOW[f.severity]
                        }}>{f.severity}</span>
                      </td>
                      <td><span className="res-type">{f.resource_type}</span></td>
                      <td style={{ color: "var(--text2)", fontSize: 11 }}>{f.resource_id}</td>
                      <td style={{ color: "var(--text2)" }}>{f.description}</td>
                      <td>
                        <span className="status-badge" style={{
                          background: f.status === "REMEDIATED" ? "rgba(48,209,88,0.1)" : "rgba(255,45,85,0.1)",
                          border: `1px solid ${f.status === "REMEDIATED" ? "#30d15833" : "#ff2d5533"}`
                        }}>
                          <span className="status-dot" style={{ background: f.status === "REMEDIATED" ? "#30d158" : "#ff2d55" }} />
                          <span style={{ color: f.status === "REMEDIATED" ? "#30d158" : "#ff2d55", fontSize: 10 }}>{f.status}</span>
                        </span>
                      </td>
                      <td style={{ color: "var(--text3)" }}>{f.approver || "—"}</td>
                      <td style={{ color: "var(--text3)", fontSize: 11 }}>{f.ts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── MTTR ── */}
          {tab === "mttr" && (
            <>
              <div className="three-col">
                {[
                  { label: "AVG MTTR (ALL)",      value: `${Math.round(FINDINGS.filter(f=>f.mttr).reduce((s,f)=>s+f.mttr,0)/FINDINGS.filter(f=>f.mttr).length)} MIN`, color: "var(--accent)" },
                  { label: "FASTEST REMEDIATION", value: `${Math.min(...FINDINGS.filter(f=>f.mttr).map(f=>f.mttr))} MIN`, color: "var(--green)" },
                  { label: "SLOWEST REMEDIATION", value: `${Math.max(...FINDINGS.filter(f=>f.mttr).map(f=>f.mttr))} MIN`, color: "var(--red)" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="card">
                    <div className="card-label">{label}</div>
                    <div style={{ fontFamily: "Orbitron", fontSize: 32, color, textShadow: `0 0 15px ${color}`, fontWeight: 700 }}>{value}</div>
                  </div>
                ))}
              </div>
              <div className="two-col">
                <div className="card">
                  <div className="section-title">MTTR BY SEVERITY (MINUTES)</div>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={mttrData} barSize={40}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="severity" stroke="var(--text3)" tick={{ fontSize: 11 }} />
                      <YAxis stroke="var(--text3)" tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="mttr" name="mttr" radius={[4,4,0,0]}>
                        {mttrData.map((e, i) => (
                          <Cell key={i} fill={e.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="card">
                  <div className="section-title">REMEDIATION BREAKDOWN</div>
                  {FINDINGS.filter(f=>f.mttr).map(f => (
                    <div key={f.event_id} style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11 }}>
                        <span style={{ color: "var(--text2)" }}>{f.event_id.split("/").pop()}</span>
                        <span style={{ color: SEV_COLOR[f.severity], fontFamily: "Orbitron", fontSize: 11 }}>{f.mttr} min</span>
                      </div>
                      <div className="bar-bg">
                        <div className="bar-fill" style={{
                          width: `${Math.min(f.mttr/135*100, 100)}%`,
                          background: SEV_COLOR[f.severity],
                          boxShadow: `0 0 6px ${SEV_COLOR[f.severity]}`
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── COMPLIANCE ── */}
          {tab === "compliance" && (
            <div className="two-col">
              <div className="card">
                <div className="section-title">FRAMEWORK COMPLIANCE</div>
                {compliance.map(c => (
                  <div key={c.name} className="compliance-bar">
                    <div className="compliance-header">
                      <span className="compliance-name">{c.name}</span>
                      <span className="compliance-pct" style={{ color: c.color }}>{c.pct}%</span>
                    </div>
                    <div className="bar-bg">
                      <div className="bar-fill" style={{ width: `${c.pct}%`, background: c.color, boxShadow: `0 0 8px ${c.color}` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="card">
                <div className="section-title">REMEDIATION STATS</div>
                {[
                  { k: "Total Checks Run",       v: "44" },
                  { k: "Passed",                 v: "37" },
                  { k: "Failed",                 v: "7"  },
                  { k: "Auto-Remediated",        v: `${remediated}` },
                  { k: "Human Approvals",        v: `${remediated}` },
                  { k: "Approver",               v: "kanthiphs" },
                  { k: "AWS Account",            v: "951510214540" },
                  { k: "Region",                 v: "ap-southeast-1" },
                  { k: "Scan Tool",              v: "Prowler 3.11.3" },
                  { k: "IaC Scanner",            v: "Checkov 3.2.508" },
                ].map(({ k, v }) => (
                  <div key={k} className="stat-row">
                    <span className="stat-key">{k}</span>
                    <span className="stat-val" style={{ fontSize: 11 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── AUDIT LOG ── */}
          {tab === "audit" && (
            <div className="card">
              <div className="section-title">AUDIT TERMINAL — REMEDIATION LOG</div>
              <div className="terminal">
                <div><span className="t-gray">[2026-03-11 20:46:12]</span> <span className="t-blue">FINDING_DETECTED</span> <span className="t-orange">HIGH</span> sg-0ad3fe56d4ed62eb0 :: SSH open to 0.0.0.0/0 [CKV_AWS_24]</div>
                <div><span className="t-gray">[2026-03-11 20:46:13]</span> <span className="t-blue">SLACK_NOTIFIED</span>   Approval request sent to #all-cloud-security-pipeline</div>
                <div><span className="t-gray">[2026-03-11 20:46:20]</span> <span className="t-green">APPROVED</span>        kanthiphs approved remediation via Slack</div>
                <div><span className="t-gray">[2026-03-11 20:46:22]</span> <span className="t-green">REMEDIATED</span>      revoke_security_group_ingress sg-0ad3fe56d4ed62eb0 IpPermissions=[]</div>
                <div><span className="t-gray">[2026-03-11 20:53:14]</span> <span className="t-red">FINDING_DETECTED</span>  <span className="t-red">CRITICAL</span> vulnerable-lab-role :: IAM wildcard [CKV_AWS_40]</div>
                <div><span className="t-gray">[2026-03-11 20:53:15]</span> <span className="t-blue">SLACK_NOTIFIED</span>   Approval request sent to #all-cloud-security-pipeline</div>
                <div><span className="t-gray">[2026-03-11 20:53:22]</span> <span className="t-green">APPROVED</span>        kanthiphs approved remediation via Slack</div>
                <div><span className="t-gray">[2026-03-11 20:53:25]</span> <span className="t-green">REMEDIATED</span>      put_role_policy Effect=Deny Action=* Resource=* [wildcard removed]</div>
                <div><span className="t-gray">[2026-03-12 14:59:43]</span> <span className="t-blue">FINDING_DETECTED</span> <span className="t-orange">HIGH</span> vulnerable-lab-bucket-9811f340 :: S3 public access [CKV_AWS_53]</div>
                <div><span className="t-gray">[2026-03-12 14:59:44]</span> <span className="t-blue">SLACK_NOTIFIED</span>   Approval request sent to #all-cloud-security-pipeline</div>
                <div><span className="t-gray">[2026-03-12 14:59:52]</span> <span className="t-green">APPROVED</span>        kanthiphs approved remediation via Slack</div>
                <div><span className="t-gray">[2026-03-12 14:59:53]</span> <span className="t-green">REMEDIATED</span>      put_public_access_block BlockPublicAcls=true IgnorePublicAcls=true BlockPublicPolicy=true RestrictPublicBuckets=true</div>
                <div><span className="t-gray">[2026-03-12 15:10:00]</span> <span className="t-orange">FINDING_OPEN</span>   <span className="t-yellow">MEDIUM</span> sg-abc123 :: RDP open to 0.0.0.0/0 [CKV_AWS_25] — AWAITING APPROVAL</div>
                <div><span className="t-gray">[2026-03-12 15:10:01]</span> <span className="t-orange">FINDING_OPEN</span>   <span className="t-green">LOW</span>    i-0a69fd8c556b5d0d1 :: EC2 IMDSv1 [CKV_AWS_79] — AWAITING APPROVAL</div>
                <div><span className="t-green">█</span> <span className="t-gray">SYSTEM READY — MONITORING ACTIVE</span></div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
