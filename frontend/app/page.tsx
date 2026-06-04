"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { motion, useInView, animate, AnimatePresence } from "framer-motion";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
    UploadCloud, Activity, ShieldCheck, Lock, Zap,
    Database, Server, Code, Sparkles, AlertTriangle,
    BotMessageSquare, FileText, ArrowRight, FileSearch, ArrowUp, X, CheckCircle, BrainCircuit, HeartPulse, Mic
} from "lucide-react";
import {
    AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar,
    XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

// ============================================================================
// GLOBAL STYLES & KEYFRAMES
// ============================================================================
const customStyles = `
  @keyframes ambientShift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-12px); }
  }
  @keyframes breathe {
    0%, 100% { box-shadow: 0 0 20px rgba(0,212,255,0.4); }
    50% { box-shadow: 0 0 45px rgba(0,212,255,0.8); }
  }
  @keyframes pulse-dot {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.5); opacity: 0.5; }
  }
  .ambient-mesh {
    background: 
      radial-gradient(circle at 20% 30%, rgba(0, 212, 255, 0.15) 0%, transparent 50%),
      radial-gradient(circle at 80% 70%, rgba(124, 58, 237, 0.12) 0%, transparent 50%);
    background-size: 200% 200%;
    animation: ambientShift 15s ease infinite;
  }
  .dot-pattern {
    background-image: radial-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px);
    background-size: 16px 16px;
  }
`;

// ============================================================================
// MOCK DATA CONSTANTS
// ============================================================================
const AREA_DATA = [
    { t: '01', val: 72 }, { t: '02', val: 75 }, { t: '03', val: 80 }, { t: '04', val: 78 },
    { t: '05', val: 185 }, { t: '06', val: 190 }, { t: '07', val: 82 }, { t: '08', val: 79 },
    { t: '09', val: 76 }, { t: '10', val: 75 }, { t: '11', val: 77 }, { t: '12', val: 74 },
    { t: '13', val: 170 }, { t: '14', val: 78 }, { t: '15', val: 72 }
];

const PIE_DATA = [
    { name: 'Normal', value: 72 },
    { name: 'Moderate Risk', value: 18 },
    { name: 'Critical', value: 10 }
];

const BAR_DATA = [
    { range: '0-10', count: 420 }, { range: '10-20', count: 210 }, { range: '20-30', count: 120 },
    { range: '30-40', count: 65 }, { range: '40-50', count: 32 }, { range: '50-60', count: 18 },
    { range: '60-80', count: 12 }, { range: '80+', count: 4 },
];

const TABLE_DATA = [
    { id: 'PT-88392-A', vital: 'Heart Rate', val: '192 bpm', score: 94, status: 'CRITICAL', color: 'danger' },
    { id: 'PT-11204-X', vital: 'O2 Saturation', val: '86 %', score: 68, status: 'WARNING', color: 'warning' },
    { id: 'PT-44910-B', vital: 'Temperature', val: '104.2 °F', score: 82, status: 'CRITICAL', color: 'danger' },
    { id: 'PT-99381-C', vital: 'Blood Pressure', val: '120/80', score: 5, status: 'CLEAN', color: 'success' },
];

const FAKE_RESPONSE_TEXT = "Based on my analysis, patient PT-106 shows severe temporal inconsistencies across multiple vital sign streams. The recorded heart rate of 190 bpm coupled with an impossible glucose variation strongly indicates sensor misalignment or data corruption. I have flagged this record with a Threat Score of 94.";

const INITIAL_CHAT_STATE = [
    { type: "bot", text: "👋 Hi! I'm your MedSentinel AI. I can help you analyze clinical data, explain anomalies, and guide you through the platform." },
    { type: "user", text: "What anomaly types can you detect?" },
    { type: "bot", text: "I detect: cardiovascular irregularities, lab value outliers, impossible physiological values, duplicate records, and temporal inconsistencies in EHR data." }
];

// ============================================================================
// REUSABLE COMPONENTS
// ============================================================================
function ParticleBackground() {
    const count = 3000;
    const mesh = useRef<THREE.Points>(null);

    const particlesPosition = useMemo(() => {
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count * 3; i++) {
            positions[i] = (Math.random() - 0.5) * 15;
        }
        return positions;
    }, [count]);

    useFrame((state) => {
        if (mesh.current) {
            mesh.current.rotation.y = state.clock.getElapsedTime() * 0.05;
            mesh.current.rotation.x = state.clock.getElapsedTime() * 0.02;
        }
    });

    return (
        <points ref={mesh}>
            <bufferGeometry>
                <bufferAttribute attach="attributes-position" count={count} array={particlesPosition} itemSize={3} />
            </bufferGeometry>
            <pointsMaterial size={0.02} color="#00d4ff" transparent opacity={0.6} sizeAttenuation />
        </points>
    );
}

function AnimatedCounter({ from, to, suffix = "", duration = 2 }: { from: number, to: number, suffix?: string, duration?: number }) {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-50px" });
    const [value, setValue] = useState(from);

    useEffect(() => {
        if (isInView) {
            const controls = animate(from, to, {
                duration,
                ease: "easeOut",
                onUpdate: (val) => setValue(Number(val.toFixed(to % 1 !== 0 ? 1 : 0)))
            });
            return controls.stop;
        }
    }, [isInView, from, to, duration]);

    return <span ref={ref}>{value.toLocaleString()}{suffix}</span>;
}

// ============================================================================
// MAIN PAGE
// ============================================================================
export default function LandingPage() {
    // --- Hook States ---
    const [text, setText] = useState("");
    const [phraseIndex, setPhraseIndex] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showTopBtn, setShowTopBtn] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [typedResponse, setTypedResponse] = useState("");

    // --- Interactive Chat & Voice States ---
    const [chatMessages, setChatMessages] = useState(INITIAL_CHAT_STATE);
    const [chatInput, setChatInput] = useState("");
    const [isListening, setIsListening] = useState(false);

    const chatEndRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null); // Ref for Web Speech API
    const inlineChatRef = useRef<HTMLDivElement>(null);

    const isInlineChatInView = useInView(inlineChatRef, { once: true, margin: "-100px" });
    const phrases = ["Anomaly Detection", "Data Cleaning", "Missing Value Handling", "Clinical AI Insights"];

    // Initialize Web Speech API
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
                    setChatInput(currentTranscript);
                };

                recognitionRef.current.onend = () => {
                    setIsListening(false);
                };
            }
        }
    }, []);

    // Toggle Voice Recognition
    const toggleVoice = () => {
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
        } else {
            setChatInput('');
            recognitionRef.current?.start();
            setIsListening(true);
        }
    };

    // Auto-scroll chat to bottom
    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [chatMessages, isChatOpen]);

    // Handle Chat Submit
    const handleSendChat = () => {
        if (!chatInput.trim()) return;

        // Stop listening if user submits while talking
        if (isListening) {
            recognitionRef.current?.stop();
            setIsListening(false);
        }

        // Add user message
        const newMessages = [...chatMessages, { type: "user", text: chatInput }];
        setChatMessages(newMessages);
        setChatInput("");

        // Simulate Bot Typing/Response
        setTimeout(() => {
            setChatMessages(prev => [...prev, {
                type: "bot",
                text: "I am currently in landing-page demo mode! To process real data and unlock my full ML capabilities, please head over to the Upload Dataset page. 🚀"
            }]);
        }, 1200);
    };

    // Typewriter Effect
    useEffect(() => {
        const timeout = setTimeout(() => {
            const currentPhrase = phrases[phraseIndex];
            if (isDeleting) {
                setText(currentPhrase.substring(0, text.length - 1));
                if (text === "") {
                    setIsDeleting(false);
                    setPhraseIndex((prev) => (prev + 1) % phrases.length);
                }
            } else {
                setText(currentPhrase.substring(0, text.length + 1));
                if (text === currentPhrase) {
                    setTimeout(() => setIsDeleting(true), 2000);
                }
            }
        }, isDeleting ? 40 : 80);
        return () => clearTimeout(timeout);
    }, [text, isDeleting, phraseIndex]);

    // Back to top scroll listener
    useEffect(() => {
        const handleScroll = () => setShowTopBtn(window.scrollY > 400);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const goToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

    // Inline Chat Typing Animation Effect
    useEffect(() => {
        if (isInlineChatInView) {
            let i = 0;
            const typingInterval = setInterval(() => {
                setTypedResponse(FAKE_RESPONSE_TEXT.substring(0, i));
                i++;
                if (i > FAKE_RESPONSE_TEXT.length) clearInterval(typingInterval);
            }, 30);
            return () => clearInterval(typingInterval);
        }
    }, [isInlineChatInView]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="min-h-screen bg-background text-accent overflow-hidden font-sans relative"
        >
            <style>{customStyles}</style>

            {/* ================= SECTION 1: HERO ================= */}
            <section className="relative min-h-[100vh] flex flex-col items-center justify-center border-b border-border overflow-hidden pt-20 pb-20">
                <div className="absolute inset-0 z-0 opacity-60">
                    <Canvas camera={{ position: [0, 0, 5] }}>
                        <ParticleBackground />
                    </Canvas>
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background z-10" />
                </div>

                <div className="ambient-mesh absolute inset-0 z-10 opacity-100 pointer-events-none" />

                <div className="relative z-20 max-w-5xl mx-auto px-4 text-center space-y-8 flex-grow flex flex-col justify-center items-center">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="inline-flex items-center space-x-2 bg-surface-2/80 backdrop-blur-sm border border-primary/30 text-primary px-4 py-2 rounded-full text-sm font-medium shadow-[0_0_15px_rgba(0,212,255,0.2)]"
                    >
                        <ShieldCheck className="h-4 w-4" />
                        <span>HIPAA Compliant · AI Powered</span>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="text-5xl md:text-7xl font-bold tracking-tight text-accent leading-tight"
                    >
                        Detect Medical Data Anomalies <br className="hidden md:block" />
                        Before They Become <span className="text-primary drop-shadow-[0_0_15px_rgba(0,212,255,0.5)]">Disasters</span>
                    </motion.h1>

                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                        className="text-xl md:text-2xl text-muted h-8"
                    >
                        Enterprise-grade machine learning for <span className="text-secondary font-medium">{text}</span><span className="animate-pulse">|</span>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.3 }}
                        className="flex flex-col items-center space-y-6 pt-8 w-full"
                    >
                        <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6 w-full">
                            <Link href="/upload" className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-primary text-[#0a0f1e] px-8 py-4 rounded-xl font-bold transition-all animate-[breathe_3s_infinite_ease-in-out]">
                                <UploadCloud className="h-5 w-5" />
                                <span>Upload Your Dataset</span>
                            </Link>
                            <Link href="/dashboard" className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-transparent hover:bg-surface-2 border border-border text-accent px-8 py-4 rounded-xl font-medium transition-all">
                                <Activity className="h-5 w-5 text-primary" />
                                <span>View Live Demo</span>
                            </Link>
                        </div>

                        <div className="flex flex-wrap justify-center gap-3 pt-4">
                            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full border border-border bg-surface-2/50 backdrop-blur-sm text-xs text-muted font-medium">
                                <Lock className="h-3 w-3 text-secondary" /><span>AES-256 Encrypted</span>
                            </div>
                            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full border border-border bg-surface-2/50 backdrop-blur-sm text-xs text-muted font-medium">
                                <Zap className="h-3 w-3 text-primary" /><span>&lt;50ms Latency</span>
                            </div>
                            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full border border-border bg-surface-2/50 backdrop-blur-sm text-xs text-muted font-medium">
                                <ShieldCheck className="h-3 w-3 text-success" /><span>HIPAA Compliant</span>
                            </div>
                        </div>
                    </motion.div>
                </div>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="absolute bottom-8 right-8 z-30 bg-surface/40 backdrop-blur-md border border-border px-5 py-3 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex items-center space-x-4 animate-[float_4s_infinite_ease-in-out] hidden md:flex"
                >
                    <div className="relative flex h-3 w-3">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75" style={{ animation: 'pulse-dot 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
                    </div>
                    <div className="flex flex-col text-left">
                        <span className="text-xs font-bold text-accent uppercase tracking-wider">Live Monitoring Active</span>
                        <span className="text-sm font-mono text-muted mt-0.5">
                            2,847 records <span className="mx-1 text-border">|</span> <span className="text-danger font-bold">12</span> anomalies
                        </span>
                    </div>
                </motion.div>
            </section>

            {/* ================= SECTION 2: LIVE DASHBOARD PREVIEW ================= */}
            <section className="py-24 bg-surface relative z-20 border-b border-border overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 space-y-12 relative z-10">
                    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center space-y-4">
                        <h2 className="text-3xl md:text-5xl font-bold text-accent"> Clinical Intelligence</h2>
                        <p className="text-muted max-w-2xl mx-auto text-lg">See anomalies the moment they appear in your EHR data. Our engine processes streaming telemetry instantly.</p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                        className="bg-background border border-primary/20 rounded-2xl shadow-[0_0_40px_rgba(0,212,255,0.1)] p-6 md:p-8 relative overflow-hidden"
                    >
                        <div className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent animate-[shimmer_3s_infinite_linear] opacity-30 pointer-events-none" />

                        <div className="flex justify-between items-center mb-8 pb-4 border-b border-border relative z-10">
                            <div className="flex items-center space-x-3">
                                <Database className="h-5 w-5 text-primary" />
                                <span className="font-bold text-accent">ICU Telemetry Stream</span>
                            </div>
                            <div className="flex items-center space-x-2 bg-success/10 border border-success/20 px-3 py-1 rounded-full text-xs font-bold text-success uppercase tracking-widest">
                                <span className="relative flex h-2 w-2 mr-1">
                                    <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75" style={{ animation: 'pulse-dot 1.5s infinite' }}></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                                </span>
                                Live Sync
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 relative z-10">
                            {/* Panel A */}
                            <div className="bg-surface border border-border rounded-xl p-4 flex flex-col justify-between">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="text-sm font-bold text-muted uppercase tracking-wide">Heart Rate (bpm)</h4>
                                    <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-danger opacity-75" style={{ animation: 'pulse-dot 1s infinite' }}></span><span className="relative inline-flex rounded-full h-2 w-2 bg-danger"></span></span>
                                </div>
                                <div className="h-[180px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={AREA_DATA}>
                                            <defs>
                                                <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <XAxis dataKey="t" hide />
                                            <YAxis domain={[40, 200]} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                            <RechartsTooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#1a2235' }} />
                                            <ReferenceLine y={150} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: '⚠ Threshold', fill: '#ef4444', fontSize: 10 }} />
                                            <Area type="monotone" dataKey="val" stroke="#00d4ff" fillOpacity={1} fill="url(#colorVal)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Panel B */}
                            <div className="bg-surface border border-border rounded-xl p-4 flex flex-col items-center justify-between">
                                <h4 className="text-sm font-bold text-muted uppercase tracking-wide w-full text-left mb-2">Threat Distribution</h4>
                                <div className="h-[180px] w-full relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={PIE_DATA} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value" stroke="none">
                                                <Cell fill="#10b981" />
                                                <Cell fill="#f59e0b" />
                                                <Cell fill="#ef4444" />
                                            </Pie>
                                            <RechartsTooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#1a2235', borderRadius: '8px' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className="text-xl font-bold text-accent">847</span>
                                        <span className="text-[10px] text-muted uppercase">Records</span>
                                    </div>
                                </div>
                            </div>

                            {/* Panel C */}
                            <div className="bg-surface border border-border rounded-xl p-4 flex flex-col justify-between">
                                <h4 className="text-sm font-bold text-muted uppercase tracking-wide mb-2">Threat Score Histogram</h4>
                                <div className="h-[180px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={BAR_DATA}>
                                            <XAxis dataKey="range" tick={{ fontSize: 9, fill: '#64748b' }} interval={0} axisLine={false} tickLine={false} />
                                            <YAxis hide />
                                            <RechartsTooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ backgroundColor: '#111827', borderColor: '#1a2235' }} />
                                            <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                                                {BAR_DATA.map((_, index) => (
                                                    <Cell key={`cell-${index}`} fill={index > 4 ? '#ef4444' : '#00d4ff'} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="bg-surface border border-border rounded-xl overflow-x-auto relative z-10">
                            <table className="min-w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-surface-2 text-muted font-mono text-[10px] uppercase tracking-widest border-b border-border">
                                    <tr>
                                        <th className="px-6 py-3">Patient ID</th>
                                        <th className="px-6 py-3">Vital Sign</th>
                                        <th className="px-6 py-3">Value</th>
                                        <th className="px-6 py-3">Threat Score</th>
                                        <th className="px-6 py-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50 text-accent font-medium">
                                    {TABLE_DATA.map((row, i) => (
                                        <tr key={i} className="hover:bg-surface-2/30 transition-colors">
                                            <td className="px-6 py-3 font-mono text-muted">{row.id}</td>
                                            <td className="px-6 py-3">{row.vital}</td>
                                            <td className={`px-6 py-3 font-bold text-${row.color}`}>{row.val}</td>
                                            <td className="px-6 py-3">
                                                <div className="flex items-center space-x-2">
                                                    <div className="w-16 h-1.5 bg-background rounded-full overflow-hidden">
                                                        <div className={`h-full bg-${row.color}`} style={{ width: `${row.score}%` }}></div>
                                                    </div>
                                                    <span className="font-mono text-xs">{row.score}/100</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3">
                                                <span className={`px-2 py-1 bg-${row.color}/10 text-${row.color} border border-${row.color}/20 rounded-md text-[10px] font-bold`}>{row.status}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                </div>
            </section>



            {/* ================= SECTION 3: FEATURES GRID ================= */}
            <section className="py-24 bg-surface relative">
                <div className="max-w-7xl mx-auto px-4">
                    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center space-y-4 mb-16">
                        <h2 className="text-3xl md:text-5xl font-bold text-accent">The Intelligence Engine</h2>
                        <p className="text-muted max-w-2xl mx-auto text-lg">A comprehensive suite of tools designed specifically for the rigorous demands of modern clinical data processing.</p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            { icon: UploadCloud, title: "Smart Upload", desc: "Drag and drop CSV or FHIR datasets. Secure vault encryption happens client-side." },
                            { icon: AlertTriangle, title: "Isolation Forest Detection", desc: "Unsupervised ML hunts across multiple variables simultaneously to find hidden threats." },
                            { icon: Sparkles, title: "Auto Data Cleaning", desc: "Automatically formats timestamps, standardizes units, and drops duplicate MRNs." },
                            { icon: Database, title: "Missing Value Imputation", desc: "Uses KNN and clinical logic to fill in the blanks without corrupting your dataset." },
                            { icon: BotMessageSquare, title: "AI Clinical Explanations", desc: "Groq LLaMA models act as your CMO, explaining exactly WHY a record was flagged." },
                            { icon: FileText, title: "PDF Report Export", desc: "Generate instant, board-ready clinical compliance reports with a single click." }
                        ].map((feature, i) => {
                            const Icon = feature.icon;
                            return (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 30 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.1 }}
                                    whileHover={{ scale: 1.02 }}
                                    className="group bg-surface-2 border border-border p-8 rounded-2xl transition-all duration-300 hover:border-primary hover:shadow-[0_0_25px_rgba(0,212,255,0.15)] relative overflow-hidden dot-pattern"
                                >
                                    <div className="absolute top-0 left-0 w-1 h-full bg-primary transform scale-y-0 group-hover:scale-y-100 transition-transform origin-top duration-300" />
                                    <Icon className="h-10 w-10 text-primary mb-6 relative z-10 transition-transform duration-300 group-hover:scale-110" />
                                    <h3 className="text-xl font-bold text-accent mb-3 relative z-10">{feature.title}</h3>
                                    <p className="text-muted leading-relaxed relative z-10">{feature.desc}</p>
                                    <div className="mt-8 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-primary text-xs font-bold uppercase tracking-wider relative z-10 cursor-pointer">
                                        <span>Learn more</span>
                                        <ArrowRight className="h-4 w-4" />
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ================= SECTION 4: HEALTHCARE DATA SHOWCASE ================= */}
            <section className="py-24 bg-background relative z-20 border-b border-border overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 space-y-16 relative z-10">
                    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center space-y-4">
                        <h2 className="text-3xl md:text-5xl font-bold text-accent">From Raw EHR Data to Clinical Intelligence</h2>
                        <p className="text-muted max-w-2xl mx-auto text-lg">MedSentinel processes your messy, incomplete medical datasets and automatically surfaces what matters.</p>
                    </motion.div>

                    <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto_1fr] gap-8 items-center">
                        {/* LEFT COLUMN */}
                        <motion.div
                            initial={{ opacity: 0, x: -30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                            className="bg-surface border border-danger/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(239,68,68,0.05)] flex flex-col h-full"
                        >
                            <div className="bg-danger/10 border border-danger/20 text-danger px-4 py-3 rounded-xl flex items-center justify-center space-x-2 text-sm font-bold mb-6">
                                <AlertTriangle className="h-5 w-5" /><span>⚠ 23 Critical Formatting Issues Detected</span>
                            </div>
                            <h3 className="text-lg font-bold text-accent mb-4 font-mono text-center">Before: Raw EHR Export.csv</h3>
                            <div className="overflow-x-auto rounded-xl border border-border bg-surface-2/50">
                                <table className="min-w-full text-left text-xs md:text-sm font-mono whitespace-nowrap">
                                    <thead className="bg-surface text-muted uppercase tracking-wider border-b border-border">
                                        <tr><th className="p-3">patient_id</th><th className="p-3">heart_rate</th><th className="p-3">bp_sys</th><th className="p-3">glucose</th><th className="p-3">temp</th><th className="p-3">o2_sat</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50 text-accent">
                                        <tr><td className="p-3 text-muted">PT-101</td><td className="p-3">72</td><td className="p-3">120/80</td><td className="p-3">95</td><td className="p-3">98.6</td><td className="p-3">99</td></tr>
                                        <tr><td className="p-3 text-muted">PT-102</td><td className="p-3 bg-danger/20 text-danger font-bold text-center border border-danger/30 rounded shadow-inner">—</td><td className="p-3">118/76</td><td className="p-3">105</td><td className="p-3">99.1</td><td className="p-3">98</td></tr>
                                        <tr><td className="p-3 text-muted">PT-103</td><td className="p-3">115</td><td className="p-3">140/90</td><td className="p-3 bg-danger/20 text-danger font-bold flex items-center gap-1 border border-danger/30 rounded"><AlertTriangle className="h-3 w-3" /> 0</td><td className="p-3">102.4</td><td className="p-3 bg-danger/20 text-danger font-bold border border-danger/30 rounded"><div className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> 12</div></td></tr>
                                        <tr className="border-l-4 border-l-warning bg-warning/5 relative">
                                            <td className="p-3 font-bold text-warning flex items-center gap-2">PT-103 <span className="bg-warning text-[#0a0f1e] text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider hidden sm:inline-block">Duplicate</span></td><td className="p-3 text-warning">115</td><td className="p-3 text-warning">140/90</td><td className="p-3 text-warning">0</td><td className="p-3 text-warning">102.4</td><td className="p-3 text-warning">12</td>
                                        </tr>
                                        <tr><td className="p-3 text-muted">PT-105</td><td className="p-3">68</td><td className="p-3">110/70</td><td className="p-3">92</td><td className="p-3 bg-danger/20 text-danger font-bold text-center border border-danger/30 rounded shadow-inner">—</td><td className="p-3">97</td></tr>
                                        <tr><td className="p-3 text-muted">PT-106</td><td className="p-3 font-bold">190</td><td className="p-3 font-bold">180/110</td><td className="p-3">145</td><td className="p-3 font-bold">101.2</td><td className="p-3 font-bold">88</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>

                        {/* MIDDLE: Animated Arrow */}
                        <div className="hidden xl:flex flex-col items-center justify-center relative w-24 h-full">
                            <div className="w-full h-1 bg-surface-2 rounded-full relative overflow-hidden flex items-center">
                                <motion.div initial={{ x: "-100%" }} animate={{ x: "100%" }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} className="w-full h-full bg-gradient-to-r from-transparent via-primary to-transparent" />
                            </div>
                            <ArrowRight className="absolute text-primary right-0 h-8 w-8 translate-x-2 bg-background rounded-full p-1 border border-border" />
                        </div>

                        {/* RIGHT COLUMN */}
                        <motion.div
                            initial={{ opacity: 0, x: 30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="bg-surface border border-success/30 rounded-2xl p-6 shadow-[0_0_30px_rgba(16,185,129,0.05)] flex flex-col h-full relative overflow-hidden"
                        >
                            <div className="bg-success/10 border border-success/20 text-success px-4 py-3 rounded-xl flex items-center justify-center space-x-2 text-sm font-bold mb-6">
                                <ShieldCheck className="h-5 w-5" /><span>✓ Dataset Cleaned · 3 Anomalies Flagged</span>
                            </div>
                            <h3 className="text-lg font-bold text-accent mb-4 font-mono text-center">After: Normalized & Scored</h3>
                            <div className="overflow-x-auto rounded-xl border border-border bg-surface-2/50 relative z-10">
                                <table className="min-w-full text-left text-xs md:text-sm font-mono whitespace-nowrap">
                                    <thead className="bg-surface text-muted uppercase tracking-wider border-b border-border">
                                        <tr><th className="p-3">patient_id</th><th className="p-3">heart_rate</th><th className="p-3">glucose</th><th className="p-3">o2_sat</th><th className="p-3 bg-primary/10 text-primary border-l border-primary/20">Threat Score</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50 text-accent">
                                        <tr>
                                            <td className="p-3 text-muted">PT-101</td><td className="p-3">72</td><td className="p-3">95</td><td className="p-3">99</td>
                                            <td className="p-3 border-l border-border bg-surface"><div className="flex items-center gap-2"><div className="w-12 h-1.5 bg-background rounded-full overflow-hidden"><div className="h-full bg-success w-[12%]"></div></div> <span className="text-[10px] text-muted">12</span></div></td>
                                        </tr>
                                        <tr>
                                            <td className="p-3 text-muted">PT-102</td><td className="p-3 bg-success/20 text-success font-bold border border-success/30 rounded">78 ✓</td><td className="p-3">105</td><td className="p-3">98</td>
                                            <td className="p-3 border-l border-border bg-surface"><div className="flex items-center gap-2"><div className="w-12 h-1.5 bg-background rounded-full overflow-hidden"><div className="h-full bg-success w-[15%]"></div></div> <span className="text-[10px] text-muted">15</span></div></td>
                                        </tr>
                                        <tr className="bg-warning/5">
                                            <td className="p-3 text-muted">PT-103</td><td className="p-3">115</td><td className="p-3 bg-success/20 text-success font-bold border border-success/30 rounded">102 ✓</td><td className="p-3 bg-success/20 text-success font-bold border border-success/30 rounded">96 ✓</td>
                                            <td className="p-3 border-l border-border bg-surface"><div className="flex items-center gap-2"><div className="w-12 h-1.5 bg-background rounded-full overflow-hidden"><div className="h-full bg-warning w-[65%]"></div></div> <span className="text-[10px] text-warning font-bold">65</span></div></td>
                                        </tr>
                                        <tr>
                                            <td className="p-3 text-muted">PT-105</td><td className="p-3">68</td><td className="p-3">92</td><td className="p-3">97</td>
                                            <td className="p-3 border-l border-border bg-surface"><div className="flex items-center gap-2"><div className="w-12 h-1.5 bg-background rounded-full overflow-hidden"><div className="h-full bg-success w-[08%]"></div></div> <span className="text-[10px] text-muted">08</span></div></td>
                                        </tr>
                                        <tr className="bg-danger/5 border-l-2 border-l-danger">
                                            <td className="p-3 font-bold text-accent">PT-106</td><td className="p-3 font-bold text-danger">190</td><td className="p-3 font-bold text-warning">145</td><td className="p-3 font-bold text-danger">88</td>
                                            <td className="p-3 border-l border-border bg-danger/10"><div className="flex items-center gap-2"><div className="w-12 h-1.5 bg-background rounded-full overflow-hidden"><div className="h-full bg-danger w-[94%] shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div></div> <span className="text-[10px] text-danger font-bold">94</span></div></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* ================= SECTION 5: AI WORKFLOW PIPELINE ================= */}
            <section className="py-24 bg-background border-b border-border relative">
                <div className="max-w-7xl mx-auto px-4">
                    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-20">
                        <h2 className="text-3xl md:text-5xl font-bold text-accent">How MedSentinel Works</h2>
                        <p className="text-muted max-w-2xl mx-auto text-lg mt-4">A seamless, automated pipeline from raw data to actionable clinical intelligence.</p>
                    </motion.div>

                    <div className="flex flex-col md:flex-row justify-between items-start relative">
                        <div className="hidden md:block absolute top-10 left-0 w-full h-1 bg-surface-2 rounded-full z-0 overflow-hidden">
                            <motion.div initial={{ x: "-100%" }} whileInView={{ x: "100%" }} viewport={{ once: true }} transition={{ duration: 2, ease: "easeInOut", repeat: Infinity, repeatDelay: 1 }} className="w-full h-full bg-gradient-to-r from-transparent via-primary to-transparent" />
                        </div>

                        {[
                            { id: 1, title: "Upload", desc: "CSV, Excel, JSON, FHIR format support", icon: UploadCloud },
                            { id: 2, title: "Schema Match", desc: "Auto-detect 50+ medical field types", icon: FileSearch },
                            { id: 3, title: "Score", desc: "Isolation Forest ML · 0-100 threat score", icon: Activity },
                            { id: 4, title: "Cleanse", desc: "KNN imputation + duplicate removal", icon: Sparkles },
                            { id: 5, title: "Explain", desc: "Groq LLaMA medical reasoning engine", icon: BotMessageSquare },
                            { id: 6, title: "Export", desc: "PDF report + raw JSON export", icon: FileText }
                        ].map((step, i) => (
                            <motion.div
                                key={step.id}
                                initial={{ opacity: 0, scale: 0.8 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.1 }}
                                className="relative z-10 flex flex-col items-center group my-8 md:my-0 flex-1 px-2"
                            >
                                <div className="w-20 h-20 rounded-full bg-background border-2 border-border flex items-center justify-center text-primary group-hover:border-primary group-hover:shadow-[0_0_20px_rgba(0,212,255,0.4)] group-hover:scale-110 group-hover:bg-surface-2 transition-all duration-300">
                                    <step.icon className="h-8 w-8" />
                                </div>
                                <div className="mt-5 text-center">
                                    <span className="text-[10px] font-bold text-secondary tracking-widest block mb-1.5">STEP 0{step.id}</span>
                                    <h4 className="text-base font-bold text-accent mb-2">{step.title}</h4>
                                    <p className="text-xs text-muted leading-relaxed max-w-[140px] mx-auto h-10">{step.desc}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ================= SECTION 6: AI CHATBOT SUPPORT WIDGET ================= */}
            <section className="py-24 bg-surface relative overflow-hidden" ref={inlineChatRef}>
                <div className="max-w-4xl mx-auto px-4 space-y-8">
                    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center">
                        <h2 className="text-3xl md:text-5xl font-bold text-accent mb-4">Ask Your Data Anything</h2>
                        <p className="text-muted text-lg">Query complex datasets using plain English. Our medical reasoning engine handles the rest.</p>
                    </motion.div>

                    {/* Inline Mockup Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                        className="bg-background border border-border p-6 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.3)] space-y-6"
                    >
                        {/* Suggested Questions Pills */}
                        <div className="flex flex-wrap justify-center gap-3">
                            {[
                                "Show me all critical anomalies",
                                "Which patients have dangerous glucose levels?",
                                "Summarize today's flagged records",
                                "Generate compliance report"
                            ].map((q, i) => (
                                <motion.div key={i} whileHover={{ scale: 1.02 }} className="px-4 py-2 bg-surface-2 border border-border rounded-full text-xs font-medium text-accent cursor-pointer hover:border-primary transition-colors">
                                    {q}
                                </motion.div>
                            ))}
                        </div>

                        {/* Input Box */}
                        <div className="relative">
                            <div className="absolute left-3 top-3 p-1.5 bg-surface-2 border border-border rounded-lg text-muted"><Mic className="h-4 w-4" /></div>
                            <input disabled type="text" placeholder="Type or speak your clinical query here..." className="w-full bg-surface-2 border border-primary/50 shadow-[0_0_15px_rgba(0,212,255,0.1)] rounded-xl py-4 pl-14 pr-12 text-accent focus:outline-none" />
                            <div className="absolute right-3 top-3 p-1.5 bg-primary rounded-lg"><ArrowRight className="h-4 w-4 text-background" /></div>
                            <div className="absolute -bottom-6 left-0 right-0 text-center text-[10px] text-muted font-medium flex justify-center items-center gap-2">
                                <span>Powered by Groq LLaMA</span> <span className="w-1 h-1 rounded-full bg-muted"></span> <span>HIPAA Compliant</span>
                            </div>
                        </div>

                        {/* Fake Response Card with Typing Animation */}
                        <div className="mt-12 bg-surface border border-border rounded-xl p-5 flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary flex items-center justify-center flex-shrink-0 mt-1">
                                <BotMessageSquare className="h-4 w-4 text-primary" />
                            </div>
                            <div className="space-y-2 w-full">
                                <div className="text-sm font-bold text-accent">MedSentinel AI</div>
                                <p className="text-sm text-muted leading-relaxed min-h-[60px]">
                                    {typedResponse}
                                    {typedResponse.length < FAKE_RESPONSE_TEXT.length && (
                                        <span className="inline-block w-1.5 h-4 bg-primary ml-1 animate-pulse align-middle"></span>
                                    )}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Floating Chat Button (Interactive Component A) */}
            <div className="fixed bottom-8 left-8 z-50 flex flex-col items-start justify-end">
                <AnimatePresence>
                    {isChatOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="w-[340px] h-[400px] mb-4 bg-surface/80 backdrop-blur-xl rounded-2xl border border-primary/30 shadow-[0_0_30px_rgba(0,212,255,0.2)] flex flex-col overflow-hidden"
                        >
                            {/* Header */}
                            <div className="bg-surface-2 p-4 border-b border-border flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-ping"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span></span>
                                    <span className="text-xs font-bold text-accent">MedSentinel AI Assistant</span>
                                </div>
                                <button onClick={() => setIsChatOpen(false)} className="text-muted hover:text-accent"><X className="h-4 w-4" /></button>
                            </div>

                            {/* Chat Body (Interactive) */}
                            <div className="flex-1 p-4 overflow-y-auto space-y-4 text-sm flex flex-col">
                                {chatMessages.map((msg, idx) => (
                                    <div
                                        key={idx}
                                        className={`p-3 shadow-sm ${msg.type === 'bot'
                                            ? 'bg-surface-2 border border-border rounded-xl rounded-tl-none text-accent self-start mr-10'
                                            : 'bg-primary/20 border border-primary/30 rounded-xl rounded-tr-none text-primary self-end ml-10'}`}
                                    >
                                        {msg.text}
                                    </div>
                                ))}
                                <div ref={chatEndRef} />
                            </div>

                            {/* Chat Input UI with Voice (Interactive) */}
                            <div className="p-3 border-t border-border bg-surface/50">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={toggleVoice}
                                        className={`p-2 rounded-full transition-all duration-300 flex-shrink-0 ${isListening
                                            ? "bg-red-500 text-white animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                                            : "bg-surface-2 text-muted hover:bg-border border border-border"
                                            }`}
                                        title={isListening ? "Stop listening" : "Start Voice Query"}
                                    >
                                        <Mic className="h-4 w-4" />
                                    </button>

                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            value={chatInput}
                                            onChange={(e) => setChatInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                                            placeholder="Ask about your data..."
                                            className="w-full bg-background border border-border rounded-lg py-2 pl-3 pr-8 text-xs text-accent focus:outline-none"
                                        />
                                        <button
                                            onClick={handleSendChat}
                                            className="absolute right-2 top-2 cursor-pointer hover:scale-110 transition-transform"
                                        >
                                            <ArrowRight className="h-3 w-3 text-primary" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsChatOpen(!isChatOpen)}
                    className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-[0_0_20px_rgba(0,212,255,0.4)] text-background hover:bg-primary/90 transition-colors"
                >
                    {isChatOpen ? <X className="h-6 w-6" /> : <BotMessageSquare className="h-6 w-6" />}
                </motion.button>
            </div>

            {/* ================= SECTION 7: CTA FOOTER ================= */}
            <section className="relative py-32 bg-background border-t border-border overflow-hidden">
                <div className="ambient-mesh absolute inset-0 z-0 opacity-100 pointer-events-none" />

                <div className="max-w-4xl mx-auto px-4 text-center relative z-10 space-y-8">
                    <motion.h2 initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-4xl md:text-6xl font-bold text-accent tracking-tight">
                        Your Patients' Data <br /> Deserves Better
                    </motion.h2>
                    <motion.p initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="text-muted text-xl max-w-2xl mx-auto">
                        Stop letting silent data corruption compromise clinical outcomes. Deploy enterprise-grade AI monitoring in minutes.
                    </motion.p>

                    <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
                        <Link href="/upload" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-[#0a0f1e] px-8 py-4 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(0,212,255,0.4)] hover:shadow-[0_0_35px_rgba(0,212,255,0.6)]">
                            Upload Dataset →
                        </Link>
                        <Link href="#" className="w-full sm:w-auto bg-surface-2 hover:bg-border border border-border text-accent px-8 py-4 rounded-xl font-medium transition-all">
                            Read the Docs
                        </Link>
                    </motion.div>
                </div>


            </section>

            {/* ================= BACK TO TOP BUTTON ================= */}
            <AnimatePresence>
                {showTopBtn && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        onClick={goToTop}
                        className="fixed bottom-8 right-8 p-3 bg-primary hover:bg-primary/80 text-[#0a0f1e] rounded-full shadow-lg z-40 transition-colors cursor-pointer"
                    >
                        <ArrowUp className="h-6 w-6" />
                    </motion.button>
                )}
            </AnimatePresence>
        </motion.div>
    );
}