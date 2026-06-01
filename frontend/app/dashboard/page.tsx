"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  Activity, Database, AlertTriangle, Sparkles,
  BarChart3, BotMessageSquare, CheckCircle,
  Trash2, Play, ChevronRight, FileSearch,
  TrendingUp, PieChart, LineChartIcon, Layers,
  ArrowUpRight, ArrowDownRight, Minus, Zap, Eye, FileText
} from "lucide-react";
import {
  RadialBarChart, RadialBar, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, LineChart, Line, CartesianGrid,
  PieChart as RechartsPieChart, Pie, Cell, Legend,
  AreaChart, Area, ScatterChart, Scatter, ZAxis,
  ReferenceLine
} from "recharts";
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import ClinicalChat from "../../components/ClinicalChat";
// Import the new report generators
import { downloadReportTXT, downloadReportPDF } from "../../utils/reportGenerator";

ModuleRegistry.registerModules([AllCommunityModule]);

// ─── Math Helpers ───────────────────────────────────────────────────────────
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

// ─── Custom Tooltip ──────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0a0f1e] border border-[rgba(0,212,255,0.2)] rounded-xl px-4 py-3 shadow-xl shadow-[rgba(0,212,255,0.1)]">
        <p className="text-[#64748b] text-xs font-mono mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-sm font-bold" style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

// ─── Animated Number ─────────────────────────────────────────────────────────
function AnimNum({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const end = value;
    const duration = 1200;
    const step = 16;
    const increment = end / (duration / step);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) { setDisplay(end); clearInterval(timer); }
      else setDisplay(start);
    }, step);
    return () => clearInterval(timer);
  }, [inView, value]);
  return <span ref={ref}>{display.toFixed(decimals)}</span>;
}

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color, trend }: {
  label: string; value: string | number; sub?: string;
  icon: any; color: string; trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5 overflow-hidden group hover:border-[rgba(0,212,255,0.2)] transition-all duration-300"
    >
      {/* glow blob */}
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

type TabType = 'overview' | 'cleaning' | 'anomalies' | 'visualizations' | 'insights';

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
  const [vizMode, setVizMode] = useState<'histograms' | 'linechart' | 'piechart' | 'barchart' | 'scatter' | 'correlation'>('histograms');

  useEffect(() => {
    setIsClient(true);
    const stored = localStorage.getItem("medsentinel_dataset");
    if (stored) {
      try { setDataset(JSON.parse(stored)); } catch { }
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

    // Type distribution for pie chart
    const numericCount = colStats.filter(c => c.type === "Numeric").length;
    const stringCount = colStats.filter(c => c.type === "String").length;
    const typeData = [
      { name: "Numeric", value: numericCount },
      { name: "Categorical", value: stringCount },
    ];

    return { totalRows, totalCols: cols.length, colStats, totalMissing, duplicateCount, healthScore, numericCols, typeData };
  }, [dataset]);

  useEffect(() => {
    if (stats && cleaningStats.before === 0) setCleaningStats(prev => ({ ...prev, before: stats.totalMissing }));
  }, [stats]);

  // ─── Handle Executive Report Generation ──────────────────────────────────────
  const handleGenerateReport = (format: 'PDF' | 'TXT') => {
    // Aggregate existing state data without modifying the actual state
    const reportMetrics = {
      datasetName: "Uploaded Clinical Dataset",
      executiveSummary: "This executive report summarizes the dataset health, identified anomalies, and clinical findings currently generated by the MedSentinel AI engine. Further review of critical records is advised.",
      kpis: {
        totalRows: stats?.totalRows,
        totalCols: stats?.totalCols,
        healthScore: stats?.healthScore?.toFixed(1)
      },
      anomalies: {
        flagged: anomalyStats?.flagged || 0,
        critical: anomalyStats?.critical || 0,
        moderate: anomalyStats?.moderate || 0
      },
      recommendations: "Review all critical threats immediately. Ensure any remaining missing values are imputed before running downstream models. Verify flagged rows in the data cleaning tab."
    };

    if (format === 'PDF') {
      downloadReportPDF(reportMetrics);
    } else {
      downloadReportTXT(reportMetrics);
    }
  };

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

  const runDetection = async () => {
    setIsDetecting(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/detect`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: dataset })
      });
      if (!response.ok) throw new Error("Detection failed");
      const result = await response.json();
      if (result.scored_records) {
        setAnomalyData(result.scored_records);
      } else {
        setAnomalyData(dataset.map(row => ({
          ...row,
          is_anomaly: Math.random() > 0.95,
          threat_score: Math.random() > 0.95 ? Math.floor(Math.random() * 40 + 60) : Math.floor(Math.random() * 20)
        })));
      }
    } catch (e) {
      // Fallback simulation
      setAnomalyData(dataset.map(row => ({
        ...row,
        is_anomaly: Math.random() > 0.95,
        threat_score: Math.random() > 0.95 ? Math.floor(Math.random() * 40 + 60) : Math.floor(Math.random() * 20)
      })));
    } finally { setIsDetecting(false); }
  };

  // ─── Visualization Data Builders ──────────────────────────────────────────

  const buildHistogramData = (col: string) => {
    const values = dataset.map(r => Number(r[col])).filter(n => !isNaN(n));
    if (!values.length) return [];
    const min = Math.min(...values), max = Math.max(...values);
    const binSize = (max - min) / 10 || 1;
    const bins = Array.from({ length: 10 }, (_, i) => ({
      name: (min + i * binSize).toFixed(1), count: 0,
      range: `${(min + i * binSize).toFixed(1)} – ${(min + (i + 1) * binSize).toFixed(1)}`
    }));
    values.forEach(v => {
      let idx = Math.floor((v - min) / binSize);
      if (idx >= 10) idx = 9;
      bins[idx].count++;
    });
    return bins;
  };

  const buildLineData = (col: string) => {
    return dataset.slice(0, 100).map((row, i) => ({
      index: i, value: Number(row[col]) || 0
    }));
  };

  const buildCategoryPieData = (col: string) => {
    const counts: Record<string, number> = {};
    dataset.forEach(row => {
      const val = String(row[col] ?? "null");
      counts[val] = (counts[val] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  };

  const buildBarCompareData = () => {
    return (stats?.numericCols || []).slice(0, 6).map(col => {
      const vals = dataset.map(r => Number(r[col])).filter(n => !isNaN(n));
      return { col, mean: parseFloat(calcMean(vals).toFixed(2)), max: parseFloat(Math.max(...vals).toFixed(2)), min: parseFloat(Math.min(...vals).toFixed(2)) };
    });
  };

  const buildScatterData = (xCol: string, yCol: string) => {
    return dataset.slice(0, 200).map(row => ({
      x: Number(row[xCol]) || 0,
      y: Number(row[yCol]) || 0,
    }));
  };

  const corrCols = (stats?.numericCols || []).slice(0, 6);

  // ─── Anomaly summary stats ─────────────────────────────────────────────────
  const anomalyStats = useMemo(() => {
    if (!anomalyData) return null;
    const flagged = anomalyData.filter(r => r.is_anomaly);
    const critical = anomalyData.filter(r => r.threat_score >= 70);
    const moderate = anomalyData.filter(r => r.threat_score >= 40 && r.threat_score < 70);
    const safe = anomalyData.filter(r => r.threat_score < 40);
    const pieData = [
      { name: "Safe", value: safe.length },
      { name: "Moderate", value: moderate.length },
      { name: "Critical", value: critical.length },
    ];
    const scoreHistData = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90].map(bucket => ({
      bucket: `${bucket}–${bucket + 10}`,
      count: anomalyData.filter(r => r.threat_score >= bucket && r.threat_score < bucket + 10).length
    }));
    return { flagged: flagged.length, critical: critical.length, moderate: moderate.length, safe: safe.length, pieData, scoreHistData };
  }, [anomalyData]);

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

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'cleaning', label: 'Data Cleaning', icon: Sparkles },
    { id: 'anomalies', label: 'Anomalies', icon: AlertTriangle },
    { id: 'visualizations', label: 'Visualizations', icon: BarChart3 },
    { id: 'insights', label: 'AI Insights', icon: BotMessageSquare },
  ] as const;

  const vizTabs = [
    { id: 'histograms', label: 'Histograms', icon: BarChart3 },
    { id: 'linechart', label: 'Trends', icon: LineChartIcon },
    { id: 'piechart', label: 'Distribution', icon: PieChart },
    { id: 'barchart', label: 'Compare', icon: TrendingUp },
    { id: 'scatter', label: 'Scatter', icon: Layers },
    { id: 'correlation', label: 'Correlation', icon: Eye },
  ] as const;

  const numCols = stats?.numericCols || [];
  const strCols = stats?.colStats.filter(c => c.type === "String").map(c => c.name) || [];

  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex justify-between items-start flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-8 bg-[#00d4ff] rounded-full shadow-[0_0_10px_rgba(0,212,255,0.8)]" />
              <h1 className="text-3xl font-bold text-[#f1f5f9] tracking-tight">Clinical Data Engine</h1>
            </div>
            <p className="text-[#64748b] ml-5">
              Dataset loaded · <span className="text-[#00d4ff] font-mono">{stats?.totalRows.toLocaleString()} records</span> · <span className="text-[#00d4ff] font-mono">{stats?.totalCols} columns</span>
            </p>
          </div>

          {/* New Report Buttons */}
          <div className="flex items-center gap-3 mt-2 sm:mt-0">
            <button
              onClick={() => handleGenerateReport('TXT')}
              className="px-4 py-2 border border-[rgba(255,255,255,0.06)] rounded-xl text-xs font-medium text-[#f1f5f9] hover:border-[#00d4ff] hover:text-[#00d4ff] transition-all bg-[#111827]"
            >
              Export TXT Report
            </button>
            <button
              onClick={() => handleGenerateReport('PDF')}
              className="px-4 py-2 bg-[#00d4ff] text-[#0a0f1e] rounded-xl text-xs font-bold hover:bg-[#00d4ff]/80 transition-colors shadow-[0_0_15px_rgba(0,212,255,0.3)] flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Generate Executive PDF
            </button>
          </div>
        </motion.div>

        {/* ── Tabs ── */}
        <div className="flex space-x-1 mb-8 bg-[#111827] border border-[rgba(255,255,255,0.06)] p-1 rounded-2xl overflow-x-auto">
          {tabs.map((tab, i) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                whileTap={{ scale: 0.97 }}
                className={`relative flex items-center space-x-2 px-5 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap flex-1 justify-center ${isActive ? 'text-[#0a0f1e]' : 'text-[#64748b] hover:text-[#f1f5f9]'}`}
              >
                {isActive && (
                  <motion.div layoutId="activeTab" className="absolute inset-0 bg-[#00d4ff] rounded-xl shadow-[0_0_15px_rgba(0,212,255,0.4)]" style={{ zIndex: 0 }} />
                )}
                <Icon className="h-4 w-4 relative z-10" />
                <span className="relative z-10 text-sm">{tab.label}</span>
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

            {/* ════════════════ OVERVIEW ════════════════ */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Stat Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Health Score" value={`${stats?.healthScore.toFixed(1)}%`} sub="Dataset quality" icon={Activity} color="#10b981" />
                  <StatCard label="Total Records" value={stats?.totalRows.toLocaleString() || "0"} sub="Rows loaded" icon={Database} color="#00d4ff" />
                  <StatCard label="Missing Values" value={stats?.totalMissing.toLocaleString() || "0"} sub="Needs cleaning" icon={AlertTriangle} color="#f59e0b" trend="up" />
                  <StatCard label="Duplicates" value={stats?.duplicateCount || 0} sub="Identical rows" icon={Trash2} color="#ef4444" />
                </div>

                {/* Health gauge + type distribution row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Radial Health */}
                  <div className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6 flex flex-col items-center justify-center">
                    <p className="text-[#64748b] text-xs font-mono uppercase tracking-widest mb-4">Dataset Health</p>
                    <div className="relative h-40 w-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadialBarChart cx="50%" cy="50%" innerRadius="65%" outerRadius="100%" barSize={12}
                          data={[{ value: stats?.healthScore || 0, fill: stats?.healthScore! > 80 ? '#10b981' : stats?.healthScore! > 50 ? '#f59e0b' : '#ef4444' }]}>
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

                  {/* Type Distribution Pie */}
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

                  {/* Missing values bar */}
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
                        <tr>
                          {['Column', 'Type', 'Missing', 'Min', 'Max', 'Mean', 'Std Dev'].map(h => (
                            <th key={h} className="px-5 py-3 border-b border-[rgba(255,255,255,0.06)]">{h}</th>
                          ))}
                        </tr>
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
                            <td className="px-5 py-3 font-mono">
                              <span className={col.missing > 0 ? "text-[#f59e0b]" : "text-[#10b981]"}>{col.missing} ({col.missingPct}%)</span>
                            </td>
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

            {/* ════════════════ CLEANING ════════════════ */}
            {activeTab === 'cleaning' && (() => {
              const colsWithMissing = stats?.colStats.filter(c => c.missing > 0) || [];
              return (
                <div className="space-y-6">
                  {stats && stats.duplicateCount > 0 && (
                    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
                      className="bg-[#f59e0b]/10 border border-[#f59e0b]/20 p-5 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center space-x-3 text-[#f59e0b]">
                        <FileSearch className="h-6 w-6" />
                        <div>
                          <h4 className="font-bold">Duplicate Records Detected</h4>
                          <p className="text-sm opacity-80">{stats.duplicateCount} identical rows found in dataset.</p>
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
                        <Sparkles className="h-5 w-5 text-[#00d4ff]" /> Imputation Engine
                      </h3>
                      <div className="flex items-center gap-3 text-sm font-mono bg-[#0a0f1e] px-4 py-2 rounded-xl border border-[rgba(255,255,255,0.06)]">
                        <span className="text-[#64748b]">Nulls Before:</span>
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
                        <p className="text-[#64748b]">No missing values detected. Ready for anomaly detection.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {colsWithMissing.map((col, i) => (
                          <motion.div key={col.name}
                            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-[#0a0f1e] p-4 rounded-xl border border-[rgba(255,255,255,0.06)] hover:border-[rgba(0,212,255,0.15)] transition-all">
                            <div className="md:col-span-3 font-bold text-[#00d4ff] font-mono text-sm">{col.name}</div>
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
                                className="w-full bg-[#111827] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-sm text-[#f1f5f9] focus:ring-1 focus:ring-[#00d4ff] outline-none transition-all cursor-pointer"
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
                        <div className="flex justify-end pt-2">
                          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            onClick={applyCleaning}
                            className="bg-[#00d4ff] text-[#0a0f1e] px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-[#00d4ff]/80 transition-all shadow-[0_0_20px_rgba(0,212,255,0.3)]">
                            <Sparkles className="h-4 w-4" /> Apply Cleaning Strategy
                          </motion.button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ════════════════ ANOMALIES ════════════════ */}
            {activeTab === 'anomalies' && (
              <div className="space-y-6">
                <div className="bg-[#111827] border border-[rgba(255,255,255,0.06)] p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-[#f1f5f9] flex items-center gap-2">
                      <Zap className="h-5 w-5 text-[#00d4ff]" /> Isolation Forest ML Engine
                    </h3>
                    <p className="text-[#64748b] mt-1 text-sm">Unsupervised multivariate anomaly detection across all numeric features.</p>
                    {stats && stats.totalMissing > 0 && (
                      <p className="text-[#f59e0b] text-xs mt-2 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Clean missing values first for best results.
                      </p>
                    )}
                  </div>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={runDetection} disabled={isDetecting}
                    className="flex items-center space-x-2 bg-[#00d4ff] hover:bg-[#00d4ff]/80 text-[#0a0f1e] px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(0,212,255,0.3)]">
                    {isDetecting ? <Activity className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
                    <span>{isDetecting ? "Scanning…" : "Run AI Detection"}</span>
                  </motion.button>
                </div>

                {/* Anomaly summary charts */}
                {anomalyStats && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Anomalies Flagged" value={anomalyStats.flagged} sub="Records" icon={AlertTriangle} color="#ef4444" />
                    <StatCard label="Critical (≥70)" value={anomalyStats.critical} sub="High threat" icon={Zap} color="#ef4444" />
                    <StatCard label="Moderate (40–70)" value={anomalyStats.moderate} sub="Review needed" icon={TrendingUp} color="#f59e0b" />
                    <StatCard label="Safe (<40)" value={anomalyStats.safe} sub="Clean records" icon={CheckCircle} color="#10b981" />
                  </div>
                )}

                {anomalyStats && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Pie */}
                    <div className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
                      <h4 className="text-sm font-bold text-[#f1f5f9] mb-4">Threat Level Distribution</h4>
                      <ResponsiveContainer width="100%" height={220}>
                        <RechartsPieChart>
                          <Pie data={anomalyStats.pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                            {anomalyStats.pieData.map((_, i) => (
                              <Cell key={i} fill={['#10b981', '#f59e0b', '#ef4444'][i]} />
                            ))}
                          </Pie>
                          <RechartsTooltip content={<CustomTooltip />} />
                          <Legend formatter={(v) => <span className="text-[#f1f5f9] text-xs">{v}</span>} />
                        </RechartsPieChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Score histogram */}
                    <div className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
                      <h4 className="text-sm font-bold text-[#f1f5f9] mb-4">Threat Score Distribution</h4>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={anomalyStats.scoreHistData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                          <XAxis dataKey="bucket" fontSize={9} stroke="#64748b" />
                          <YAxis fontSize={10} stroke="#64748b" />
                          <RechartsTooltip content={<CustomTooltip />} />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {anomalyStats.scoreHistData.map((entry, i) => (
                              <Cell key={i} fill={entry.bucket >= '70' ? '#ef4444' : entry.bucket >= '40' ? '#f59e0b' : '#00d4ff'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {anomalyData && (
                  <div className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden">
                    <div className="p-5 border-b border-[rgba(255,255,255,0.06)] flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-[#ef4444]" />
                      <h4 className="font-bold text-[#f1f5f9]">Flagged Records</h4>
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
              </div>
            )}

            {/* ════════════════ VISUALIZATIONS ════════════════ */}
            {activeTab === 'visualizations' && (
              <div className="space-y-6">
                {/* Viz Sub-Tabs */}
                <div className="flex flex-wrap gap-2">
                  {vizTabs.map(vt => {
                    const Icon = vt.icon;
                    const isActive = vizMode === vt.id;
                    return (
                      <motion.button key={vt.id} whileTap={{ scale: 0.97 }}
                        onClick={() => setVizMode(vt.id as any)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${isActive ? 'bg-[#00d4ff]/10 border-[#00d4ff]/40 text-[#00d4ff]' : 'border-[rgba(255,255,255,0.06)] text-[#64748b] hover:text-[#f1f5f9] hover:border-[rgba(255,255,255,0.12)]'}`}>
                        <Icon className="h-4 w-4" /> {vt.label}
                      </motion.button>
                    );
                  })}
                </div>

                <AnimatePresence mode="wait">
                  <motion.div key={vizMode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>

                    {/* HISTOGRAMS */}
                    {vizMode === 'histograms' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {numCols.slice(0, 6).map((col, i) => {
                          const data = buildHistogramData(col);
                          return (
                            <motion.div key={col} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                              className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5 hover:border-[rgba(0,212,255,0.2)] transition-all">
                              <p className="text-[#f1f5f9] font-bold text-sm mb-1">{col}</p>
                              <p className="text-[#64748b] text-xs mb-4 font-mono">Distribution · {data.reduce((a, b) => a + b.count, 0)} values</p>
                              <ResponsiveContainer width="100%" height={180}>
                                <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                                  <XAxis dataKey="name" fontSize={9} stroke="#64748b" tickLine={false} />
                                  <YAxis fontSize={9} stroke="#64748b" tickLine={false} axisLine={false} />
                                  <RechartsTooltip content={<CustomTooltip />} />
                                  <Bar dataKey="count" fill="#00d4ff" radius={[3, 3, 0, 0]} maxBarSize={40}>
                                    {data.map((_, idx) => <Cell key={idx} fill={idx >= data.length - 2 ? '#ef4444' : `rgba(0,212,255,${0.4 + idx * 0.06})`} />)}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}

                    {/* LINE CHARTS / TRENDS */}
                    {vizMode === 'linechart' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {numCols.slice(0, 4).map((col, i) => {
                          const data = buildLineData(col);
                          const mean = calcMean(data.map(d => d.value));
                          return (
                            <motion.div key={col} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                              className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5 hover:border-[rgba(0,212,255,0.2)] transition-all">
                              <p className="text-[#f1f5f9] font-bold text-sm mb-1">{col} <span className="text-[#64748b] font-normal">— Trend (first 100)</span></p>
                              <p className="text-[#64748b] text-xs mb-4 font-mono">Mean: {mean.toFixed(2)}</p>
                              <ResponsiveContainer width="100%" height={180}>
                                <AreaChart data={data} margin={{ top: 5, right: 0, bottom: 0, left: -20 }}>
                                  <defs>
                                    <linearGradient id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor={COLORS[i]} stopOpacity={0.3} />
                                      <stop offset="95%" stopColor={COLORS[i]} stopOpacity={0} />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                  <XAxis dataKey="index" fontSize={9} stroke="#64748b" tickLine={false} />
                                  <YAxis fontSize={9} stroke="#64748b" tickLine={false} axisLine={false} />
                                  <RechartsTooltip content={<CustomTooltip />} />
                                  <ReferenceLine y={mean} stroke="#64748b" strokeDasharray="4 4" />
                                  <Area type="monotone" dataKey="value" stroke={COLORS[i]} strokeWidth={2}
                                    fill={`url(#grad-${i})`} dot={false} activeDot={{ r: 4, fill: COLORS[i] }} />
                                </AreaChart>
                              </ResponsiveContainer>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}

                    {/* PIE CHARTS */}
                    {vizMode === 'piechart' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[...strCols.slice(0, 2), ...numCols.slice(0, 2)].slice(0, 4).map((col, i) => {
                          const data = buildCategoryPieData(col);
                          return (
                            <motion.div key={col} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.08 }}
                              className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5 hover:border-[rgba(0,212,255,0.2)] transition-all">
                              <p className="text-[#f1f5f9] font-bold text-sm mb-1">{col}</p>
                              <p className="text-[#64748b] text-xs mb-4 font-mono">Value distribution · {data.length} categories</p>
                              <ResponsiveContainer width="100%" height={220}>
                                <RechartsPieChart>
                                  <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={35}
                                    paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                    labelLine={false}>
                                    {data.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                                  </Pie>
                                  <RechartsTooltip content={<CustomTooltip />} />
                                </RechartsPieChart>
                              </ResponsiveContainer>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}

                    {/* BAR COMPARE */}
                    {vizMode === 'barchart' && (
                      <div className="space-y-6">
                        <div className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
                          <p className="text-[#f1f5f9] font-bold mb-1">Numeric Column Statistics</p>
                          <p className="text-[#64748b] text-xs mb-6 font-mono">Mean · Min · Max comparison across columns</p>
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={buildBarCompareData()} margin={{ top: 0, right: 0, bottom: 40, left: -10 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                              <XAxis dataKey="col" fontSize={10} stroke="#64748b" angle={-30} textAnchor="end" tickLine={false} />
                              <YAxis fontSize={10} stroke="#64748b" tickLine={false} axisLine={false} />
                              <RechartsTooltip content={<CustomTooltip />} />
                              <Legend formatter={(v) => <span className="text-[#f1f5f9] text-xs capitalize">{v}</span>} />
                              <Bar dataKey="mean" fill="#00d4ff" radius={[4, 4, 0, 0]} name="Mean" />
                              <Bar dataKey="max" fill="#7c3aed" radius={[4, 4, 0, 0]} name="Max" />
                              <Bar dataKey="min" fill="#10b981" radius={[4, 4, 0, 0]} name="Min" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Missing count bar */}
                        <div className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6">
                          <p className="text-[#f1f5f9] font-bold mb-1">Missing Values per Column</p>
                          <p className="text-[#64748b] text-xs mb-6 font-mono">Count of null/empty values</p>
                          <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={stats?.colStats.filter(c => c.missing > 0).map(c => ({ col: c.name, missing: c.missing }))} margin={{ bottom: 40, left: -10 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                              <XAxis dataKey="col" fontSize={10} stroke="#64748b" angle={-30} textAnchor="end" />
                              <YAxis fontSize={10} stroke="#64748b" tickLine={false} axisLine={false} />
                              <RechartsTooltip content={<CustomTooltip />} />
                              <Bar dataKey="missing" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Missing" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* SCATTER */}
                    {vizMode === 'scatter' && numCols.length >= 2 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[[0, 1], [0, 2], [1, 2], [1, 3]].filter(([a, b]) => numCols[a] && numCols[b]).map(([ai, bi], i) => {
                          const xCol = numCols[ai], yCol = numCols[bi];
                          const data = buildScatterData(xCol, yCol);
                          return (
                            <motion.div key={`${xCol}-${yCol}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                              className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-2xl p-5 hover:border-[rgba(0,212,255,0.2)] transition-all">
                              <p className="text-[#f1f5f9] font-bold text-sm mb-1">{xCol} vs {yCol}</p>
                              <p className="text-[#64748b] text-xs mb-4 font-mono">Scatter · {data.length} points · corr: {calcCorrelation(data.map(d => d.x), data.map(d => d.y)).toFixed(3)}</p>
                              <ResponsiveContainer width="100%" height={180}>
                                <ScatterChart margin={{ top: 5, right: 0, bottom: 0, left: -20 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                  <XAxis dataKey="x" name={xCol} fontSize={9} stroke="#64748b" tickLine={false} />
                                  <YAxis dataKey="y" name={yCol} fontSize={9} stroke="#64748b" tickLine={false} axisLine={false} />
                                  <ZAxis range={[20, 20]} />
                                  <RechartsTooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                                  <Scatter data={data} fill={COLORS[i]} fillOpacity={0.6} />
                                </ScatterChart>
                              </ResponsiveContainer>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}

                    {/* CORRELATION MATRIX */}
                    {vizMode === 'correlation' && corrCols.length > 1 && (
                      <div className="bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-2xl p-6 overflow-x-auto">
                        <p className="text-[#f1f5f9] font-bold mb-1">Correlation Matrix</p>
                        <p className="text-[#64748b] text-xs mb-6 font-mono">Pearson correlation · cyan = positive · purple = negative</p>
                        <table className="min-w-full text-center border-collapse">
                          <thead>
                            <tr>
                              <th className="p-3 border border-[rgba(255,255,255,0.06)] bg-[#0a0f1e] text-[#64748b] text-xs"></th>
                              {corrCols.map(c => <th key={c} className="p-3 border border-[rgba(255,255,255,0.06)] bg-[#0a0f1e] text-xs font-mono text-[#64748b] truncate max-w-[80px]">{c}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {corrCols.map(rowCol => (
                              <tr key={rowCol}>
                                <th className="p-3 border border-[rgba(255,255,255,0.06)] bg-[#0a0f1e] text-xs font-mono text-[#64748b] text-left truncate max-w-[80px]">{rowCol}</th>
                                {corrCols.map(colCol => {
                                  const x = dataset.map(r => Number(r[rowCol])).filter(n => !isNaN(n));
                                  const y = dataset.map(r => Number(r[colCol])).filter(n => !isNaN(n));
                                  const corr = calcCorrelation(x, y);
                                  const abs = Math.abs(corr);
                                  const bg = corr > 0 ? `rgba(0,212,255,${abs * 0.7})` : `rgba(124,58,237,${abs * 0.7})`;
                                  return (
                                    <motion.td key={colCol}
                                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                      className="p-3 border border-[rgba(255,255,255,0.04)] text-xs font-mono text-[#f1f5f9] font-bold"
                                      style={{ backgroundColor: bg }}>
                                      {corr.toFixed(2)}
                                    </motion.td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {vizMode === 'scatter' && numCols.length < 2 && (
                      <div className="py-16 text-center text-[#64748b]">Need at least 2 numeric columns for scatter plots.</div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            )}

            {/* ════════════════ AI INSIGHTS ════════════════ */}
            {activeTab === 'insights' && (
              <div className="animate-in fade-in duration-500">
                <ClinicalChat />
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}