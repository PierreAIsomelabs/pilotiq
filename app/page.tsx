"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import PrepaVol from "@/components/PrepaVol";
import { extractPdfText } from "@/lib/extractPdfText";

type AppState = "landing" | "loading" | "dashboard" | "course" | "quiz" | "exam" | "results" | "coach";

interface Chunk { id: number; text: string; start: number; }
interface DocData {
  filename: string;
  pages: number;
  totalChars: number;
  chunkCount: number;
  chunks: Chunk[];
  toc: string[];
  preview: string;
}
interface Question {
  id: number;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  topic: string;
  points?: number;
}
interface SessionResult {
  type: "quiz" | "exam";
  score: number;
  total: number;
  date: string;
  topic: string;
  wrongTopics: string[];
}

const DIFF_COLOR: Record<string, string> = {
  easy: "text-[#00c896]",
  medium: "text-[#ff6b4a]",
  hard: "text-[#ff6b4a]",
};

export default function PilotIQ() {
  const [state, setState] = useState<AppState>("landing");
  const [docData, setDocData] = useState<DocData | null>(null);
  const [courseText, setCourseText] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [examData, setExamData] = useState<{ title: string; duration: number; passMark: number; questions: Question[] } | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showExplanation, setShowExplanation] = useState<Record<number, boolean>>({});
  const [examTimer, setExamTimer] = useState(0);
  const [examRunning, setExamRunning] = useState(false);
  const [sessions, setSessions] = useState<SessionResult[]>([]);
  const [coachData, setCoachData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<"formation" | "prepavol">("formation");
  const [qaQuestion, setQaQuestion] = useState("");
  const [qaAnswer, setQaAnswer] = useState("");
  const [qaLoading, setQaLoading] = useState(false);
  const [exercisesText, setExercisesText] = useState("");
  const [exercisesLoading, setExercisesLoading] = useState(false);
  const [expandedExamples, setExpandedExamples] = useState<Record<string, string>>({});
  const [exampleLoading, setExampleLoading] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const courseRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const qaRef = useRef<HTMLDivElement>(null);

  // Exam timer
  useEffect(() => {
    if (examRunning && !examSubmitted) {
      timerRef.current = setInterval(() => setExamTimer(t => t + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [examRunning, examSubmitted]);

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const handleUpload = async (file: File) => {
    setState("loading");
    setError("");
    try {
      const { text, pages, scanned } = await extractPdfText(file);
      if (scanned) {
        setDocData({
          filename: file.name,
          pages,
          totalChars: 0,
          chunkCount: 0,
          chunks: [],
          toc: [],
          preview: "⚠ PDF scanné détecté — le texte n'a pas pu être extrait. Vous pouvez sélectionner un thème manuellement pour générer un cours.",
        });
        setState("dashboard");
        return;
      }
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, filename: file.name, pages }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDocData(data);
      setState("dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur lors du parsing");
      setState("landing");
    }
  };

  const generateCourse = async () => {
    if (!docData) return;
    setState("course");
    setCourseText("");
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chunks: docData.chunks, topic: selectedTopic || docData.toc[0] }),
    });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      setCourseText(t => t + decoder.decode(value));
    }
  };

  const generateQuiz = async () => {
    if (!docData) return;
    setLoading(true);
    setAnswers({});
    setShowExplanation({});
    setQuizSubmitted(false);
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunks: docData.chunks, count: 5 }),
      });
      const data = await res.json();
      setQuestions(data.questions || []);
      setState("quiz");
    } catch {
      setError("Erreur génération QCM");
    }
    setLoading(false);
  };

  const generateExam = async () => {
    if (!docData) return;
    setLoading(true);
    setAnswers({});
    setExamSubmitted(false);
    setExamTimer(0);
    try {
      const res = await fetch("/api/exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunks: docData.chunks, questionCount: 15, duration: 30 }),
      });
      const data = await res.json();
      setExamData(data);
      setState("exam");
      setExamRunning(true);
    } catch {
      setError("Erreur génération examen");
    }
    setLoading(false);
  };

  const submitQuiz = () => {
    if (!docData) return;
    setQuizSubmitted(true);
    const score = questions.filter(q => answers[q.id] === q.correct).length;
    const wrongTopics = questions
      .filter(q => answers[q.id] !== q.correct)
      .map(q => q.topic);
    setSessions(prev => [...prev, {
      type: "quiz",
      score,
      total: questions.length,
      date: new Date().toLocaleDateString("fr-FR"),
      topic: selectedTopic || docData.toc[0] || "Général",
      wrongTopics,
    }]);
  };

  const submitExam = useCallback(() => {
    if (!examData || !docData) return;
    setExamSubmitted(true);
    setExamRunning(false);
    const score = examData.questions.filter(q => answers[q.id] === q.correct).length;
    const wrongTopics = examData.questions
      .filter(q => answers[q.id] !== q.correct)
      .map(q => q.topic);
    setSessions(prev => [...prev, {
      type: "exam",
      score,
      total: examData.questions.length,
      date: new Date().toLocaleDateString("fr-FR"),
      topic: examData.title,
      wrongTopics,
    }]);
  }, [examData, docData, answers]);

  // Auto-submit when time runs out
  useEffect(() => {
    if (examData && examTimer >= examData.duration * 60 && !examSubmitted) {
      submitExam();
    }
  }, [examTimer, examData, examSubmitted, submitExam]);

  const getCoachAnalysis = async () => {
    if (!docData) return;
    setLoading(true);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessions, documentTitle: docData.filename }),
      });
      const data = await res.json();
      setCoachData(data);
      setState("coach");
    } catch {
      setError("Erreur analyse coach");
    }
    setLoading(false);
  };

  const askQuestion = async () => {
    if (!qaQuestion.trim() || qaLoading) return;
    setQaAnswer("");
    setQaLoading(true);
    try {
      const res = await fetch("/api/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: qaQuestion, courseText, topic: selectedTopic }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setQaAnswer(t => t + decoder.decode(value));
      }
    } catch {
      setQaAnswer("Erreur lors de la réponse. Réessayez.");
    }
    setQaLoading(false);
    setTimeout(() => qaRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const generateExercises = async () => {
    if (exercisesLoading) return;
    setExercisesText("");
    setExercisesLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chunks: docData?.chunks || [],
          topic: selectedTopic || "navigation aérienne",
          mode: "exercises",
        }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setExercisesText(t => t + decoder.decode(value));
      }
    } catch {
      setExercisesText("Erreur lors de la génération des exercices.");
    }
    setExercisesLoading(false);
  };

  const generateExample = async (sectionTitle: string) => {
    if (exampleLoading) return;
    setExampleLoading(sectionTitle);
    setExpandedExamples(prev => ({ ...prev, [sectionTitle]: "" }));
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chunks: docData?.chunks || [],
          topic: selectedTopic || "navigation aérienne",
          mode: "example",
          sectionTitle,
        }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setExpandedExamples(prev => ({ ...prev, [sectionTitle]: (prev[sectionTitle] || "") + decoder.decode(value) }));
      }
    } catch {
      setExpandedExamples(prev => ({ ...prev, [sectionTitle]: "Erreur lors de la génération." }));
    }
    setExampleLoading(null);
  };

  const renderMarkdown = (text: string) => text
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, s => `<ul>${s}</ul>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul]|<\/[hul]|<p|<\/p)(.+)$/gm, '<p>$1</p>');

  const courseSections = courseText
    ? courseText.split(/(?=^## )/gm).filter(s => s.trim())
    : [];

  const examScore = examData
    ? examData.questions.filter(q => answers[q.id] === q.correct).length
    : 0;
  const examPercent = examData ? Math.round((examScore / examData.questions.length) * 100) : 0;
  const examPassed = examData ? examPercent >= examData.passMark : false;

  // ─── LANDING ───
  if (state === "landing") return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-xl w-full text-center space-y-8">
        <div className="space-y-4">
          <h1 className="font-display text-4xl font-light text-white tracking-tight">
            Pilot<span className="text-[#00e5c8] italic">IQ</span>
          </h1>
          <p className="font-label text-xs tracking-[0.2em] uppercase text-[#4a5568]">Formation ATPL Intelligente</p>
          <div className="mx-auto w-10 h-0.5 bg-[#00e5c8] rounded-full"></div>
        </div>

        <div
          className="panel p-8 cursor-pointer group transition-all duration-300 hover:border-[#00e5c8]/40 glow-accent"
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type === "application/pdf") handleUpload(f); }}
        >
          <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full border-2 border-dashed border-[#4a5568] group-hover:border-[#00e5c8]/60 flex items-center justify-center transition-colors">
              <span className="text-2xl text-[#4a5568] group-hover:text-[#00e5c8]/60 transition-colors">⬆</span>
            </div>
            <div>
              <p className="text-white font-medium">Charger un manuel aéronautique</p>
              <p className="text-[#4a5568] text-sm mt-1">Glissez votre PDF Mermoz ou cliquez pour sélectionner</p>
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#00e5c8]/6 border border-[#00e5c8]/15 text-[#00e5c8] text-xs font-label">
              <span className="dot bg-[#00e5c8]"></span> PDF — Manuel ATPL
            </div>
          </div>
        </div>

        {error && <p className="text-[#ff6b4a] text-sm font-mono">{error}</p>}

        <div className="grid grid-cols-5 gap-4 text-center">
          {[["01", "Cours IA"], ["02", "QCM"], ["03", "Examen"], ["04", "Coach IA"], ["05", "Prépa vol"]].map(([num, label]) => (
            <div key={label} className="space-y-1.5">
              <div className="text-[#00e5c8] font-label text-xs">{num} —</div>
              <div className="text-[#4a5568] text-xs font-label">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ─── LOADING ───
  if (state === "loading") return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-8">
        <div className="relative w-16 h-16 mx-auto">
          <div className="absolute inset-0 rounded-full border border-[#00e5c8]/20 animate-spin" style={{ borderTopColor: "#00e5c8", animationDuration: "1.2s" }}></div>
          <div className="absolute inset-4 rounded-full border border-[#00e5c8]/10 animate-spin" style={{ borderRightColor: "#00e5c8", animationDuration: "1.8s", animationDirection: "reverse" }}></div>
        </div>
        <div className="space-y-2">
          <p className="text-white font-display text-lg font-light">Analyse en cours</p>
          <p className="text-[#4a5568] text-xs font-label tracking-wider">Extraction et indexation du contenu</p>
        </div>
        <div className="flex gap-1.5 justify-center">
          {[0,1,2,3,4].map(i => (
            <div key={i} className="w-1 h-1 rounded-full bg-[#00e5c8]" style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}></div>
          ))}
        </div>
      </div>
    </div>
  );

  // ─── DASHBOARD ───
  if (state === "dashboard" && docData) {
    return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-display text-lg font-light text-white">Pilot<span className="text-[#00e5c8] italic">IQ</span></span>
        </div>
        <button onClick={() => setState("landing")} className="text-[#4a5568] hover:text-white font-label text-xs transition-colors">← Nouveau document</button>
      </div>

      {/* Doc info */}
      <div className="panel p-4 glow-accent">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-white font-medium truncate max-w-sm">{docData.filename}</p>
            <div className="flex gap-4 text-sm font-mono text-[#4a5568]">
              <span>{docData.pages} pages</span>
              <span>{docData.chunkCount} sections</span>
              <span>{(docData.totalChars / 1000).toFixed(0)}k car.</span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#00c896]/10 border border-[#00c896]/20">
            <span className="dot bg-[#00c896] animate-pulse-slow"></span>
            <span className="text-[#00c896] text-xs font-mono">Prêt</span>
          </div>
        </div>
      </div>

      {/* Main tabs */}
      <div className="flex gap-6 border-b border-[#1a2332]">
        <button onClick={() => setDashboardTab("formation")}
          className={`px-1 py-2.5 font-label text-xs transition-colors border-b -mb-px ${dashboardTab === "formation" ? "border-[#00e5c8] text-[#00e5c8]" : "border-transparent text-[#4a5568] hover:text-white"}`}>
          Formation ATPL
        </button>
        <button onClick={() => setDashboardTab("prepavol")}
          className={`px-1 py-2.5 font-label text-xs transition-colors border-b -mb-px ${dashboardTab === "prepavol" ? "border-[#00e5c8] text-[#00e5c8]" : "border-transparent text-[#4a5568] hover:text-white"}`}>
          Prépa vol
        </button>
      </div>

      {/* ── Formation tab ── */}
      {dashboardTab === "formation" && (
        <div className="space-y-5">
          {/* Session history */}
          {sessions.length > 0 && (
            <div className="panel p-4 space-y-2">
              <p className="text-[#4a5568] font-mono text-xs uppercase tracking-widest">Historique de session</p>
              <div className="space-y-1.5">
                {sessions.map((s, i) => {
                  const pct = Math.round(s.score / s.total * 100);
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-[#4a5568] font-mono text-xs w-20">{s.date}</span>
                      <span className="text-xs font-mono text-[#e8edf5] flex-1 truncate">{s.topic}</span>
                      <span className={`font-mono text-sm font-bold ${pct >= 75 ? "text-[#00c896]" : pct >= 50 ? "text-[#ff6b4a]" : "text-[#ff6b4a]"}`}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Topic selector */}
          {docData.toc.length > 0 && (
            <div className="space-y-2">
              <p className="text-[#4a5568] font-mono text-xs uppercase tracking-widest">Thème pour le cours / QCM</p>
              <div className="flex flex-wrap gap-2">
                {docData.toc.slice(0, 12).map((t, i) => (
                  <button key={i} onClick={() => setSelectedTopic(t)}
                    className={`px-3 py-1.5 rounded font-mono text-xs transition-all border ${selectedTopic === t ? "bg-[#00e5c8]/15 border-[#00e5c8]/40 text-[#00e5c8]" : "border-[#1a2332] text-[#4a5568] hover:border-[#4a5568] hover:text-[#e8edf5]"}`}>
                    {t.length > 40 ? t.slice(0, 40) + "…" : t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { num: "01", label: "Générer le cours", sub: "Synthèse IA du document", action: generateCourse, disabled: false },
              { num: "02", label: "QCM adaptatifs", sub: "5 questions depuis le PDF", action: generateQuiz, disabled: loading },
              { num: "03", label: "Examen blanc", sub: "15 questions · 30 min", action: generateExam, disabled: loading },
              { num: "04", label: "Coach IA", sub: `Analyser mes ${sessions.length} session(s)`, action: getCoachAnalysis, disabled: loading || sessions.length === 0 },
            ].map(({ num, label, sub, action, disabled }) => (
                <button key={label} onClick={action} disabled={disabled}
                  className={`panel p-5 text-left transition-all duration-200 space-y-3 ${disabled ? "opacity-40 cursor-not-allowed" : "hover:border-[#00e5c8]/40 cursor-pointer"}`}>
                  <span className="text-[#00e5c8] font-label text-xs">{num} —</span>
                  <div>
                    <p className="text-white font-medium text-sm">{label}</p>
                    <p className="text-[#4a5568] text-xs font-label mt-1">{sub}</p>
                  </div>
                </button>
              ))}
          </div>
          {error && <p className="text-[#ff6b4a] font-mono text-sm">{error}</p>}
        </div>
      )}

      {/* ── Prépa vol tab ── */}
      {dashboardTab === "prepavol" && <PrepaVol />}
    </div>
    );
  }

  // ─── COURSE ───
  if (state === "course") return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto space-y-4 pb-32">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[#00e5c8] font-mono text-sm">📖 Cours IA</span>
          {selectedTopic && <span className="text-[#4a5568] font-mono text-xs">— {selectedTopic.slice(0, 50)}</span>}
        </div>
        <button onClick={() => setState("dashboard")} className="text-[#4a5568] hover:text-white font-mono text-sm">← Tableau de bord</button>
      </div>

      {/* Course content with per-section example buttons */}
      <div ref={courseRef} className="space-y-0">
        {courseText ? (
          courseSections.length > 0 ? courseSections.map((section, idx) => {
            const titleMatch = section.match(/^##\s+(.+)$/m);
            const sectionTitle = titleMatch ? titleMatch[1].trim() : `Section ${idx + 1}`;
            const sectionKey = `${idx}-${sectionTitle}`;
            return (
              <div key={idx} className="panel p-6 rounded-none first:rounded-t last:rounded-b border-b-0 last:border-b">
                <div className="prose-cockpit" dangerouslySetInnerHTML={{ __html: renderMarkdown(section) }} />
                {titleMatch && (
                  <div className="mt-4 pt-3 border-t border-[#1a2332]">
                    {expandedExamples[sectionKey] !== undefined ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[#ff6b4a] font-mono text-xs uppercase tracking-widest">Exemple concret</span>
                          {exampleLoading === sectionKey && <div className="animate-spin w-3 h-3 border border-[#ff6b4a] rounded-full border-t-transparent"></div>}
                        </div>
                        <div className="rounded p-4 bg-[#ff6b4a]/5 border border-[#ff6b4a]/20">
                          <div className="prose-cockpit text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(expandedExamples[sectionKey] || "") }} />
                        </div>
                        <button onClick={() => setExpandedExamples(prev => { const n = { ...prev }; delete n[sectionKey]; return n; })}
                          className="text-[#4a5568] hover:text-white font-mono text-xs transition-colors">
                          Masquer l'exemple
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => generateExample(sectionKey)}
                        disabled={exampleLoading !== null}
                        className="px-3 py-1.5 rounded border border-[#ff6b4a]/20 text-[#ff6b4a] font-mono text-xs hover:bg-[#ff6b4a]/10 transition-colors disabled:opacity-40">
                        Exemple concret →
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          }) : (
            <div className="panel p-6">
              <div className="prose-cockpit" dangerouslySetInnerHTML={{ __html: renderMarkdown(courseText) }} />
            </div>
          )
        ) : (
          <div className="panel p-6 flex items-center gap-3 text-[#4a5568]">
            <div className="animate-spin w-4 h-4 border border-[#00e5c8] rounded-full border-t-transparent"></div>
            <span className="font-mono text-sm">Génération en cours</span>
          </div>
        )}
      </div>

      {/* Exercices pratiques */}
      {courseText && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[#00c896] font-mono text-xs uppercase tracking-widest">Exercices pratiques</span>
            <button
              onClick={generateExercises}
              disabled={exercisesLoading}
              className="px-3 py-1.5 rounded bg-[#00c896]/10 border border-[#00c896]/30 text-[#00c896] font-mono text-xs hover:bg-[#00c896]/20 transition-colors disabled:opacity-40">
              {exercisesLoading ? "Génération…" : exercisesText ? "Régénérer" : "Générer 3 exercices"}
            </button>
          </div>
          {(exercisesText || exercisesLoading) && (
            <div className="panel p-6">
              {exercisesText ? (
                <div className="prose-cockpit" dangerouslySetInnerHTML={{ __html: renderMarkdown(exercisesText) }} />
              ) : (
                <div className="flex items-center gap-3 text-[#4a5568]">
                  <div className="animate-spin w-4 h-4 border border-[#00c896] rounded-full border-t-transparent"></div>
                  <span className="font-mono text-sm">Génération des exercices…</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      {courseText && (
        <div className="flex gap-3">
          <button onClick={generateQuiz} className="px-4 py-2 rounded bg-[#ff6b4a]/10 border border-[#ff6b4a]/30 text-[#ff6b4a] font-mono text-sm hover:bg-[#ff6b4a]/20 transition-colors">
            → Générer un QCM
          </button>
          <button onClick={() => setState("dashboard")} className="px-4 py-2 rounded border border-[#1a2332] text-[#4a5568] font-mono text-sm hover:border-[#4a5568] hover:text-white transition-colors">
            Tableau de bord
          </button>
        </div>
      )}

      {/* Q&A answer */}
      {(qaAnswer || qaLoading) && (
        <div ref={qaRef} className="panel p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[#00e5c8] font-mono text-xs uppercase tracking-widest">Réponse IA</span>
            {qaLoading && <div className="animate-spin w-3 h-3 border border-[#00e5c8] rounded-full border-t-transparent"></div>}
          </div>
          {qaAnswer && (
            <div className="prose-cockpit" dangerouslySetInnerHTML={{ __html: renderMarkdown(qaAnswer) }} />
          )}
        </div>
      )}

      {/* Q&A input — sticky bottom */}
      {courseText && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#08090d]/95 backdrop-blur border-t border-[#1a2332] px-4 py-3 z-20">
          <div className="max-w-3xl mx-auto flex gap-3">
            <input
              value={qaQuestion}
              onChange={e => setQaQuestion(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askQuestion(); } }}
              placeholder="Posez une question sur le cours…"
              className="flex-1 bg-[#08090d] border border-[#1a2332] rounded px-4 py-2.5 font-mono text-sm text-white placeholder-[#4a5568] focus:border-[#00e5c8]/40 focus:outline-none"
            />
            <button
              onClick={askQuestion}
              disabled={qaLoading || !qaQuestion.trim()}
              className="px-5 py-2.5 rounded bg-[#00e5c8]/10 border border-[#00e5c8]/30 text-[#00e5c8] font-mono text-sm font-medium hover:bg-[#00e5c8]/20 transition-colors disabled:opacity-40 shrink-0">
              {qaLoading ? "…" : "Demander"}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ─── QUIZ ───
  if (state === "quiz") return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[#ff6b4a] font-mono text-sm">❓ QCM — {questions.length} questions</span>
        <button onClick={() => setState("dashboard")} className="text-[#4a5568] hover:text-white font-mono text-sm">← Tableau de bord</button>
      </div>

      <div className="space-y-4">
        {questions.map((q, qi) => {
          const answered = answers[q.id] !== undefined;
          const isCorrect = answers[q.id] === q.correct;
          return (
            <div key={q.id} className={`panel p-5 space-y-4 transition-all fade-in ${quizSubmitted ? (answered ? (isCorrect ? "border-[#00c896]/30" : "border-[#ff6b4a]/30") : "border-[#ff6b4a]/20") : ""}`}
              style={{ animationDelay: `${qi * 0.08}s` }}>
              <div className="flex items-start gap-3">
                <span className="font-mono text-[#4a5568] text-sm pt-0.5 shrink-0">{qi + 1}.</span>
                <div className="flex-1 space-y-1">
                  <p className="text-white text-sm leading-relaxed">{q.question}</p>
                  <div className="flex gap-3">
                    <span className="font-mono text-xs text-[#4a5568]">{q.topic}</span>
                    <span className={`font-mono text-xs ${DIFF_COLOR[q.difficulty]}`}>{q.difficulty}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {q.options.map((opt, oi) => {
                  let cls = "border-[#1a2332] text-[#e8edf5] hover:border-[#4a5568]";
                  if (quizSubmitted) {
                    if (oi === q.correct) cls = "border-[#00c896]/50 bg-[#00c896]/8 text-[#00c896]";
                    else if (oi === answers[q.id]) cls = "border-[#ff6b4a]/50 bg-[#ff6b4a]/8 text-[#ff6b4a]";
                    else cls = "border-[#1a2332] text-[#4a5568]";
                  } else if (answers[q.id] === oi) {
                    cls = "border-[#00e5c8]/50 bg-[#00e5c8]/8 text-[#00e5c8]";
                  }
                  return (
                    <button
                      key={oi}
                      disabled={quizSubmitted}
                      onClick={() => setAnswers(a => ({ ...a, [q.id]: oi }))}
                      className={`text-left px-4 py-2.5 rounded border font-mono text-sm transition-all ${cls}`}
                    >
                      <span className="text-[#4a5568] mr-2">{["A", "B", "C", "D"][oi]}.</span>{opt}
                    </button>
                  );
                })}
              </div>

              {quizSubmitted && (
                <div className={`rounded p-3 text-sm ${isCorrect ? "bg-[#00c896]/8 border border-[#00c896]/20 text-[#00c896]" : "bg-[#ff6b4a]/8 border border-[#ff6b4a]/20 text-[#ff6b4a]"}`}>
                  <p className="font-mono text-xs mb-1">{isCorrect ? "✓ Correct" : "✗ Incorrect"}</p>
                  <p className="text-[#e8edf5] text-xs leading-relaxed">{q.explanation}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!quizSubmitted ? (
        <button
          onClick={submitQuiz}
          disabled={Object.keys(answers).length < questions.length}
          className="w-full py-3 rounded bg-[#ff6b4a]/10 border border-[#ff6b4a]/30 text-[#ff6b4a] font-mono font-medium hover:bg-[#ff6b4a]/20 transition-colors disabled:opacity-40"
        >
          Valider ({Object.keys(answers).length}/{questions.length} réponses)
        </button>
      ) : (
        <div className="panel p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-white font-bold text-lg">
              {questions.filter(q => answers[q.id] === q.correct).length}/{questions.length}
            </span>
            <span className={`font-mono text-2xl font-bold ${
              questions.filter(q => answers[q.id] === q.correct).length / questions.length >= 0.75
                ? "text-[#00c896]" : "text-[#ff6b4a]"
            }`}>
              {Math.round(questions.filter(q => answers[q.id] === q.correct).length / questions.length * 100)}%
            </span>
          </div>
          <div className="flex gap-3">
            <button onClick={generateExam} className="flex-1 py-2 rounded bg-[#00c896]/10 border border-[#00c896]/30 text-[#00c896] font-mono text-sm hover:bg-[#00c896]/20 transition-colors">
              → Examen blanc
            </button>
            <button onClick={() => setState("dashboard")} className="flex-1 py-2 rounded border border-[#1a2332] text-[#4a5568] font-mono text-sm hover:border-[#4a5568] hover:text-white transition-colors">
              Tableau de bord
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // ─── EXAM ───
  if (state === "exam" && examData) {
    const timeLimit = examData.duration * 60;
    const timeLeft = Math.max(0, timeLimit - examTimer);
    const timePercent = (examTimer / timeLimit) * 100;
    const answered = Object.keys(answers).length;

    return (
      <div className="min-h-screen p-6 max-w-3xl mx-auto space-y-4">
        {/* Sticky header */}
        <div className="sticky top-4 z-10 panel px-5 py-3 flex items-center justify-between glow-green">
          <div className="space-y-1 flex-1 mr-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-[#4a5568]">Questions répondues</span>
              <span className="font-mono text-xs text-[#e8edf5]">{answered}/{examData.questions.length}</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${(answered / examData.questions.length) * 100}%` }}></div>
            </div>
          </div>
          <div className={`font-mono text-lg font-bold tabular-nums ${timeLeft < 300 ? "text-[#ff6b4a]" : "text-[#00c896]"}`}>
            {formatTime(timeLeft)}
          </div>
        </div>

        {/* Timer bar */}
        <div className="progress-bar">
          <div className="h-full rounded" style={{ width: `${100 - timePercent}%`, background: timeLeft < 300 ? "#ff6b4a" : "#00c896", transition: "width 1s linear" }}></div>
        </div>

        <p className="font-mono text-[#4a5568] text-xs">{examData.title}</p>

        <div className="space-y-4">
          {examData.questions.map((q, qi) => {
            const answered_q = answers[q.id] !== undefined;
            const isCorrect = answers[q.id] === q.correct;
            return (
              <div key={q.id} className={`panel p-5 space-y-4 ${examSubmitted ? (answered_q ? (isCorrect ? "border-[#00c896]/30" : "border-[#ff6b4a]/30") : "border-[#ff6b4a]/20") : ""}`}>
                <div className="flex items-start gap-3">
                  <span className="font-mono text-[#4a5568] text-sm shrink-0">{qi + 1}.</span>
                  <p className="text-white text-sm leading-relaxed">{q.question}</p>
                </div>
                <div className="grid gap-2">
                  {q.options.map((opt, oi) => {
                    let cls = "border-[#1a2332] text-[#e8edf5] hover:border-[#4a5568]";
                    if (examSubmitted) {
                      if (oi === q.correct) cls = "border-[#00c896]/50 bg-[#00c896]/8 text-[#00c896]";
                      else if (oi === answers[q.id]) cls = "border-[#ff6b4a]/50 bg-[#ff6b4a]/8 text-[#ff6b4a]";
                      else cls = "border-[#1a2332] text-[#4a5568]";
                    } else if (answers[q.id] === oi) {
                      cls = "border-[#00e5c8]/50 bg-[#00e5c8]/8 text-[#00e5c8]";
                    }
                    return (
                      <button key={oi} disabled={examSubmitted} onClick={() => setAnswers(a => ({ ...a, [q.id]: oi }))}
                        className={`text-left px-4 py-2.5 rounded border font-mono text-sm transition-all ${cls}`}>
                        <span className="text-[#4a5568] mr-2">{["A", "B", "C", "D"][oi]}.</span>{opt}
                      </button>
                    );
                  })}
                </div>
                {examSubmitted && (
                  <p className="text-xs text-[#e8edf5]/70 leading-relaxed pl-1">{q.explanation}</p>
                )}
              </div>
            );
          })}
        </div>

        {!examSubmitted ? (
          <button onClick={submitExam}
            className="w-full py-3 rounded bg-[#00c896]/10 border border-[#00c896]/30 text-[#00c896] font-mono font-medium hover:bg-[#00c896]/20 transition-colors">
            Remettre l'examen · {answered}/{examData.questions.length} répondues
          </button>
        ) : (
          <div className={`panel p-6 space-y-4 ${examPassed ? "border-[#00c896]/40 glow-green" : "border-[#ff6b4a]/40"}`}>
            <div className="text-center space-y-2">
              <p className="font-mono text-4xl font-bold" style={{ color: examPassed ? "#00c896" : "#ff6b4a" }}>{examPercent}%</p>
              <p className="text-white font-medium">{examPassed ? "✓ Examen réussi" : "✗ Examen non réussi"}</p>
              <p className="text-[#4a5568] font-mono text-sm">{examScore}/{examData.questions.length} correctes · Seuil {examData.passMark}% · Temps {formatTime(examTimer)}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={getCoachAnalysis} className="flex-1 py-2 rounded bg-[#00e5c8]/10 border border-[#00e5c8]/30 text-[#00e5c8] font-mono text-sm hover:bg-[#00e5c8]/20 transition-colors">
                🧠 Analyse du coach
              </button>
              <button onClick={() => setState("dashboard")} className="flex-1 py-2 rounded border border-[#1a2332] text-[#4a5568] font-mono text-sm hover:border-[#4a5568] hover:text-white transition-colors">
                Tableau de bord
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── COACH ───
  if (state === "coach") {
    const coach = coachData as Record<string, unknown> | null;
    if (!coach) return null;
    const ready = coach.readyForExam as boolean;
    const score = coach.globalScore as number;
    const recs = (coach.recommendations as Array<{priority: string; action: string; reason: string}>) || [];
    const weak = (coach.weakTopics as string[]) || [];
    const strengths = (coach.strengths as string[]) || [];
    const verdict = coach.verdict as string;
    const message = coach.message as string;
    const estimatedReadyDate = coach.estimatedReadyDate as string | undefined;
    const nextModule = coach.nextModule as string | undefined;

    return (
      <div className="min-h-screen p-6 max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-[#00e5c8] font-mono text-sm">🧠 Coach IA — Analyse de progression</span>
          <button onClick={() => setState("dashboard")} className="text-[#4a5568] hover:text-white font-mono text-sm">← Tableau de bord</button>
        </div>

        {/* Verdict */}
        <div className={`panel p-6 text-center space-y-3 ${ready ? "border-[#00c896]/30 glow-green" : "border-[#ff6b4a]/30 glow-coral"}`}>
          <div className={`text-5xl font-mono font-bold ${ready ? "text-[#00c896]" : "text-[#ff6b4a]"}`}>{score}%</div>
          <p className="text-white font-medium">{verdict}</p>
          <p className="text-[#e8edf5] text-sm max-w-md mx-auto leading-relaxed">{message}</p>
          {estimatedReadyDate && !ready && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#ff6b4a]/10 border border-[#ff6b4a]/20">
              <span className="text-[#ff6b4a] font-mono text-xs">⏱ {estimatedReadyDate}</span>
            </div>
          )}
        </div>

        {/* Strengths & Weaknesses */}
        <div className="grid grid-cols-2 gap-4">
          {strengths.length > 0 && (
            <div className="panel p-4 space-y-3">
              <p className="font-mono text-xs text-[#00c896] uppercase tracking-widest">Points forts</p>
              <ul className="space-y-1.5">
                {strengths.map((s, i) => (
                  <li key={i} className="text-sm text-[#e8edf5] flex gap-2">
                    <span className="text-[#00c896] shrink-0">+</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {weak.length > 0 && (
            <div className="panel p-4 space-y-3">
              <p className="font-mono text-xs text-[#ff6b4a] uppercase tracking-widest">À retravailler</p>
              <ul className="space-y-1.5">
                {weak.map((w, i) => (
                  <li key={i} className="text-sm text-[#e8edf5] flex gap-2">
                    <span className="text-[#ff6b4a] shrink-0">!</span>{w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Recommendations */}
        {recs.length > 0 && (
          <div className="space-y-3">
            <p className="font-mono text-xs text-[#4a5568] uppercase tracking-widest">Recommandations</p>
            {recs.map((r, i) => (
              <div key={i} className={`panel p-4 flex gap-4 ${r.priority === "high" ? "border-[#ff6b4a]/20" : "border-[#ff6b4a]/20"}`}>
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${r.priority === "high" ? "bg-[#ff6b4a]" : "bg-[#ff6b4a]"}`}></div>
                <div className="space-y-0.5">
                  <p className="text-white text-sm font-medium">{r.action}</p>
                  <p className="text-[#4a5568] text-xs">{r.reason}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Next module */}
        {nextModule && (
          <div className="panel p-4 flex items-center gap-4 border-[#00e5c8]/20">
            <span className="text-[#00e5c8] text-lg">→</span>
            <div>
              <p className="text-[#4a5568] font-mono text-xs uppercase tracking-widest mb-0.5">Module suivant recommandé</p>
              <p className="text-white text-sm">{nextModule}</p>
            </div>
          </div>
        )}

        {/* Session history */}
        {sessions.length > 0 && (
          <div className="panel p-4 space-y-2">
            <p className="font-mono text-xs text-[#4a5568] uppercase tracking-widest">Historique</p>
            {sessions.map((s, i) => {
              const pct = Math.round(s.score / s.total * 100);
              return (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="text-[#4a5568] font-mono text-xs w-16">{s.date}</span>
                  <span className={`font-mono text-xs px-2 py-0.5 rounded border ${s.type === "exam" ? "text-[#00c896] border-[#00c896]/20 bg-[#00c896]/8" : "text-[#ff6b4a] border-[#ff6b4a]/20 bg-[#ff6b4a]/8"}`}>{s.type}</span>
                  <span className="text-[#e8edf5] flex-1 truncate text-xs">{s.topic}</span>
                  <span className={`font-mono font-bold ${pct >= 75 ? "text-[#00c896]" : "text-[#ff6b4a]"}`}>{pct}%</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return null;
}
