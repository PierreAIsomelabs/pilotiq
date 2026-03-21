"use client";
import type { Section, TheoryTab } from "@/lib/types";

interface SidebarProps {
  section: Section;
  theoryTab: TheoryTab;
  onSection: (s: Section) => void;
  onTheoryTab: (t: TheoryTab) => void;
  docCount: number;
}

const NAV: { id: Section; label: string; icon: string }[] = [
  { id: "theory", label: "Theory", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
  { id: "pratique", label: "Pratique", icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" },
  { id: "qt", label: "QT Training", icon: "M12 19l9 2-9-18-9 18 9-2zm0 0v-8" },
  { id: "flight-vision", label: "Flight Vision", icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" },
  { id: "parametres", label: "Paramètres", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];

const THEORY_TABS: { id: TheoryTab; label: string }[] = [
  { id: "cours", label: "Cours IA" },
  { id: "exercices", label: "Exercices" },
  { id: "qcm", label: "QCM" },
  { id: "examen", label: "Examen blanc" },
];

export default function Sidebar({ section, theoryTab, onSection, onTheoryTab, docCount }: SidebarProps) {
  return (
    <aside className="w-60 shrink-0 h-screen sticky top-0 bg-[#0a0d12] border-r border-[#00e5c8]/10 flex flex-col">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5">
        <h1 className="font-display text-xl font-light text-white tracking-tight">
          Pilot<span className="text-[#00e5c8] italic">IQ</span>
        </h1>
        <p className="font-label text-[0.6rem] tracking-[0.2em] uppercase text-[#4a5568] mt-1">ATPL Training</p>
      </div>

      <div className="w-8 h-px bg-[#00e5c8]/15 mx-5 mb-4"></div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {NAV.map(item => {
          const active = section === item.id;
          return (
            <div key={item.id}>
              <button
                onClick={() => onSection(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-all text-sm ${
                  active
                    ? "bg-[#00e5c8]/6 text-[#00e5c8] border-l-2 border-[#00e5c8]"
                    : "text-[#4a5568] hover:text-[#e8edf5] hover:bg-white/[0.02] border-l-2 border-transparent"
                }`}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                <span className="font-label text-xs">{item.label}</span>
                {item.id === "parametres" && docCount > 0 && (
                  <span className="ml-auto font-label text-[0.6rem] px-1.5 py-0.5 rounded bg-[#00e5c8]/10 text-[#00e5c8]">{docCount}</span>
                )}
              </button>

              {/* Theory sub-items */}
              {item.id === "theory" && active && (
                <div className="ml-7 mt-1 mb-1 space-y-0.5">
                  {THEORY_TABS.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => onTheoryTab(tab.id)}
                      className={`w-full text-left px-3 py-1.5 rounded text-xs font-label transition-colors ${
                        theoryTab === tab.id
                          ? "text-[#00e5c8]"
                          : "text-[#4a5568] hover:text-[#e8edf5]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-[#00e5c8]/6">
        <div className="flex items-center gap-2">
          <span className="dot bg-[#00c896]"></span>
          <span className="font-label text-[0.6rem] text-[#4a5568]">
            {docCount > 0 ? `${docCount} doc${docCount > 1 ? "s" : ""} indexé${docCount > 1 ? "s" : ""}` : "Aucun document"}
          </span>
        </div>
      </div>
    </aside>
  );
}
