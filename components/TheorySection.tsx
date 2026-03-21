"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { renderMarkdown } from "@/lib/markdown";
import type { Chunk, Question, SessionResult, TheoryTab } from "@/lib/types";

interface Props {
  tab: TheoryTab;
  allChunks: Chunk[];
  allToc: string[];
  sessions: SessionResult[];
  onSessionAdd: (s: SessionResult) => void;
  hasDocuments: boolean;
}

const DIFF_COLOR: Record<string, string> = {
  easy: "text-[#00c896]",
  medium: "text-[#ff6b4a]",
  hard: "text-[#ff6b4a]",
};

export default function TheorySection({ tab, allChunks, allToc, sessions, onSessionAdd, hasDocuments }: Props) {
  // Course state
  const [courseText, setCourseText] = useState("");
  const [courseLoading, setCourseLoading] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [qaQuestion, setQaQuestion] = useState("");
  const [qaAnswer, setQaAnswer] = useState("");
  const [qaLoading, setQaLoading] = useState(false);
  const [exercisesText, setExercisesText] = useState("");
  const [exercisesLoading, setExercisesLoading] = useState(false);
  const [expandedExamples, setExpandedExamples] = useState<Record<string, string>>({});
  const [exampleLoading, setExampleLoading] = useState<string | null>(null);

  // Quiz state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Exam state
  const [examData, setExamData] = useState<{ title: string; duration: number; passMark: number; questions: Question[] } | null>(null);
  const [examLoading, setExamLoading] = useState(false);
  const [examAnswers, setExamAnswers] = useState<Record<number, number>>({});
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [examTimer, setExamTimer] = useState(0);
  const [examRunning, setExamRunning] = useState(false);

  const courseRef = useRef<HTMLDivElement>(null);
  const qaRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Timer
  useEffect(() => {
    if (examRunning && !examSubmitted) {
      timerRef.current = setInterval(() => setExamTimer(t => t + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [examRunning, examSubmitted]);

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const submitExam = useCallback(() => {
    if (!examData) return;
    setExamSubmitted(true);
    setExamRunning(false);
    const score = examData.questions.filter(q => examAnswers[q.id] === q.correct).length;
    const wrongTopics = examData.questions.filter(q => examAnswers[q.id] !== q.correct).map(q => q.topic);
    onSessionAdd({
      type: "exam", score, total: examData.questions.length,
      date: new Date().toLocaleDateString("fr-FR"),
      topic: examData.title, wrongTopics,
    });
  }, [examData, examAnswers, onSessionAdd]);

  useEffect(() => {
    if (examData && examTimer >= examData.duration * 60 && !examSubmitted) submitExam();
  }, [examTimer, examData, examSubmitted, submitExam]);

  // Generators
  const generateCourse = async () => {
    setCourseText("");
    setCourseLoading(true);
    setExercisesText("");
    setQaAnswer("");
    setExpandedExamples({});
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chunks: allChunks, topic: selectedTopic || allToc[0] || "aéronautique" }),
    });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      setCourseText(t => t + decoder.decode(value));
    }
    setCourseLoading(false);
  };

  const generateQuiz = async () => {
    setQuizLoading(true);
    setAnswers({});
    setQuizSubmitted(false);
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunks: allChunks, count: 5 }),
      });
      const data = await res.json();
      setQuestions(data.questions || []);
    } catch { /* ignore */ }
    setQuizLoading(false);
  };

  const generateExam = async () => {
    setExamLoading(true);
    setExamAnswers({});
    setExamSubmitted(false);
    setExamTimer(0);
    try {
      const res = await fetch("/api/exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunks: allChunks, questionCount: 15, duration: 30 }),
      });
      const data = await res.json();
      setExamData(data);
      setExamRunning(true);
    } catch { /* ignore */ }
    setExamLoading(false);
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
      setQaAnswer("Erreur. Réessayez.");
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
        body: JSON.stringify({ chunks: allChunks, topic: selectedTopic || "navigation aérienne", mode: "exercises" }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setExercisesText(t => t + decoder.decode(value));
      }
    } catch {
      setExercisesText("Erreur.");
    }
    setExercisesLoading(false);
  };

  const generateExample = async (sectionKey: string) => {
    if (exampleLoading) return;
    setExampleLoading(sectionKey);
    setExpandedExamples(prev => ({ ...prev, [sectionKey]: "" }));
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunks: allChunks, topic: selectedTopic || "navigation aérienne", mode: "example", sectionTitle: sectionKey }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setExpandedExamples(prev => ({ ...prev, [sectionKey]: (prev[sectionKey] || "") + decoder.decode(value) }));
      }
    } catch {
      setExpandedExamples(prev => ({ ...prev, [sectionKey]: "Erreur." }));
    }
    setExampleLoading(null);
  };

  const submitQuiz = () => {
    setQuizSubmitted(true);
    const score = questions.filter(q => answers[q.id] === q.correct).length;
    const wrongTopics = questions.filter(q => answers[q.id] !== q.correct).map(q => q.topic);
    onSessionAdd({
      type: "quiz", score, total: questions.length,
      date: new Date().toLocaleDateString("fr-FR"),
      topic: selectedTopic || allToc[0] || "Général",
      wrongTopics,
    });
  };

  const courseSections = courseText ? courseText.split(/(?=^## )/gm).filter(s => s.trim()) : [];

  // ─── NO DOCUMENTS ───
  if (!hasDocuments) {
    return (
      <div className="max-w-2xl">
        <div className="mb-6">
          <h2 className="font-display text-xl font-light text-white">Theory</h2>
          <div className="w-10 h-0.5 bg-[#00e5c8] rounded-full mt-2"></div>
        </div>
        <div className="panel p-8 text-center space-y-3">
          <p className="text-[#e8edf5] text-sm">Aucun document chargé</p>
          <p className="text-[#4a5568] text-xs">Ajoutez des manuels ATPL dans <span className="text-[#00e5c8]">Paramètres</span> pour commencer.</p>
        </div>
      </div>
    );
  }

  // ─── TOPIC SELECTOR ───
  const topicSelector = allToc.length > 0 && (
    <div className="space-y-2 mb-5">
      <p className="section-label">Thème</p>
      <div className="flex flex-wrap gap-2 mt-3">
        {allToc.slice(0, 12).map((t, i) => (
          <button key={i} onClick={() => setSelectedTopic(t)}
            className={`px-3 py-1.5 rounded font-label text-xs transition-all border ${selectedTopic === t ? "bg-[#00e5c8]/8 border-[#00e5c8]/30 text-[#00e5c8]" : "border-[#1a2332] text-[#4a5568] hover:border-[#4a5568] hover:text-[#e8edf5]"}`}>
            {t.length > 40 ? t.slice(0, 40) + "…" : t}
          </button>
        ))}
      </div>
    </div>
  );

  // ─── COURS ───
  if (tab === "cours") {
    return (
      <div className="max-w-3xl space-y-4 pb-24">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-light text-white">Cours IA</h2>
            <div className="w-10 h-0.5 bg-[#00e5c8] rounded-full mt-2"></div>
          </div>
          {!courseText && !courseLoading && (
            <button onClick={generateCourse}
              className="px-4 py-2 rounded bg-[#00e5c8]/8 border border-[#00e5c8]/20 text-[#00e5c8] font-label text-xs hover:bg-[#00e5c8]/15 transition-colors">
              Générer le cours
            </button>
          )}
        </div>

        {!courseText && !courseLoading && topicSelector}

        {courseLoading && !courseText && (
          <div className="panel p-6 flex items-center gap-3 text-[#4a5568]">
            <div className="animate-spin w-4 h-4 border border-[#00e5c8] rounded-full border-t-transparent"></div>
            <span className="font-label text-xs">Génération en cours</span>
          </div>
        )}

        {courseText && (
          <>
            <div ref={courseRef} className="space-y-0">
              {courseSections.length > 0 ? courseSections.map((section, idx) => {
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
                              <span className="text-[#ff6b4a] font-label text-[0.65rem] uppercase tracking-widest">Exemple concret</span>
                              {exampleLoading === sectionKey && <div className="animate-spin w-3 h-3 border border-[#ff6b4a] rounded-full border-t-transparent"></div>}
                            </div>
                            <div className="rounded p-4 bg-[#ff6b4a]/4 border border-[#ff6b4a]/15">
                              <div className="prose-cockpit text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(expandedExamples[sectionKey] || "") }} />
                            </div>
                            <button onClick={() => setExpandedExamples(prev => { const n = { ...prev }; delete n[sectionKey]; return n; })}
                              className="text-[#4a5568] hover:text-white font-label text-xs transition-colors">
                              Masquer
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => generateExample(sectionKey)} disabled={exampleLoading !== null}
                            className="px-3 py-1.5 rounded border border-[#ff6b4a]/15 text-[#ff6b4a] font-label text-xs hover:bg-[#ff6b4a]/8 transition-colors disabled:opacity-40">
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
              )}
            </div>

            {/* Q&A answer */}
            {(qaAnswer || qaLoading) && (
              <div ref={qaRef} className="panel p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[#00e5c8] font-label text-[0.65rem] uppercase tracking-widest">Réponse IA</span>
                  {qaLoading && <div className="animate-spin w-3 h-3 border border-[#00e5c8] rounded-full border-t-transparent"></div>}
                </div>
                {qaAnswer && <div className="prose-cockpit" dangerouslySetInnerHTML={{ __html: renderMarkdown(qaAnswer) }} />}
              </div>
            )}

            {/* Q&A input — sticky bottom scoped to content area */}
            <div className="fixed bottom-0 right-0 left-60 bg-[#08090d]/95 backdrop-blur border-t border-[#1a2332] px-6 py-3 z-20">
              <div className="max-w-3xl flex gap-3">
                <input value={qaQuestion} onChange={e => setQaQuestion(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askQuestion(); } }}
                  placeholder="Posez une question sur le cours…"
                  className="flex-1 bg-[#0d1117] border border-[#1a2332] rounded px-4 py-2.5 text-sm text-white placeholder-[#4a5568] focus:border-[#00e5c8]/30 focus:outline-none font-light" />
                <button onClick={askQuestion} disabled={qaLoading || !qaQuestion.trim()}
                  className="px-4 py-2.5 rounded bg-[#00e5c8]/8 border border-[#00e5c8]/20 text-[#00e5c8] font-label text-xs hover:bg-[#00e5c8]/15 transition-colors disabled:opacity-40 shrink-0">
                  {qaLoading ? "…" : "Demander"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // ─── EXERCICES ───
  if (tab === "exercices") {
    return (
      <div className="max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-light text-white">Exercices pratiques</h2>
            <div className="w-10 h-0.5 bg-[#00e5c8] rounded-full mt-2"></div>
          </div>
          <button onClick={generateExercises} disabled={exercisesLoading}
            className="px-4 py-2 rounded bg-[#00c896]/8 border border-[#00c896]/20 text-[#00c896] font-label text-xs hover:bg-[#00c896]/15 transition-colors disabled:opacity-40">
            {exercisesLoading ? "Génération…" : exercisesText ? "Régénérer" : "Générer 3 exercices"}
          </button>
        </div>

        {topicSelector}

        {exercisesLoading && !exercisesText && (
          <div className="panel p-6 flex items-center gap-3 text-[#4a5568]">
            <div className="animate-spin w-4 h-4 border border-[#00c896] rounded-full border-t-transparent"></div>
            <span className="font-label text-xs">Génération des exercices…</span>
          </div>
        )}

        {exercisesText && (
          <div className="panel p-6">
            <div className="prose-cockpit" dangerouslySetInnerHTML={{ __html: renderMarkdown(exercisesText) }} />
          </div>
        )}
      </div>
    );
  }

  // ─── QCM ───
  if (tab === "qcm") {
    return (
      <div className="max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-light text-white">QCM adaptatifs</h2>
            <div className="w-10 h-0.5 bg-[#00e5c8] rounded-full mt-2"></div>
          </div>
          {(questions.length === 0 || quizSubmitted) && (
            <button onClick={generateQuiz} disabled={quizLoading}
              className="px-4 py-2 rounded bg-[#00e5c8]/8 border border-[#00e5c8]/20 text-[#00e5c8] font-label text-xs hover:bg-[#00e5c8]/15 transition-colors disabled:opacity-40">
              {quizLoading ? "Génération…" : questions.length > 0 ? "Nouveau QCM" : "Générer un QCM"}
            </button>
          )}
        </div>

        {questions.length === 0 && !quizLoading && topicSelector}

        {quizLoading && questions.length === 0 && (
          <div className="panel p-6 flex items-center gap-3 text-[#4a5568]">
            <div className="animate-spin w-4 h-4 border border-[#00e5c8] rounded-full border-t-transparent"></div>
            <span className="font-label text-xs">Génération du QCM…</span>
          </div>
        )}

        {questions.length > 0 && (
          <>
            <div className="space-y-4">
              {questions.map((q, qi) => {
                const answered = answers[q.id] !== undefined;
                const isCorrect = answers[q.id] === q.correct;
                return (
                  <div key={q.id} className={`panel p-5 space-y-4 fade-in ${quizSubmitted ? (answered ? (isCorrect ? "border-[#00c896]/25" : "border-[#ff6b4a]/25") : "border-[#ff6b4a]/15") : ""}`}
                    style={{ animationDelay: `${qi * 0.08}s` }}>
                    <div className="flex items-start gap-3">
                      <span className="text-[#00e5c8] font-label text-xs pt-0.5 shrink-0">{String(qi + 1).padStart(2, "0")}</span>
                      <div className="flex-1 space-y-1">
                        <p className="text-white text-sm leading-relaxed">{q.question}</p>
                        <div className="flex gap-3">
                          <span className="font-label text-[0.65rem] text-[#4a5568]">{q.topic}</span>
                          <span className={`font-label text-[0.65rem] ${DIFF_COLOR[q.difficulty]}`}>{q.difficulty}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {q.options.map((opt, oi) => {
                        let cls = "border-[#1a2332] text-[#e8edf5] hover:border-[#4a5568]";
                        if (quizSubmitted) {
                          if (oi === q.correct) cls = "border-[#00c896]/40 bg-[#00c896]/6 text-[#00c896]";
                          else if (oi === answers[q.id]) cls = "border-[#ff6b4a]/40 bg-[#ff6b4a]/6 text-[#ff6b4a]";
                          else cls = "border-[#1a2332] text-[#4a5568]";
                        } else if (answers[q.id] === oi) {
                          cls = "border-[#00e5c8]/40 bg-[#00e5c8]/6 text-[#00e5c8]";
                        }
                        return (
                          <button key={oi} disabled={quizSubmitted} onClick={() => setAnswers(a => ({ ...a, [q.id]: oi }))}
                            className={`text-left px-4 py-2.5 rounded border font-light text-sm transition-all ${cls}`}>
                            <span className="text-[#4a5568] mr-2 font-label">{["A", "B", "C", "D"][oi]}.</span>{opt}
                          </button>
                        );
                      })}
                    </div>

                    {quizSubmitted && (
                      <div className={`rounded p-3 text-sm ${isCorrect ? "bg-[#00c896]/6 border border-[#00c896]/15 text-[#00c896]" : "bg-[#ff6b4a]/6 border border-[#ff6b4a]/15 text-[#ff6b4a]"}`}>
                        <p className="font-label text-xs mb-1">{isCorrect ? "Correct" : "Incorrect"}</p>
                        <p className="text-[#e8edf5] text-xs leading-relaxed font-light">{q.explanation}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {!quizSubmitted ? (
              <button onClick={submitQuiz} disabled={Object.keys(answers).length < questions.length}
                className="w-full py-3 rounded bg-[#00e5c8]/8 border border-[#00e5c8]/20 text-[#00e5c8] font-label text-sm hover:bg-[#00e5c8]/15 transition-colors disabled:opacity-40">
                Valider ({Object.keys(answers).length}/{questions.length})
              </button>
            ) : (
              <div className="panel p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-label text-white text-lg">
                    {questions.filter(q => answers[q.id] === q.correct).length}/{questions.length}
                  </span>
                  <span className={`font-display text-2xl ${
                    questions.filter(q => answers[q.id] === q.correct).length / questions.length >= 0.75 ? "text-[#00c896]" : "text-[#ff6b4a]"
                  }`}>
                    {Math.round(questions.filter(q => answers[q.id] === q.correct).length / questions.length * 100)}%
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ─── EXAMEN ───
  if (tab === "examen") {
    if (!examData || examData.questions.length === 0) {
      return (
        <div className="max-w-3xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-light text-white">Examen blanc</h2>
              <div className="w-10 h-0.5 bg-[#00e5c8] rounded-full mt-2"></div>
            </div>
            <button onClick={generateExam} disabled={examLoading}
              className="px-4 py-2 rounded bg-[#00e5c8]/8 border border-[#00e5c8]/20 text-[#00e5c8] font-label text-xs hover:bg-[#00e5c8]/15 transition-colors disabled:opacity-40">
              {examLoading ? "Génération…" : "Lancer un examen"}
            </button>
          </div>
          {topicSelector}
          {examLoading && (
            <div className="panel p-6 flex items-center gap-3 text-[#4a5568]">
              <div className="animate-spin w-4 h-4 border border-[#00e5c8] rounded-full border-t-transparent"></div>
              <span className="font-label text-xs">Génération de l'examen…</span>
            </div>
          )}
          {/* Session history */}
          {sessions.length > 0 && (
            <div className="panel p-4 space-y-2">
              <p className="section-label">Historique</p>
              <div className="space-y-1.5 mt-3">
                {sessions.map((s, i) => {
                  const pct = Math.round(s.score / s.total * 100);
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-[#4a5568] font-label text-xs w-20">{s.date}</span>
                      <span className={`font-label text-[0.65rem] px-2 py-0.5 rounded border ${s.type === "exam" ? "text-[#00c896] border-[#00c896]/15 bg-[#00c896]/6" : "text-[#ff6b4a] border-[#ff6b4a]/15 bg-[#ff6b4a]/6"}`}>{s.type}</span>
                      <span className="text-[#e8edf5] flex-1 truncate text-xs font-light">{s.topic}</span>
                      <span className={`font-label font-medium ${pct >= 75 ? "text-[#00c896]" : "text-[#ff6b4a]"}`}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      );
    }

    // Exam in progress
    const timeLimit = examData.duration * 60;
    const timeLeft = Math.max(0, timeLimit - examTimer);
    const timePercent = (examTimer / timeLimit) * 100;
    const answeredCount = Object.keys(examAnswers).length;
    const examScore = examData.questions.filter(q => examAnswers[q.id] === q.correct).length;
    const examPercent = Math.round((examScore / examData.questions.length) * 100);
    const examPassed = examPercent >= examData.passMark;

    return (
      <div className="max-w-3xl space-y-4">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 panel px-5 py-3 flex items-center justify-between glow-green">
          <div className="space-y-1 flex-1 mr-4">
            <div className="flex items-center justify-between">
              <span className="font-label text-[0.65rem] text-[#4a5568]">Questions répondues</span>
              <span className="font-label text-xs text-[#e8edf5]">{answeredCount}/{examData.questions.length}</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${(answeredCount / examData.questions.length) * 100}%` }}></div>
            </div>
          </div>
          <div className={`font-label text-lg font-medium tabular-nums ${timeLeft < 300 ? "text-[#ff6b4a]" : "text-[#00c896]"}`}>
            {formatTime(timeLeft)}
          </div>
        </div>

        <div className="progress-bar">
          <div className="h-full rounded" style={{ width: `${100 - timePercent}%`, background: timeLeft < 300 ? "#ff6b4a" : "#00c896", transition: "width 1s linear" }}></div>
        </div>

        <p className="font-label text-[#4a5568] text-xs">{examData.title}</p>

        <div className="space-y-4">
          {examData.questions.map((q, qi) => {
            const answered_q = examAnswers[q.id] !== undefined;
            const isCorrect = examAnswers[q.id] === q.correct;
            return (
              <div key={q.id} className={`panel p-5 space-y-4 ${examSubmitted ? (answered_q ? (isCorrect ? "border-[#00c896]/25" : "border-[#ff6b4a]/25") : "border-[#ff6b4a]/15") : ""}`}>
                <div className="flex items-start gap-3">
                  <span className="font-label text-[#00e5c8] text-xs shrink-0">{String(qi + 1).padStart(2, "0")}</span>
                  <p className="text-white text-sm leading-relaxed">{q.question}</p>
                </div>
                <div className="grid gap-2">
                  {q.options.map((opt, oi) => {
                    let cls = "border-[#1a2332] text-[#e8edf5] hover:border-[#4a5568]";
                    if (examSubmitted) {
                      if (oi === q.correct) cls = "border-[#00c896]/40 bg-[#00c896]/6 text-[#00c896]";
                      else if (oi === examAnswers[q.id]) cls = "border-[#ff6b4a]/40 bg-[#ff6b4a]/6 text-[#ff6b4a]";
                      else cls = "border-[#1a2332] text-[#4a5568]";
                    } else if (examAnswers[q.id] === oi) {
                      cls = "border-[#00e5c8]/40 bg-[#00e5c8]/6 text-[#00e5c8]";
                    }
                    return (
                      <button key={oi} disabled={examSubmitted} onClick={() => setExamAnswers(a => ({ ...a, [q.id]: oi }))}
                        className={`text-left px-4 py-2.5 rounded border font-light text-sm transition-all ${cls}`}>
                        <span className="text-[#4a5568] mr-2 font-label">{["A", "B", "C", "D"][oi]}.</span>{opt}
                      </button>
                    );
                  })}
                </div>
                {examSubmitted && <p className="text-xs text-[#e8edf5]/60 leading-relaxed pl-1 font-light">{q.explanation}</p>}
              </div>
            );
          })}
        </div>

        {!examSubmitted ? (
          <button onClick={submitExam}
            className="w-full py-3 rounded bg-[#00c896]/8 border border-[#00c896]/20 text-[#00c896] font-label text-sm hover:bg-[#00c896]/15 transition-colors">
            Remettre l'examen · {answeredCount}/{examData.questions.length}
          </button>
        ) : (
          <div className={`panel p-6 space-y-4 ${examPassed ? "border-[#00c896]/30 glow-green" : "border-[#ff6b4a]/30"}`}>
            <div className="text-center space-y-2">
              <p className="font-display text-4xl font-light" style={{ color: examPassed ? "#00c896" : "#ff6b4a" }}>{examPercent}%</p>
              <p className="text-white font-medium text-sm">{examPassed ? "Examen réussi" : "Examen non réussi"}</p>
              <p className="text-[#4a5568] font-label text-xs">{examScore}/{examData.questions.length} · Seuil {examData.passMark}% · {formatTime(examTimer)}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
