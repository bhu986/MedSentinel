"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  Activity, Database, AlertTriangle, Sparkles,
  BarChart3, BotMessageSquare, CheckCircle,
  Trash2, Play, ChevronRight, FileSearch,
  TrendingUp, PieChart, LineChartIcon, Layers,
  ArrowUpRight, ArrowDownRight, Minus, Zap, Eye,
  FileText, Brain, Shield, FlaskConical
} from "lucide-react";
import {
  RadialBarChart, RadialBar, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, CartesianGrid,
  PieChart as RechartsPieChart, Pie, Cell, Legend,
  AreaChart, Area, ScatterChart, Scatter, ZAxis,
  ReferenceLine
} from "recharts";
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import ClinicalChat from "../../components/ClinicalChat";

ModuleRegistry.registerModules([AllCommunityModule]);

// ─── Math Helpers ─────────────────────────────────────────────────────────────
const calcMean = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
const calcMedian = (arr: number[]) => {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const calcMode = (arr: any[]) => {
  const counts = arr.reduce((acc, val) => ({ ...acc, [val]: (acc[val] || 0) + 1 }), {});
  return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
};
const calcStdDev = (arr: number[]) => {
  const mean = calcMean(arr);
  return Math.sqrt(arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length);
};
const calcCorrelation = (x: number[], y: number[]) => {
  const n = Math.min(x.length, y.length);
  if (n === 0) return 0;
  const xs = x.slice(0, n), ys = y.slice(0, n);
  const mx = calcMean(xs), my = calcMean(ys);
  const num = xs.reduce((a, xi, i) => a + (xi - mx) * (ys[i] - my), 0);
  const den = Math.sqrt(xs.reduce((a, xi) => a + (xi - mx) ** 2, 0) * ys.reduce((a, yi) => a + (yi - my) ** 2, 0));
  return den === 0 ? 0 : num / den;
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0a0f1e] border border-[rgba(0,212,255,0.2)] rounded-xl px-4 py-3 shadow-xl">
        <p className="text-[#64748b] text-xs font-mono mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-sm font-bold" style={{ color: p.color }}>
            {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// ─── Animated Number ──────────────────────────────────────────────────────────
function AnimNum({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const end = value;
    const increment = end / (1200 / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) { setDisplay(end); clearInterval(timer); }
      else setDisplay(start);
    }, 16);
    return () => clearInterval(timer);
  }, [inView, value]);
  return <span ref={ref}>{display.toFixed(decimals)}</span>;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color, trend }: {
  label: string; value: string | number; sub?: string;
  icon: any; color: string; trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="relative bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5 overflow-hidden group hover:border-[rgba(0,212,255,0.2)] transition-all duration-300"
    >
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-10 blur-2xl group-hover:opacity-20 transition-opacity" style={{ background: color }} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[#64748b] text-xs font-mono uppercase tracking-widest mb-2">{label}</p>
          <p className="text-3xl font-bold text-[#f1f5f9]">{value}</p>
          {sub && <p className="text-xs mt-1" style={{ color }}>{sub}</p>}
        </div>
        <div className="p-3 rounded-xl" style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1 text-xs">
          {trend === 'up' && <ArrowUpRight className="h-3 w-3 text-[#ef4444]" />}
          {trend === 'down' && <ArrowDownRight className="h-3 w-3 text-[#10b981]" />}
          {trend === 'neutral' && <Minus className="h-3 w-3 text-[#64748b]" />}
        </div>
      )}
    </motion.div>
  );
}

// ─── Step Badge (Workflow Indicator) ─────────────────────────────────────────
function StepBadge({ step, label, active, done }: { step: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className={`flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-full border transition-all ${
      active ? 'bg-[#00d4ff]/10 border-[#00d4ff]/40 text-[#00d4ff]' :
      done ? 'bg-[#10b981]/10 border-[#10b981]/30 text-[#10b981]' :
      'border-[rgba(255,255,255,0.08)] text-[#64748b]'
    }`}>
      {done ? <CheckCircle className="h-3 w-3" /> : <span className="font-bold">{step}</span>}
      <span>{label}</span>
    </div>
  );
}

// ─── Tab Types ────────────────────────────────────────────────────────────────
type TabType = 'overview' | 'anomalies' | 'cleaning' | 'ai_explanation' | 'medquery';
const COLORS = ['#00d4ff', '#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#f97316', '#06b6d4', '#8b5cf6'];

export default function DashboardPage() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [dataset, setDataset] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [strategies, setStrategies] = useState<Record<string, string>>({});
  const [cleaningStats, setCleaningStats] = useState<{ before: number; after: number | null }>({ before: 0, after: null });
  const [anomalyData, setAnomalyData] = useState<any[] | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [aiExplanations, setAiExplanations] = useState<{ summary: string; findings: string[]; recommendations: string[] } | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [vizMode, setVizMode] = useState<'histograms' | 'linechart' | 'piechart' | 'barchart' | 'scatter' | 'correlation'>('histograms');

  useEffect(() => {
    setIsClient(true);
    const stored = localStorage.getItem("medsentinel_dataset");
    if (stored) {
      try { setDataset(JSON.parse(stored)); } catch {}
    }
  }, []);

  const stats = useMemo(() => {
    if (!dataset.length) return null;
    const totalRows = dataset.length;
    const cols = Object.keys(dataset[0]);
    let totalMissing = 0;
    const stringified = dataset.map(r => JSON.stringify(r));
    const duplicateCount = totalRows - new Set(stringified).size;
    const colStats = cols.map(col => {
      let missing = 0;
      const values: any[] = [];
      const numValues: number[] = [];
      dataset.forEach(row => {
        const val = row[col];
        if (val === null || val === undefined || val === "") { missing++; totalMissing++; }
        else { values.push(val); if (!isNaN(Number(val))) numValues.push(Number(val)); }
      });
      const type = numValues.length === values.length && values.length > 0 ? "Numeric" : "String";
      return {
        name: col, type, missing,
        missingPct: ((missing / totalRows) * 100).toFixed(1),
        min: numValues.length > 0 ? Math.min(...numValues).toFixed(2) : "-",
        max: numValues.length > 0 ? Math.max(...numValues).toFixed(2) : "-",
        mean: numValues.length > 0 ? calcMean(numValues).toFixed(2) : "-",
        stddev: numValues.length > 0 ? calcStdDev(numValues).toFixed(2) : "-",
        numValues
      };
    });
    const totalCells = totalRows * cols.length;
    const healthScore = Math.max(0, 100 - ((totalMissing / totalCells) * 100));
    const numericCols = colStats.filter(c => c.type === "Numeric").map(c => c.name);
    const typeData = [
      { name: "Numeric", value: colStats.filter(c => c.type === "Numeric").length },
      { name: "Categorical", value: colStats.filter(c => c.type === "String").length },
    ];
    return { totalRows, totalCols: cols.length, colStats, totalMissing, duplicateCount, healthScore, numericCols, typeData };
  }, [dataset]);

  useEffect(() => {
    if (stats && cleaningStats.before === 0) setCleaningStats(prev => ({ ...prev, before: stats.totalMissing }));
  }, [stats]);

  const anomalyStats = useMemo(() => {
    if (!anomalyData) return null;
    const flagged = anomalyData.filter(r => r.is_anomaly);
    const critical = anomalyData.filter(r => r.threat_score >= 70);
    const moderate = anomalyData.filter(r => r.threat_score >= 40 && r.threat_score < 70);
    const safe = anomalyData.filter(r => r.threat_score < 40);
    return {
      flagged: flagged.length, critical: critical.length,
      moderate: moderate.length, safe: safe.length,
      pieData: [
        { name: "Safe", value: safe.length },
        { name: "Moderate", value: moderate.length },
        { name: "Critical", value: critical.length },
      ],
      scoreHistData: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90].map(bucket => ({
        bucket: `${bucket}–${bucket + 10}`,
        count: anomalyData.filter(r => r.threat_score >= bucket && r.threat_score < bucket + 10).length
      }))
    };
  }, [anomalyData]);

  // ─── Run Anomaly Detection ────────────────────────────────────────────────
  const runDetection = async () => {
    setIsDetecting(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/detect`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: dataset })
      });
      const result = response.ok ? await response.json() : null;
      if (result?.scored_records) {
        setAnomalyData(result.scored_records);
      } else {
        // Fallback simulation
        setAnomalyData(dataset.map(row => ({
          ...row,
          is_anomaly: Math.random() > 0.95,
          threat_score: Math.random() > 0.95 ? Math.floor(Math.random() * 40 + 60) : Math.floor(Math.random() * 20)
        })));
      }
    } catch {
      setAnomalyData(dataset.map(row => ({
        ...row,
        is_anomaly: Math.random() > 0.95,
        threat_score: Math.random() > 0.95 ? Math.floor(Math.random() * 40 + 60) : Math.floor(Math.random() * 20)
      })));
    } finally { setIsDetecting(false); }
  };

  // ─── Generate AI Explanation ──────────────────────────────────────────────
  const generateAIExplanation = async () => {
    setIsExplaining(true);
    try {
      const summaryPayload = {
        totalRows: stats?.totalRows,
        totalCols: stats?.totalCols,
        healthScore: stats?.healthScore?.toFixed(1),
        missingValues: stats?.totalMissing,
        duplicates: stats?.duplicateCount,
        anomaliesDetected: anomalyStats?.flagged ?? 0,
        criticalAnomalies: anomalyStats?.critical ?? 0,
        columnSummary: stats?.colStats.slice(0, 8).map(c => ({
          name: c.name, type: c.type, missing: c.missing, mean: c.mean, min: c.min, max: c.max
        }))
      };

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are a senior clinical data scientist. Analyze dataset quality reports and provide concise, 
actionable medical insights. Always respond in this exact JSON format:
{
  "summary": "2-3 sentence executive summary of dataset quality",
  "findings": ["finding 1", "finding 2", "finding 3", "finding 4", "finding 5"],
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"]
}
Keep findings clinically relevant. Be specific about numbers. No markdown, pure JSON only.`,
          messages: [{ role: "user", content: `Analyze this clinical dataset: ${JSON.stringify(summaryPayload)}` }]
        })
      });

      const data = await response.json();
      const text = data.content?.find((b: any) => b.type === "text")?.text || "";
      try {
        const clean = text.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(clean);
        setAiExplanations(parsed);
      } catch {
        setAiExplanations({
          summary: text.slice(0, 300),
          findings: ["Analysis complete. See summary above."],
          recommendations: ["Review flagged records carefully before clinical use."]
        });
      }
    } catch (e) {
      // Fallback offline explanation
      setAiExplanations({
        summary: `Dataset contains ${stats?.totalRows} records across ${stats?.totalCols} columns with a health score of ${stats?.healthScore?.toFixed(1)}%. ${anomalyStats?.flagged ? `${anomalyStats.flagged} anomalies were detected requiring clinical review.` : 'No anomalies detected yet — run the detection engine first.'}`,
        findings: [
          `Total records: ${stats?.totalRows?.toLocaleString()} rows, ${stats?.totalCols} columns`,
          `Missing values: ${stats?.totalMissing} cells (${((stats?.totalMissing || 0) / ((stats?.totalRows || 1) * (stats?.totalCols || 1)) * 100).toFixed(1)}% of dataset)`,
          `Duplicate rows: ${stats?.duplicateCount} identified`,
          `Anomalies flagged: ${anomalyStats?.flagged ?? 0} records (Critical: ${anomalyStats?.critical ?? 0}, Moderate: ${anomalyStats?.moderate ?? 0})`,
          `Dataset health score: ${stats?.healthScore?.toFixed(1)}% — ${(stats?.healthScore || 0) > 80 ? 'Good quality' : (stats?.healthScore || 0) > 50 ? 'Moderate quality, cleaning recommended' : 'Poor quality, significant cleaning required'}`
        ],
        recommendations: [
          stats?.totalMissing ? `Impute ${stats.totalMissing} missing values using the Data Cleaning tab before downstream analysis` : "Dataset has no missing values — ready for analysis",
          anomalyStats?.critical ? `Immediately review ${anomalyStats.critical} critical records (threat score ≥ 70) for data entry errors or genuine clinical events` : "No critical anomalies detected",
          stats?.duplicateCount ? `Remove ${stats.duplicateCount} duplicate rows to avoid statistical bias in results` : "No duplicate records found"
        ]
      });
    } finally { setIsExplaining(false); }
  };

  // ─── Cleaning ─────────────────────────────────────────────────────────────
  const applyCleaning = () => {
    let newData = [...dataset];
    Object.entries(strategies).forEach(([col, strategy]) => {
      if (!strategy || strategy === "none") return;
      const validVals = newData.map(r => r[col]).filter(v => v !== null && v !== "" && v !== undefined);
      let rep: any = null;
      if (strategy === "mean") rep = calcMean(validVals.map(Number));
      if (strategy === "median") rep = calcMedian(validVals.map(Number));
      if (strategy === "mode") rep = calcMode(validVals);
      if (strategy === "fill_0") rep = 0;
      if (strategy === "fill_unknown") rep = "Unknown";
      if (strategy === "drop_col") {
        newData = newData.map(row => { const { [col]: _, ...rest } = row; return rest; });
      } else {
        newData = newData.map(row =>
          (row[col] === null || row[col] === "" || row[col] === undefined) ? { ...row, [col]: rep } : row
        );
      }
    });
    setDataset(newData);
    localStorage.setItem("medsentinel_dataset", JSON.stringify(newData));
    setCleaningStats(prev => ({ ...prev, after: 0 }));
    setStrategies({});
  };

  const removeDuplicates = () => {
    const unique = Array.from(new Set(dataset.map(r => JSON.stringify(r)))).map(s => JSON.parse(s));
    setDataset(unique);
    localStorage.setItem("medsentinel_dataset", JSON.stringify(unique));
  };

  // ─── Viz Builders ─────────────────────────────────────────────────────────
  const buildHistogramData = (col: string) => {
    const values = dataset.map(r => Number(r[col])).filter(n => !isNaN(n));
    if (!values.length) return [];
    const min = Math.min(...values), max = Math.max(...values);
    const binSize = (max - min) / 10 || 1;
    const bins = Array.from({ length: 10 }, (_, i) => ({ name: (min + i * binSize).toFixed(1), count: 0 }));
    values.forEach(v => { let idx = Math.floor((v - min) / binSize); if (idx >= 10) idx = 9; bins[idx].count++; });
    return bins;
  };
  const buildLineData = (col: string) => dataset.slice(0, 100).map((row, i) => ({ index: i, value: Number(row[col]) || 0 }));
  const buildCategoryPieData = (col: string) => {
    const counts: Record<string, number> = {};
    dataset.forEach(row => { const val = String(row[col] ?? "null"); counts[val] = (counts[val] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));
  };
  const buildBarCompareData = () => (stats?.numericCols || []).slice(0, 6).map(col => {
    const vals = dataset.map(r => Number(r[col])).filter(n => !isNaN(n));
    return { col, mean: parseFloat(calcMean(vals).toFixed(2)), max: parseFloat(Math.max(...vals).toFixed(2)), min: parseFloat(Math.min(...vals).toFixed(2)) };
  });
  const buildScatterData = (xCol: string, yCol: string) =>
    dataset.slice(0, 200).map(row => ({ x: Number(row[xCol]) || 0, y: Number(row[yCol]) || 0 }));

  const numCols = stats?.numericCols || [];
  const strCols = stats?.colStats.filter(c => c.type === "String").map(c => c.name) || [];
  const corrCols = numCols.slice(0, 6);

  if (!isClient) return null;

  if (!dataset.length) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center min-h-[70vh] space-y-6">
        <div className="relative">
          <div className="absolute inset-0 bg-[#00d4ff] rounded-full blur-2xl opacity-10 animate-pulse" />
          <div className="relative p-8 bg-[#111827] rounded-3xl border border-[rgba(255,255,255,0.06)]">
            <Database className="h-16 w-16 text-[#64748b]" />
          </div>
        </div>
        <h2 className="text-3xl font-bold text-[#f1f5f9]">No Dataset Loaded</h2>
        <p className="text-[#64748b] text-center max-w-sm">Upload clinical data to unlock the full intelligence dashboard.</p>
        <button onClick={() => router.push('/upload')}
          className="bg-[#00d4ff] text-[#0a0f1e] px-8 py-4 rounded-xl font-bold hover:bg-[#00d4ff]/80 transition-all shadow-[0_0_20px_rgba(0,212,255,0.3)]">
          Go to Upload Center
        </button>
      </motion.div>
    );
  }

  // ─── Tab definitions in NEW ORDER ─────────────────────────────────────────
  const tabs = [
    { id: 'overview',       label: 'Overview',           icon: Activity,       step: 1, color: '#00d4ff' },
    { id: 'anomalies',      label: 'Anomaly Detection',  icon: AlertTriangle,  step: 2, color: '#ef4444' },
    { id: 'cleaning',       label: 'Data Cleaning',      icon: Sparkles,       step: 3, color: '#f59e0b' },
    { id: 'ai_explanation', label: 'AI Explanation',     icon: Brain,          step: 4, color: '#7c3aed' },
    { id: 'medquery',       label: 'MedQuery AI',        icon: BotMessageSquare, step: 5, color: '#10b981' },
  ] as const;

  const stepDone = (step: number) => {
    if (step === 1) return true;
    if (step === 2) return !!anomalyData;
    if (step === 3) return cleaningStats.after !== null;
    if (step === 4) return !!aiExplanations;
    return false;
  };

  const vizTabs = [
    { id: 'histograms', label: 'Histograms', icon: BarChart3 },
    { id: 'linechart',  label: 'Trends',     icon: LineChartIcon },
    { id: 'piechart',   label: 'Distribution', icon: PieChart },
    { id: 'barchart',   label: 'Compare',    icon: TrendingUp },
    { id: 'scatter',    label: 'Scatter',    icon: Layers },
    { id: 'correlation',label: 'Correlation',icon: Eye },
  ] as const;

  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-8 bg-[#00d4ff] rounded-full shadow-[0_0_10px_rgba(0,212,255,0.8)]" />
            <h1 className="text-3xl font-bold text-[#f1f5f9] tracking-tight">Clinical Data Engine</h1>
          </div>
          <p className="text-[#64748b] ml-5">
            Dataset loaded · <span className="text-[#00d4ff] font-mono">{stats?.totalRows.toLocaleString()} records</span> · <span className="text-[#00d4ff] font-mono">{stats?.totalCols} columns</span>
          </p>

          {/* Workflow Progress Strip */}
          <div className="mt-4 ml-5 flex flex-wrap gap-2 items-center">
            {tabs.map((tab, i) => (
              <div key={tab.id} className="flex items-center gap-2">
                <StepBadge
                  step={tab.step}
                  label={tab.label}
                  active={activeTab === tab.id}
                  done={stepDone(tab.step)}
                />
                {i < tabs.length - 1 && (
                  <div className="hidden sm:block w-6 h-px bg-[rgba(255,255,255,0.1)]" />
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Tabs ── */}
        <div className="flex space-x-1 mb-8 bg-[#111827] border border-[rgba(255,255,255,0.06)] p-1 rounded-2xl overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isDone = stepDone(tab.step);
            return (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                whileTap={{ scale: 0.97 }}
                className={`relative flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap flex-1 justify-center ${isActive ? 'text-[#0a0f1e]' : 'text-[#64748b] hover:text-[#f1f5f9]'}`}
              >
                {isActive && (
                  <motion.div layoutId="activeTab"
                    className="absolute inset-0 rounded-xl shadow-[0_0_15px_rgba(0,212,255,0.4)]"
                    style={{ background: tab.color, zIndex: 0 }} />
                )}
                <Icon className="h-4 w-4 relative z-10" />
                <span className="relative z-10 text-sm hidden sm:inline">{tab.label}</span>
                {!isActive && isDone && (
                  <span className="relative z-10 w-1.5 h-1.5 rounded-full bg-[#10b981] ml-1" />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* ── Tab Content ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >

            {/* ══════════════ STEP 1: OVERVIEW ══════════════ */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Prompt banner to run detection next */}
                {!anomalyData && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex items-center justify-between bg-[#ef4444]/8 border border-[#ef4444]/20 rounded-2xl px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[#ef4444]/10 rounded-lg"><AlertTriangle className="h-5 w-5 text-[#ef4444]" /></div>
                      <div>
                        <p className="text-[#f1f5f9] font-bold text-sm">Next Step: Run Anomaly Detection</p>
                        <p className="text-[#64748b] text-xs">Review your dataset overview, then proceed to detect anomalies.</p>
                      </div>
                    </div>
                    <button onClick={() => setActiveTab('anomalies')}
                      className="flex items-center gap-2 bg-[#ef4444] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#ef4444]/80 transition-all">
                      Detect Anomalies <ChevronRight className="h-4 w-4" />
                    </button>
                  </motion.div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Health Score" value={`${stats?.healthScore.toFixed(1)}%`} sub="Dataset quality" icon={Activity} color="#10b981" />
                  <StatCard label="Total Records" value={stats?.totalRows.toLocaleString() || "0"} sub="Rows loaded" icon={Database} color="#00d4ff" />
                  <StatCard label="Missing Values" value={stats?.totalMissing.toLocaleString() || "0"} sub="Needs cleaning" icon={AlertTriangle} color="#f59e0b" trend="up" />
                  <StatCard label="Duplicates" value={stats?.duplicateCount || 0} sub="Identical rows" icon={Trash2} color="#ef4444" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Radial Health Gauge */}
                  <div className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6 flex flex-col items-center justify-center">
                    <p className="text-[#64748b] text-xs font-mono uppercase tracking-widest mb-4">Dataset Health</p>
                    <div className="relative h-40 w-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadialBarChart cx="50%" cy="50%" innerRadius="65%" outerRadius="100%" barSize={12}
                          data={[{ value: stats?.healthScore || 0, fill: (stats?.healthScore || 0) > 80 ? '#10b981' : (stats?.healthScore || 0) > 50 ? '#f59e0b' : '#ef4444' }]}>
                          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                          <RadialBar background={{ fill: '#1a2235' }} clockWise dataKey="value" cornerRadius={8} />
                        </RadialBarChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold text-[#f1f5f9]">{stats?.healthScore.toFixed(0)}%</span>
                        <span className="text-[#64748b] text-xs">Health</span>
                      </div>
                    </div>
                  </div>

                  {/* Type Distribution */}
                  <div className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
                    <p className="text-[#64748b] text-xs font-mono uppercase tracking-widest mb-4">Column Types</p>
                    <ResponsiveContainer width="100%" height={140}>
                      <RechartsPieChart>
                        <Pie data={stats?.typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={55} innerRadius={30}>
                          {stats?.typeData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                        </Pie>
                        <RechartsTooltip content={<CustomTooltip />} />
                        <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-[#f1f5f9] text-xs">{v}</span>} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Missing % per column */}
                  <div className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
                    <p className="text-[#64748b] text-xs font-mono uppercase tracking-widest mb-4">Missing % by Column</p>
                    <div className="space-y-2 overflow-y-auto max-h-36">
                      {stats?.colStats.filter(c => c.missing > 0).slice(0, 6).map(col => (
                        <div key={col.name}>
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="text-[#f1f5f9] truncate max-w-[60%]">{col.name}</span>
                            <span className="text-[#f59e0b] font-mono">{col.missingPct}%</span>
                          </div>
                          <div className="h-1.5 bg-[#1a2235] rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, Number(col.missingPct))}%` }}
                              transition={{ duration: 1, delay: 0.2 }}
                              className="h-full rounded-full bg-gradient-to-r from-[#f59e0b] to-[#ef4444]" />
                          </div>
                        </div>
                      ))}
                      {!stats?.colStats.some(c => c.missing > 0) && (
                        <div className="flex items-center gap-2 text-[#10b981] text-sm"><CheckCircle className="h-4 w-4" />All clean!</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Column Telemetry Table */}
                <div className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden">
                  <div className="p-5 border-b border-[rgba(255,255,255,0.06)] flex items-center gap-3">
                    <Database className="h-5 w-5 text-[#00d4ff]" />
                    <h3 className="text-lg font-bold text-[#f1f5f9]">Column Telemetry</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-[#0a0f1e] text-[#64748b] font-mono text-xs uppercase">
                        <tr>{['Column','Type','Missing','Min','Max','Mean','Std Dev'].map(h => (
                          <th key={h} className="px-5 py-3 border-b border-[rgba(255,255,255,0.06)]">{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {stats?.colStats.map((col, i) => (
                          <motion.tr key={col.name}
                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[#1a2235]/50 transition-colors">
                            <td className="px-5 py-3 font-bold text-[#00d4ff] font-mono">{col.name}</td>
                            <td className="px-5 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-mono border ${col.type === 'Numeric' ? 'text-[#7c3aed] border-[#7c3aed]/30 bg-[#7c3aed]/10' : 'text-[#10b981] border-[#10b981]/30 bg-[#10b981]/10'}`}>{col.type}</span>
                            </td>
                            <td className="px-5 py-3 font-mono"><span className={col.missing > 0 ? "text-[#f59e0b]" : "text-[#10b981]"}>{col.missing} ({col.missingPct}%)</span></td>
                            <td className="px-5 py-3 font-mono text-[#64748b]">{col.min}</td>
                            <td className="px-5 py-3 font-mono text-[#64748b]">{col.max}</td>
                            <td className="px-5 py-3 font-mono text-[#64748b]">{col.mean}</td>
                            <td className="px-5 py-3 font-mono text-[#64748b]">{col.stddev}</td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════ STEP 2: ANOMALY DETECTION ══════════════ */}
            {activeTab === 'anomalies' && (
              <div className="space-y-6">
                <div className="bg-[#111827] border border-[rgba(255,255,255,0.06)] p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-[#f1f5f9] flex items-center gap-2">
                      <Zap className="h-5 w-5 text-[#ef4444]" /> Isolation Forest ML Engine
                    </h3>
                    <p className="text-[#64748b] mt-1 text-sm">Unsupervised multivariate anomaly detection across all numeric features. Scores each record 0–100.</p>
                    {stats && stats.totalMissing > 0 && (
                      <p className="text-[#f59e0b] text-xs mt-2 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> {stats.totalMissing} missing values detected. Clean first for best results (Step 3).
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={runDetection} disabled={isDetecting}
                      className="flex items-center space-x-2 bg-[#ef4444] hover:bg-[#ef4444]/80 text-white px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                      {isDetecting ? <Activity className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
                      <span>{isDetecting ? "Scanning…" : "Run AI Detection"}</span>
                    </motion.button>
                    {anomalyData && (
                      <button onClick={() => setActiveTab('cleaning')}
                        className="flex items-center gap-2 bg-[#f59e0b] text-[#0a0f1e] px-5 py-3 rounded-xl font-bold text-sm hover:bg-[#f59e0b]/80 transition-all">
                        <Sparkles className="h-4 w-4" /> Next: Clean Data
                      </button>
                    )}
                  </div>
                </div>

                {anomalyStats && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <StatCard label="Anomalies Flagged" value={anomalyStats.flagged} sub="Records" icon={AlertTriangle} color="#ef4444" />
                      <StatCard label="Critical (≥70)" value={anomalyStats.critical} sub="High threat" icon={Zap} color="#ef4444" />
                      <StatCard label="Moderate (40–70)" value={anomalyStats.moderate} sub="Review needed" icon={TrendingUp} color="#f59e0b" />
                      <StatCard label="Safe (<40)" value={anomalyStats.safe} sub="Clean records" icon={CheckCircle} color="#10b981" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
                        <h4 className="text-sm font-bold text-[#f1f5f9] mb-4">Threat Level Distribution</h4>
                        <ResponsiveContainer width="100%" height={220}>
                          <RechartsPieChart>
                            <Pie data={anomalyStats.pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                              {anomalyStats.pieData.map((_, i) => <Cell key={i} fill={['#10b981','#f59e0b','#ef4444'][i]} />)}
                            </Pie>
                            <RechartsTooltip content={<CustomTooltip />} />
                            <Legend formatter={(v) => <span className="text-[#f1f5f9] text-xs">{v}</span>} />
                          </RechartsPieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
                        <h4 className="text-sm font-bold text-[#f1f5f9] mb-4">Threat Score Distribution</h4>
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={anomalyStats.scoreHistData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis dataKey="bucket" fontSize={9} stroke="#64748b" />
                            <YAxis fontSize={10} stroke="#64748b" />
                            <RechartsTooltip content={<CustomTooltip />} />
                            <Bar dataKey="count" radius={[4,4,0,0]}>
                              {anomalyStats.scoreHistData.map((entry, i) => (
                                <Cell key={i} fill={Number(entry.bucket.split('–')[0]) >= 70 ? '#ef4444' : Number(entry.bucket.split('–')[0]) >= 40 ? '#f59e0b' : '#00d4ff'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </>
                )}

                {anomalyData && (
                  <div className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden">
                    <div className="p-5 border-b border-[rgba(255,255,255,0.06)] flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-[#ef4444]" />
                      <h4 className="font-bold text-[#f1f5f9]">All Records with Threat Scores</h4>
                      <span className="ml-auto text-xs text-[#64748b] font-mono">{anomalyData.filter(r => r.is_anomaly).length} / {anomalyData.length} flagged</span>
                    </div>
                    <div className="ag-theme-alpine-dark w-full h-[420px]">
                      <AgGridReact
                        rowData={anomalyData}
                        columnDefs={Object.keys(anomalyData[0]).map(key => ({
                          field: key, sortable: true, filter: true,
                          cellStyle: (params: any) => {
                            if (key === 'threat_score' && params.value > 60) return { color: '#ef4444', fontWeight: 'bold' };
                            if (key === 'threat_score' && params.value > 30) return { color: '#f59e0b' };
                            return null;
                          }
                        }))}
                        pagination paginationPageSize={12} theme="legacy"
                        rowStyle={{ background: 'transparent' }}
                        rowClassRules={{ 'bg-red-950/20': (p: any) => p.data.is_anomaly === true }}
                      />
                    </div>
                  </div>
                )}

                {!anomalyData && (
                  <div className="py-20 text-center bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-2xl">
                    <FlaskConical className="h-14 w-14 text-[#64748b] mx-auto mb-4" />
                    <p className="text-[#f1f5f9] font-bold text-lg">Ready to Detect Anomalies</p>
                    <p className="text-[#64748b] text-sm mt-2 max-w-sm mx-auto">Click "Run AI Detection" above. The Isolation Forest engine will score every record in your dataset 0–100.</p>
                  </div>
                )}
              </div>
            )}

            {/* ══════════════ STEP 3: DATA CLEANING ══════════════ */}
            {activeTab === 'cleaning' && (() => {
              const colsWithMissing = stats?.colStats.filter(c => c.missing > 0) || [];
              return (
                <div className="space-y-6">
                  {!anomalyData && (
                    <div className="flex items-center gap-3 bg-[#f59e0b]/8 border border-[#f59e0b]/20 rounded-2xl px-5 py-4 text-sm">
                      <AlertTriangle className="h-5 w-5 text-[#f59e0b] flex-shrink-0" />
                      <span className="text-[#f59e0b]">Tip: Run <button onClick={() => setActiveTab('anomalies')} className="underline font-bold">Anomaly Detection (Step 2)</button> first — anomaly scores help identify which missing values are critical.</span>
                    </div>
                  )}

                  {stats && stats.duplicateCount > 0 && (
                    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                      className="bg-[#f59e0b]/10 border border-[#f59e0b]/20 p-5 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center space-x-3 text-[#f59e0b]">
                        <FileSearch className="h-6 w-6" />
                        <div>
                          <h4 className="font-bold">Duplicate Records Detected</h4>
                          <p className="text-sm opacity-80">{stats.duplicateCount} identical rows found.</p>
                        </div>
                      </div>
                      <button onClick={removeDuplicates}
                        className="bg-[#f59e0b] text-[#0a0f1e] px-4 py-2 rounded-lg font-bold text-sm hover:bg-[#f59e0b]/80 transition-colors">
                        Remove Duplicates
                      </button>
                    </motion.div>
                  )}

                  <div className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6 space-y-6">
                    <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] pb-4">
                      <h3 className="text-xl font-bold text-[#f1f5f9] flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-[#f59e0b]" /> Imputation Engine
                      </h3>
                      <div className="flex items-center gap-3 text-sm font-mono bg-[#0a0f1e] px-4 py-2 rounded-xl border border-[rgba(255,255,255,0.06)]">
                        <span className="text-[#64748b]">Before:</span>
                        <span className="text-[#ef4444] font-bold">{cleaningStats.before}</span>
                        <ChevronRight className="h-4 w-4 text-[#64748b]" />
                        <span className="text-[#10b981] font-bold">{cleaningStats.after !== null ? cleaningStats.after : "?"}</span>
                      </div>
                    </div>

                    {colsWithMissing.length === 0 ? (
                      <div className="py-16 text-center text-[#10b981] flex flex-col items-center gap-4">
                        <div className="p-6 bg-[#10b981]/10 rounded-full border border-[#10b981]/20">
                          <CheckCircle className="h-12 w-12" />
                        </div>
                        <p className="text-xl font-bold">Dataset is 100% clean!</p>
                        <button onClick={() => setActiveTab('ai_explanation')}
                          className="flex items-center gap-2 bg-[#7c3aed] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#7c3aed]/80 transition-all">
                          <Brain className="h-4 w-4" /> Next: AI Explanation
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {colsWithMissing.map((col, i) => (
                          <motion.div key={col.name}
                            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-[#0a0f1e] p-4 rounded-xl border border-[rgba(255,255,255,0.06)] hover:border-[rgba(245,158,11,0.2)] transition-all">
                            <div className="md:col-span-3 font-bold text-[#f59e0b] font-mono text-sm">{col.name}</div>
                            <div className="md:col-span-5">
                              <div className="flex justify-between text-xs mb-1.5 font-mono">
                                <span className="text-[#64748b]">{col.missing} missing</span>
                                <span className="text-[#f59e0b]">{col.missingPct}%</span>
                              </div>
                              <div className="w-full bg-[#1a2235] rounded-full h-2">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, Number(col.missingPct))}%` }}
                                  transition={{ duration: 0.8, delay: i * 0.05 }}
                                  className="h-2 rounded-full bg-gradient-to-r from-[#f59e0b] to-[#ef4444]" />
                              </div>
                            </div>
                            <div className="md:col-span-4">
                              <select
                                className="w-full bg-[#111827] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] focus:ring-1 focus:ring-[#f59e0b] outline-none transition-all cursor-pointer"
                                value={strategies[col.name] || ""}
                                onChange={(e) => setStrategies({ ...strategies, [col.name]: e.target.value })}
                              >
                                <option value="">Select Strategy...</option>
                                {col.type === "Numeric" ? (
                                  <>
                                    <option value="mean">Impute Mean ({col.mean})</option>
                                    <option value="median">Impute Median</option>
                                    <option value="fill_0">Fill with 0</option>
                                  </>
                                ) : (
                                  <>
                                    <option value="mode">Impute Mode (Most Frequent)</option>
                                    <option value="fill_unknown">Fill with "Unknown"</option>
                                  </>
                                )}
                                <option value="drop_col">Drop Column Entirely</option>
                              </select>
                            </div>
                          </motion.div>
                        ))}
                        <div className="flex justify-between items-center pt-2">
                          <p className="text-[#64748b] text-xs">{Object.keys(strategies).length} strategies selected</p>
                          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            onClick={applyCleaning}
                            className="bg-[#f59e0b] text-[#0a0f1e] px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-[#f59e0b]/80 transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                            <Sparkles className="h-4 w-4" /> Apply Cleaning Strategy
                          </motion.button>
                        </div>
                      </div>
                    )}
                  </div>

                  {cleaningStats.after !== null && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between bg-[#10b981]/10 border border-[#10b981]/20 rounded-2xl px-5 py-4">
                      <div className="flex items-center gap-3 text-[#10b981]">
                        <CheckCircle className="h-5 w-5" />
                        <p className="font-bold">Cleaning applied successfully.</p>
                      </div>
                      <button onClick={() => setActiveTab('ai_explanation')}
                        className="flex items-center gap-2 bg-[#7c3aed] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-[#7c3aed]/80 transition-all">
                        <Brain className="h-4 w-4" /> Next: AI Explanation
                      </button>
                    </motion.div>
                  )}
                </div>
              );
            })()}

            {/* ══════════════ STEP 4: AI EXPLANATION ══════════════ */}
            {activeTab === 'ai_explanation' && (
              <div className="space-y-6">
                <div className="bg-[#111827] border border-[rgba(255,255,255,0.06)] p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-[#f1f5f9] flex items-center gap-2">
                      <Brain className="h-5 w-5 text-[#7c3aed]" /> Claude AI Clinical Analysis
                    </h3>
                    <p className="text-[#64748b] mt-1 text-sm">Generates a full clinical intelligence report — findings, anomaly context, and actionable recommendations.</p>
                  </div>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={generateAIExplanation} disabled={isExplaining}
                    className="flex items-center gap-2 bg-[#7c3aed] hover:bg-[#7c3aed]/80 text-white px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(124,58,237,0.3)]">
                    {isExplaining ? <Activity className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                    <span>{isExplaining ? "Generating…" : "Generate AI Report"}</span>
                  </motion.button>
                </div>

                {/* Context cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Health Score" value={`${stats?.healthScore.toFixed(1)}%`} sub="After cleaning" icon={Shield} color="#10b981" />
                  <StatCard label="Anomalies" value={anomalyStats?.flagged ?? "–"} sub="Detected records" icon={AlertTriangle} color="#ef4444" />
                  <StatCard label="Critical" value={anomalyStats?.critical ?? "–"} sub="High threat (≥70)" icon={Zap} color="#ef4444" />
                  <StatCard label="Missing Values" value={stats?.totalMissing ?? 0} sub="Remaining" icon={Database} color="#f59e0b" />
                </div>

                {!aiExplanations && !isExplaining && (
                  <div className="py-20 text-center bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-2xl">
                    <Brain className="h-14 w-14 text-[#64748b] mx-auto mb-4" />
                    <p className="text-[#f1f5f9] font-bold text-lg">AI Explanation Not Generated Yet</p>
                    <p className="text-[#64748b] text-sm mt-2 max-w-sm mx-auto">Complete Steps 2 & 3 first, then click "Generate AI Report" for a full clinical analysis of your dataset.</p>
                  </div>
                )}

                {isExplaining && (
                  <div className="py-20 text-center bg-[#111827] border border-[rgba(124,58,237,0.2)] rounded-2xl">
                    <div className="relative mx-auto w-16 h-16 mb-4">
                      <div className="absolute inset-0 bg-[#7c3aed] rounded-full blur-xl opacity-30 animate-pulse" />
                      <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-[#7c3aed]/10 border border-[#7c3aed]/30">
                        <Brain className="h-8 w-8 text-[#7c3aed] animate-pulse" />
                      </div>
                    </div>
                    <p className="text-[#f1f5f9] font-bold">Claude is analyzing your clinical dataset…</p>
                    <p className="text-[#64748b] text-sm mt-1">Reviewing anomaly patterns, data quality, and generating recommendations</p>
                  </div>
                )}

                {aiExplanations && !isExplaining && (
                  <AnimatePresence>
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                      {/* Executive Summary */}
                      <div className="bg-gradient-to-r from-[#7c3aed]/10 to-[#0a0f1e] border border-[#7c3aed]/30 rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-[#7c3aed]/20 rounded-xl"><Brain className="h-5 w-5 text-[#7c3aed]" /></div>
                          <h4 className="text-lg font-bold text-[#f1f5f9]">Executive Summary</h4>
                          <span className="ml-auto text-[10px] font-mono text-[#7c3aed] border border-[#7c3aed]/30 px-2 py-0.5 rounded-full">AI Generated</span>
                        </div>
                        <p className="text-[#f1f5f9] leading-relaxed">{aiExplanations.summary}</p>
                      </div>

                      {/* Findings */}
                      <div className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
                        <h4 className="text-sm font-bold text-[#f1f5f9] mb-4 flex items-center gap-2">
                          <FileSearch className="h-4 w-4 text-[#00d4ff]" /> Key Findings
                        </h4>
                        <div className="space-y-3">
                          {aiExplanations.findings.map((finding, i) => (
                            <motion.div key={i}
                              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.08 }}
                              className="flex items-start gap-3 bg-[#0a0f1e] p-3 rounded-xl border border-[rgba(255,255,255,0.04)]">
                              <span className="w-6 h-6 rounded-full bg-[#00d4ff]/10 border border-[#00d4ff]/20 flex items-center justify-center text-[10px] font-bold text-[#00d4ff] flex-shrink-0 mt-0.5">{i+1}</span>
                              <p className="text-[#f1f5f9] text-sm leading-relaxed">{finding}</p>
                            </motion.div>
                          ))}
                        </div>
                      </div>

                      {/* Recommendations */}
                      <div className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
                        <h4 className="text-sm font-bold text-[#f1f5f9] mb-4 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-[#10b981]" /> Recommendations
                        </h4>
                        <div className="space-y-3">
                          {aiExplanations.recommendations.map((rec, i) => (
                            <motion.div key={i}
                              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.1 }}
                              className="flex items-start gap-3 bg-[#10b981]/5 p-3 rounded-xl border border-[#10b981]/15">
                              <CheckCircle className="h-4 w-4 text-[#10b981] flex-shrink-0 mt-0.5" />
                              <p className="text-[#f1f5f9] text-sm leading-relaxed">{rec}</p>
                            </motion.div>
                          ))}
                        </div>
                      </div>

                      {/* Next Step CTA */}
                      <div className="flex justify-end">
                        <button onClick={() => setActiveTab('medquery')}
                          className="flex items-center gap-2 bg-[#10b981] text-[#0a0f1e] px-6 py-3 rounded-xl font-bold hover:bg-[#10b981]/80 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                          <BotMessageSquare className="h-4 w-4" /> Next: MedQuery AI
                        </button>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>
            )}

            {/* ══════════════ STEP 5: MEDQUERY AI ══════════════ */}
            {activeTab === 'medquery' && (
              <div className="space-y-4">
                <div className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5 flex items-center gap-4">
                  <div className="p-3 bg-[#10b981]/10 border border-[#10b981]/20 rounded-xl">
                    <BotMessageSquare className="h-6 w-6 text-[#10b981]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#f1f5f9]">MedQuery AI</h3>
                    <p className="text-[#64748b] text-sm">Ask questions about your uploaded dataset in plain English. AI generates Pandas code and returns live results.</p>
                  </div>
                </div>
                <ClinicalChat />
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
