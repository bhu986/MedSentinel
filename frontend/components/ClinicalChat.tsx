"use client";

import { useState, useRef, useEffect } from "react";
import axios from "axios";
import {
    Search, Loader2, BotMessageSquare, Database,
    AlertTriangle, Sparkles, ChevronRight, Zap,
    TrendingUp, Activity, FileSearch, BarChart3,
    Send, RotateCcw, Copy, CheckCheck, Code2,
    UploadCloud, Info, Mic, Download
} from "lucide-react";
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import { motion, AnimatePresence } from "framer-motion";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { downloadCSV } from "../utils/csvExport"; // Adjust path if necessary

ModuleRegistry.registerModules([AllCommunityModule]);

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// ─── Types ────────────────────────────────────────────────────────────────────
interface QueryResult {
    data: Record<string, unknown>[];
    row_count: number;
    sql_executed?: string;   // reused for both SQL and Pandas code
    code_executed?: string;
}

interface HistoryItem {
    q: string;
    rows: number;
    time: number;
    mode: "dataset" | "database";
}

// ─── Suggested queries — adapt to whether a dataset is loaded ────────────────
const DATASET_SUGGESTIONS = [
    { icon: AlertTriangle, label: "Abnormal rhythms", query: "Show all records with abnormal rhythms (AFib, SVT, PVC, VTach)", color: "#ef4444" },
    { icon: Activity, label: "High heart rate", query: "Show records where heart_rate_bpm is greater than 120", color: "#f59e0b" },
    { icon: TrendingUp, label: "Critical ST elevation", query: "Find records where ST elevation is above 0.3 mV, sort by st_elevation_mv descending", color: "#7c3aed" },
    { icon: BarChart3, label: "QT stats by rhythm", query: "For each unique rhythm, calculate the average and maximum QT interval", color: "#00d4ff" },
    { icon: FileSearch, label: "Missing values", query: "Show all records that have missing values in pr_interval_ms or qt_interval_ms", color: "#10b981" },
    { icon: Zap, label: "Low O2 / noise filter", query: "Find records where noise_level is below 0.3 and heart rate is above 100 BPM", color: "#f97316" },
];

const DB_SUGGESTIONS = [
    { icon: AlertTriangle, label: "All anomalies", query: "Show me all records flagged as anomalies", color: "#ef4444" },
    { icon: Activity, label: "High heart rate", query: "Show patients with heart rate over 120", color: "#f59e0b" },
    { icon: TrendingUp, label: "Critical vitals", query: "Find patients with critical blood pressure readings", color: "#7c3aed" },
    { icon: BarChart3, label: "Top 10 threat scores", query: "Show the top 10 records by threat score", color: "#00d4ff" },
    { icon: FileSearch, label: "Missing data", query: "Show records that have missing values", color: "#10b981" },
    { icon: Zap, label: "Dangerous glucose", query: "Find patients with dangerous glucose levels above 300", color: "#f97316" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function TypingDots() {
    return (
        <div className="flex items-center gap-1 px-4 py-3">
            {[0, 1, 2].map((i) => (
                <motion.div key={i} className="w-2 h-2 rounded-full bg-[#00d4ff]"
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                />
            ))}
        </div>
    );
}

function CodeBadge({ code, label, onCopy }: { code: string; label: string; onCopy?: () => void }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        onCopy?.();
    };
    return (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 text-xs bg-[#0a0f1e] p-4 rounded-xl border border-[rgba(124,58,237,0.2)] font-mono overflow-x-auto group">
            <Code2 className="h-4 w-4 flex-shrink-0 mt-0.5 text-[#7c3aed]" />
            <div className="flex-1 min-w-0">
                <span className="text-[#7c3aed] font-bold uppercase tracking-wider text-[10px]">{label}</span>
                <pre className="text-[#f1f5f9] mt-1 leading-relaxed whitespace-pre-wrap break-all text-[11px]">{code}</pre>
            </div>
            <button onClick={handleCopy}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-[#00d4ff] text-[#64748b] flex-shrink-0">
                {copied ? <CheckCheck className="h-4 w-4 text-[#10b981]" /> : <Copy className="h-4 w-4" />}
            </button>
        </motion.div>
    );
}

function ResultSummary({ data, mode }: { data: unknown[]; mode: "dataset" | "database" }) {
    const cols = data.length > 0 ? Object.keys(data[0] as object).length : 0;
    return (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-wrap items-center gap-4 px-4 py-3 bg-[#10b981]/10 border border-[#10b981]/20 rounded-xl text-sm">
            <div className="flex items-center gap-2 text-[#10b981]">
                <CheckCheck className="h-4 w-4" />
                <span className="font-bold">Query Successful</span>
            </div>
            <div className="h-4 w-px bg-[rgba(255,255,255,0.1)]" />
            <span className="text-[#64748b]"><span className="text-[#f1f5f9] font-mono">{data.length}</span> rows</span>
            <span className="text-[#64748b]"><span className="text-[#f1f5f9] font-mono">{cols}</span> columns</span>
            <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${mode === "dataset"
                ? "text-[#00d4ff] border-[#00d4ff]/30 bg-[#00d4ff]/10"
                : "text-[#7c3aed] border-[#7c3aed]/30 bg-[#7c3aed]/10"
                }`}>
                {mode === "dataset" ? "Pandas · Uploaded Dataset" : "SQL · Database"}
            </span>
        </motion.div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ClinicalChat() {
    const [query, setQuery] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<QueryResult | null>(null);
    const [colDefs, setColDefs] = useState<{ field: string; headerName: string; sortable: boolean; filter: boolean; resizable: boolean; minWidth: number }[]>([]);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [errorCode, setErrorCode] = useState<string | null>(null);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [queryMode, setQueryMode] = useState<"dataset" | "database">("database");
    const [datasetLoaded, setDatasetLoaded] = useState(false);
    const [datasetInfo, setDatasetInfo] = useState<{ columns: string[]; rows: unknown[][] } | null>(null);

    // --- Voice Search States ---
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // ── Initialize Web Speech API ────────────────────────────────────────────
    useEffect(() => {
        if (typeof window !== "undefined") {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

            if (SpeechRecognition) {
                recognitionRef.current = new SpeechRecognition();
                recognitionRef.current.continuous = false;
                recognitionRef.current.interimResults = true;

                recognitionRef.current.onresult = (event: any) => {
                    let currentTranscript = '';
                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        currentTranscript += event.results[i][0].transcript;
                    }
                    setQuery(currentTranscript);
                };

                recognitionRef.current.onend = () => {
                    setIsListening(false);
                };
            }
        }
    }, []);

    // ── Toggle Voice Recognition ─────────────────────────────────────────────
    const toggleVoice = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
        } else {
            setQuery(''); // Clear input before starting
            recognitionRef.current?.start();
            setIsListening(true);
        }
    };

    // ── Detect if a dataset is loaded in localStorage ────────────────────────
    useEffect(() => {
        const stored = localStorage.getItem("medsentinel_dataset");
        if (stored) {
            try {
                const parsed = JSON.parse(stored) as Record<string, unknown>[];
                if (parsed.length > 0) {
                    const columns = Object.keys(parsed[0]);
                    const rows = parsed.map((row) => columns.map((col) => row[col]));
                    setDatasetInfo({ columns, rows });
                    setDatasetLoaded(true);
                    setQueryMode("dataset"); // auto-switch to dataset mode
                }
            } catch {
                setDatasetLoaded(false);
            }
        }
    }, []);

    const suggestions = queryMode === "dataset" ? DATASET_SUGGESTIONS : DB_SUGGESTIONS;

    const handleAskAI = async (q?: string) => {
        const queryText = (q || query).trim();
        if (!queryText || isLoading) return;

        // Stop listening if user submits while still talking
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
        }

        setIsLoading(true);
        setResult(null);
        setErrorMsg(null);
        setErrorCode(null);
        const startTime = Date.now();

        try {
            let response;

            if (queryMode === "dataset" && datasetInfo) {
                response = await axios.post(`${API_URL}/api/query-dataset`, {
                    question: queryText,
                    columns: datasetInfo.columns,
                    rows: datasetInfo.rows,
                });
            } else {
                response = await axios.post(`${API_URL}/api/query`, {
                    question: queryText,
                });
            }

            const data = response.data;

            if (data.data && data.data.length > 0) {
                setResult(data);
                setColDefs(
                    Object.keys(data.data[0]).map((key) => ({
                        field: key,
                        headerName: key.replace(/_/g, " ").toUpperCase(),
                        sortable: true,
                        filter: true,
                        resizable: true,
                        minWidth: key.length > 15 ? 200 : 130,
                    }))
                );
                setHistory((prev) => [
                    {
                        q: queryText,
                        rows: data.data.length,
                        time: Date.now() - startTime,
                        mode: queryMode,
                    },
                    ...prev.slice(0, 4),
                ]);
            } else {
                setResult({ data: [], row_count: 0, sql_executed: data.sql_executed || data.code_executed });
            }
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { detail?: { error?: string; code_executed?: string } | string } }; message?: string };
            const detail = axiosErr?.response?.data?.detail;

            if (detail && typeof detail === "object" && "error" in detail) {
                setErrorMsg(detail.error ?? "An unknown error occurred.");
                setErrorCode(detail.code_executed ?? null);
            } else if (typeof detail === "string") {
                setErrorMsg(detail);
            } else {
                setErrorMsg(axiosErr?.message ?? "Request failed. Is the backend running?");
            }
        } finally {
            setIsLoading(false);
            if (!q) setQuery("");
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") handleAskAI();
    };

    const clearAll = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
        }
        setResult(null);
        setErrorMsg(null);
        setErrorCode(null);
        setQuery("");
        inputRef.current?.focus();
    };

    const codeLabel =
        queryMode === "dataset"
            ? "AI-Generated Pandas Code"
            : "AI-Generated SQL";

    return (
        <div className="space-y-6">

            {/* ── Header ── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="absolute inset-0 bg-[#00d4ff] rounded-xl blur-lg opacity-20 animate-pulse" />
                        <div className="relative p-2.5 bg-[#00d4ff]/10 border border-[#00d4ff]/20 rounded-xl">
                            <BotMessageSquare className="h-6 w-6 text-[#00d4ff]" />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-[#f1f5f9]">Natural Language Data Agent</h2>
                        <p className="text-[#64748b] text-xs flex items-center gap-1.5 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse inline-block" />
                            Powered by Groq LLaMA · HIPAA Compliant
                        </p>
                    </div>
                </div>
                {(result !== null || errorMsg) && (
                    <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        onClick={clearAll}
                        className="flex items-center gap-2 text-xs text-[#64748b] hover:text-[#f1f5f9] transition-colors px-3 py-2 rounded-lg border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)]">
                        <RotateCcw className="h-3.5 w-3.5" /> New Query
                    </motion.button>
                )}
            </div>

            {/* ── Mode Toggle ── */}
            <div className="flex items-center gap-2 bg-[#111827] border border-[rgba(255,255,255,0.06)] p-1 rounded-xl w-fit">
                <button
                    onClick={() => { setQueryMode("dataset"); clearAll(); }}
                    disabled={!datasetLoaded}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${queryMode === "dataset"
                        ? "bg-[#00d4ff] text-[#0a0f1e] shadow-[0_0_10px_rgba(0,212,255,0.3)]"
                        : "text-[#64748b] hover:text-[#f1f5f9] disabled:opacity-40 disabled:cursor-not-allowed"
                        }`}
                >
                    <UploadCloud className="h-3.5 w-3.5" />
                    Uploaded Dataset
                    {datasetLoaded && queryMode !== "dataset" && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] inline-block" />
                    )}
                </button>
                <button
                    onClick={() => { setQueryMode("database"); clearAll(); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${queryMode === "database"
                        ? "bg-[#7c3aed] text-white shadow-[0_0_10px_rgba(124,58,237,0.3)]"
                        : "text-[#64748b] hover:text-[#f1f5f9]"
                        }`}
                >
                    <Database className="h-3.5 w-3.5" />
                    PostgreSQL Database
                </button>
            </div>

            {/* ── Dataset info banner ── */}
            {queryMode === "dataset" && datasetInfo && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 px-4 py-3 bg-[#00d4ff]/5 border border-[#00d4ff]/15 rounded-xl text-xs">
                    <Info className="h-4 w-4 text-[#00d4ff] flex-shrink-0" />
                    <span className="text-[#64748b]">
                        Dataset loaded:
                        <span className="text-[#f1f5f9] font-mono ml-1">{datasetInfo.rows.length.toLocaleString()} rows</span>
                        <span className="mx-1 text-[#64748b]">·</span>
                        <span className="text-[#f1f5f9] font-mono">{datasetInfo.columns.length} columns</span>
                        <span className="mx-1 text-[#64748b]">·</span>
                        <span className="text-[#00d4ff]">{datasetInfo.columns.join(", ")}</span>
                    </span>
                </motion.div>
            )}

            {!datasetLoaded && queryMode === "dataset" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex items-center gap-3 px-4 py-3 bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded-xl text-xs text-[#f59e0b]">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    No dataset loaded. Go to <strong className="mx-1">Upload Dataset</strong> first to query your own data.
                </motion.div>
            )}

            {/* ── AI Suggestions ── */}
            <div>
                <p className="text-[#64748b] text-xs font-mono uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Sparkles className="h-3 w-3 text-[#00d4ff]" />
                    {queryMode === "dataset" ? "ECG / Dataset Suggestions" : "Database Suggestions"}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {suggestions.map((s, i) => {
                        const Icon = s.icon;
                        return (
                            <motion.button key={i}
                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.06 }}
                                whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}
                                onClick={() => handleAskAI(s.query)}
                                disabled={isLoading || (queryMode === "dataset" && !datasetLoaded)}
                                className="flex items-center gap-2.5 p-3 bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-xl text-left hover:border-[rgba(255,255,255,0.15)] transition-all group disabled:opacity-40 disabled:cursor-not-allowed">
                                <div className="p-1.5 rounded-lg flex-shrink-0" style={{ background: `${s.color}15`, border: `1px solid ${s.color}25` }}>
                                    <Icon className="h-3.5 w-3.5" style={{ color: s.color }} />
                                </div>
                                <span className="text-[#f1f5f9] text-xs font-medium group-hover:text-[#00d4ff] transition-colors line-clamp-1">{s.label}</span>
                                <ChevronRight className="h-3 w-3 text-[#64748b] ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                            </motion.button>
                        );
                    })}
                </div>
            </div>

            {/* ── Search Input with Voice ── */}
            <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-[#00d4ff]/10 to-[#7c3aed]/10 rounded-2xl blur-sm opacity-0 group-focus-within:opacity-100 transition-opacity" />
                <div className="relative flex items-center bg-[#111827] border border-[rgba(255,255,255,0.08)] group-focus-within:border-[rgba(0,212,255,0.4)] rounded-2xl transition-all overflow-hidden">
                    <Search className="h-5 w-5 text-[#64748b] ml-4 flex-shrink-0 hidden sm:block" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={
                            queryMode === "dataset"
                                ? "e.g. Show patients with AFib and heart rate > 100..."
                                : "e.g. Show all anomalies with threat score above 70..."
                        }
                        className="flex-1 pl-4 sm:pl-3 pr-4 py-4 bg-transparent outline-none text-[#f1f5f9] placeholder-[#64748b] text-sm"
                        disabled={isLoading}
                    />

                    {/* Voice Button */}
                    <button
                        onClick={toggleVoice}
                        className={`p-2.5 rounded-full transition-all duration-300 flex-shrink-0 ${isListening
                            ? "bg-red-500 text-white animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                            : "text-[#64748b] hover:text-[#00d4ff] hover:bg-[#00d4ff]/10"
                            }`}
                        title={isListening ? "Stop listening" : "Start Voice Query"}
                    >
                        <Mic className="h-5 w-5" />
                    </button>

                    {/* Submit Button */}
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleAskAI()}
                        disabled={isLoading || !query.trim() || (queryMode === "dataset" && !datasetLoaded)}
                        className="m-2 ml-1 flex items-center gap-2 px-5 py-2.5 bg-[#00d4ff] hover:bg-[#00d4ff]/80 text-[#0a0f1e] rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(0,212,255,0.3)]">
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        <span className="hidden sm:block">{isLoading ? "Analyzing…" : "Ask AI"}</span>
                    </motion.button>
                </div>
            </div>

            {/* ── Loading state ── */}
            <AnimatePresence>
                {isLoading && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="bg-[#111827] border border-[rgba(0,212,255,0.15)] rounded-2xl p-4 flex items-center gap-4">
                        <div className="p-2 bg-[#00d4ff]/10 rounded-xl">
                            <BotMessageSquare className="h-5 w-5 text-[#00d4ff]" />
                        </div>
                        <div>
                            <p className="text-[#f1f5f9] text-sm font-medium">
                                {queryMode === "dataset"
                                    ? "Groq is generating Pandas analysis code for your dataset…"
                                    : "Groq is translating your question to SQL…"}
                            </p>
                            <p className="text-[#64748b] text-xs mt-0.5">
                                {queryMode === "dataset"
                                    ? "NL → Pandas → execute → results"
                                    : "NL → SQL → PostgreSQL → results"}
                            </p>
                        </div>
                        <div className="ml-auto"><TypingDots /></div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Error ── */}
            <AnimatePresence>
                {errorMsg && (
                    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                        className="space-y-3">
                        <div className="bg-[#ef4444]/10 border border-[#ef4444]/20 text-[#ef4444] px-5 py-4 rounded-2xl flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-sm">Query Failed</p>
                                <p className="text-sm opacity-80 mt-1">{errorMsg}</p>
                            </div>
                        </div>
                        {errorCode && (
                            <CodeBadge code={errorCode} label="Failed Code (debug)" />
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Code badge ── */}
            <AnimatePresence>
                {result?.sql_executed && (
                    <CodeBadge code={result.sql_executed} label={codeLabel} />
                )}
            </AnimatePresence>

            {/* ── Results grid ── */}
            <AnimatePresence>
                {result !== null && !isLoading && (
                    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="space-y-4">
                        {result.data.length > 0 ? (
                            <>
                                <div className="flex items-center justify-between gap-4 flex-wrap">
                                    <ResultSummary data={result.data} mode={queryMode} />

                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => downloadCSV(result.data, 'medsentinel_query')}
                                        className="flex items-center gap-2 px-4 py-2 bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-xl text-xs font-bold text-[#f1f5f9] hover:border-[#00d4ff] hover:text-[#00d4ff] transition-all shadow-sm"
                                    >
                                        <Download className="h-4 w-4" />
                                        Download CSV
                                    </motion.button>
                                </div>
                                <div
                                    className="ag-theme-alpine-dark w-full rounded-2xl overflow-hidden border border-[rgba(255,255,255,0.06)]"
                                    style={{ height: Math.min(460, 80 + result.data.length * 44) }}
                                >
                                    <AgGridReact
                                        rowData={result.data as Record<string, unknown>[]}
                                        columnDefs={colDefs}
                                        pagination={result.data.length > 15}
                                        paginationPageSize={15}
                                        suppressCellFocus
                                        theme="legacy"
                                        rowStyle={{ background: "transparent" }}
                                    />
                                </div>
                            </>
                        ) : (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                className="py-12 text-center bg-[#111827] border border-[rgba(255,255,255,0.06)] rounded-2xl">
                                <Database className="h-10 w-10 text-[#64748b] mx-auto mb-3" />
                                <p className="text-[#f1f5f9] font-bold">No results found</p>
                                <p className="text-[#64748b] text-sm mt-1">Try rephrasing your query or broadening the filter conditions.</p>
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Query History ── */}
            {history.length > 0 && !isLoading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="border-t border-[rgba(255,255,255,0.06)] pt-4">
                    <p className="text-[#64748b] text-xs font-mono uppercase tracking-widest mb-3">Recent Queries</p>
                    <div className="space-y-2">
                        {history.map((h, i) => (
                            <motion.button key={i}
                                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                onClick={() => { setQueryMode(h.mode); handleAskAI(h.q); }}
                                className="w-full flex items-center gap-3 px-4 py-3 bg-[#111827] border border-[rgba(255,255,255,0.04)] rounded-xl text-left hover:border-[rgba(0,212,255,0.15)] transition-all group">
                                <RotateCcw className="h-3.5 w-3.5 text-[#64748b] flex-shrink-0" />
                                <span className="text-[#f1f5f9] text-sm truncate flex-1">{h.q}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${h.mode === "dataset" ? "text-[#00d4ff] bg-[#00d4ff]/10" : "text-[#7c3aed] bg-[#7c3aed]/10"}`}>
                                    {h.mode === "dataset" ? "Pandas" : "SQL"}
                                </span>
                                <span className="text-[#64748b] text-xs font-mono flex-shrink-0">{h.rows}r · {h.time}ms</span>
                                <ChevronRight className="h-3.5 w-3.5 text-[#64748b] opacity-0 group-hover:opacity-100 transition-opacity" />
                            </motion.button>
                        ))}
                    </div>
                </motion.div>
            )}
        </div>
    );
}