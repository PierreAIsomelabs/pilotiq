"use client";
import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import TheorySection from "@/components/TheorySection";
import PrepaVol from "@/components/PrepaVol";
import QTTraining from "@/components/QTTraining";
import FlightVision from "@/components/FlightVision";
import DocumentLibrary from "@/components/DocumentLibrary";
import CoachPanel from "@/components/CoachPanel";
import type { Section, TheoryTab, StoredDocument, SessionResult } from "@/lib/types";

const DOCS_KEY = "pilotiq-docs";
const SESSIONS_KEY = "pilotiq-sessions";

export default function PilotIQ() {
  const [section, setSection] = useState<Section>("theory");
  const [theoryTab, setTheoryTab] = useState<TheoryTab>("cours");
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [sessions, setSessions] = useState<SessionResult[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const storedDocs = localStorage.getItem(DOCS_KEY);
      if (storedDocs) setDocuments(JSON.parse(storedDocs));
      const storedSessions = localStorage.getItem(SESSIONS_KEY);
      if (storedSessions) setSessions(JSON.parse(storedSessions));
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  // Persist documents
  useEffect(() => {
    if (hydrated) localStorage.setItem(DOCS_KEY, JSON.stringify(documents));
  }, [documents, hydrated]);

  // Persist sessions
  useEffect(() => {
    if (hydrated) localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  }, [sessions, hydrated]);

  const allChunks = documents.flatMap(d => d.chunks);
  const allToc = [...new Set(documents.flatMap(d => d.toc))];

  const addSession = (s: SessionResult) => setSessions(prev => [...prev, s]);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-5 h-5 border border-[#00e5c8] rounded-full border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        section={section}
        theoryTab={theoryTab}
        onSection={setSection}
        onTheoryTab={setTheoryTab}
        docCount={documents.length}
      />

      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        {section === "theory" && (
          <TheorySection
            tab={theoryTab}
            allChunks={allChunks}
            allToc={allToc}
            sessions={sessions}
            onSessionAdd={addSession}
            hasDocuments={documents.length > 0}
          />
        )}
        {section === "pratique" && <PrepaVol />}
        {section === "qt" && <QTTraining />}
        {section === "flight-vision" && <FlightVision />}
        {section === "parametres" && (
          <DocumentLibrary documents={documents} onDocumentsChange={setDocuments} />
        )}
      </main>

      <CoachPanel sessions={sessions} documents={documents} />
    </div>
  );
}
