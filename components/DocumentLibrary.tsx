"use client";
import { useRef, useState } from "react";
import { extractPdfText } from "@/lib/extractPdfText";
import type { StoredDocument, Chunk } from "@/lib/types";

interface Props {
  documents: StoredDocument[];
  onDocumentsChange: (docs: StoredDocument[]) => void;
}

const MAX_DOCS = 5;

export default function DocumentLibrary({ documents, onDocumentsChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async (file: File) => {
    if (documents.length >= MAX_DOCS) {
      setError(`Limite de ${MAX_DOCS} documents atteinte. Supprimez un document avant d'en ajouter.`);
      return;
    }
    if (documents.some(d => d.name === file.name)) {
      setError("Ce document est déjà dans votre bibliothèque.");
      return;
    }

    setProcessing(true);
    setError("");

    try {
      const { text, pages, scanned } = await extractPdfText(file);

      if (scanned) {
        setError("PDF scanné détecté — le texte n'a pas pu être extrait. Utilisez un PDF avec du texte sélectionnable.");
        setProcessing(false);
        return;
      }

      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, filename: file.name, pages }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const doc: StoredDocument = {
        id: crypto.randomUUID(),
        name: file.name,
        text: text.slice(0, 50000),
        pages: data.pages,
        chunks: data.chunks as Chunk[],
        toc: data.toc as string[],
        totalChars: data.totalChars,
        indexedAt: new Date().toISOString(),
      };

      onDocumentsChange([...documents, doc]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'indexation");
    }
    setProcessing(false);
  };

  const removeDoc = (id: string) => {
    onDocumentsChange(documents.filter(d => d.id !== id));
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-display text-xl font-light text-white">Paramètres</h2>
        <div className="w-10 h-0.5 bg-[#00e5c8] rounded-full mt-2"></div>
      </div>

      {/* Library */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="section-label">Ma bibliothèque</p>
          <span className="font-label text-[0.65rem] text-[#4a5568]">{documents.length}/{MAX_DOCS} documents</span>
        </div>

        {/* Document list */}
        {documents.length > 0 && (
          <div className="space-y-2">
            {documents.map((doc, i) => (
              <div key={doc.id} className="panel p-4 flex items-center gap-4">
                <span className="text-[#00e5c8] font-label text-xs shrink-0">{String(i + 1).padStart(2, "0")} —</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">{doc.name}</p>
                  <div className="flex gap-3 mt-0.5">
                    <span className="font-label text-[0.65rem] text-[#4a5568]">{doc.pages} pages</span>
                    <span className="font-label text-[0.65rem] text-[#4a5568]">{(doc.totalChars / 1000).toFixed(0)}k car.</span>
                    <span className="font-label text-[0.65rem] text-[#4a5568]">{doc.chunks.length} sections</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#00c896]/8 border border-[#00c896]/15">
                    <span className="dot bg-[#00c896]"></span>
                    <span className="font-label text-[0.6rem] text-[#00c896]">Indexé</span>
                  </span>
                  <button onClick={() => removeDoc(doc.id)} className="text-[#4a5568] hover:text-[#ff6b4a] transition-colors font-label text-xs">
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload zone */}
        <div
          className={`panel p-8 text-center cursor-pointer group transition-all hover:border-[#00e5c8]/30 ${processing ? "opacity-60 pointer-events-none" : ""}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type === "application/pdf") handleUpload(f); }}
        >
          <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
          {processing ? (
            <div className="flex items-center justify-center gap-3">
              <div className="animate-spin w-4 h-4 border border-[#00e5c8] rounded-full border-t-transparent"></div>
              <span className="font-label text-xs text-[#4a5568]">Indexation en cours...</span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full border border-dashed border-[#4a5568] group-hover:border-[#00e5c8]/40 flex items-center justify-center transition-colors">
                <svg className="w-5 h-5 text-[#4a5568] group-hover:text-[#00e5c8]/60 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div>
                <p className="text-[#e8edf5] text-sm">Ajouter un manuel</p>
                <p className="text-[#4a5568] text-xs mt-1">Glissez un PDF ou cliquez pour sélectionner</p>
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-[#ff6b4a] font-label text-xs">{error}</p>}

        {documents.length >= MAX_DOCS && (
          <p className="text-[#ff6b4a] font-label text-xs">Limite de {MAX_DOCS} documents atteinte. Supprimez un document pour en ajouter un nouveau.</p>
        )}
      </div>

      {/* Active knowledge base */}
      <div className="panel p-5 space-y-3">
        <p className="section-label">Base de connaissances active</p>
        {documents.length > 0 ? (
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div>
              <p className="text-2xl font-display font-light text-white">{documents.length}</p>
              <p className="font-label text-[0.6rem] text-[#4a5568] mt-0.5">Documents</p>
            </div>
            <div>
              <p className="text-2xl font-display font-light text-white">{documents.reduce((a, d) => a + d.pages, 0)}</p>
              <p className="font-label text-[0.6rem] text-[#4a5568] mt-0.5">Pages totales</p>
            </div>
            <div>
              <p className="text-2xl font-display font-light text-white">{documents.reduce((a, d) => a + d.chunks.length, 0)}</p>
              <p className="font-label text-[0.6rem] text-[#4a5568] mt-0.5">Sections indexées</p>
            </div>
          </div>
        ) : (
          <p className="text-[#4a5568] text-sm mt-3">Aucun document indexé. Ajoutez des manuels ATPL pour commencer.</p>
        )}
      </div>
    </div>
  );
}
