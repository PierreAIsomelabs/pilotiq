"use client";
import { useState, useRef } from "react";

interface RadioContact { name: string; freq: string; type: string; }
interface Waypoint {
  name: string; type: string; icao?: string;
  altitude: string; heading?: number; distance?: string; elapsed?: string;
  actions: string[]; radio?: RadioContact[];
  airspace?: string; notes?: string;
}
interface NavLog {
  title: string; flightType: string; totalDistance: string; estimatedTime: string;
  cruisingLevel: string; alternates: string[]; fuelEstimate: string;
  sunriseSunset?: string; waypoints: Waypoint[];
  atcContacts: { phase: string; unit: string; freq: string; when: string }[];
  safetyAltitudes: { sector: string; msa: string }[];
  remarks: string[];
}
interface WxStation {
  icao: string; role: string; conditions: string; ceiling: string;
  visibility: string; wind: string; temperature: string; qnh: string;
  significant: string[]; vfr_ok: boolean; ifr_ok: boolean;
}
interface WxHazard { type: string; severity: string; description: string; affected: string; }
interface Briefing {
  go_nogo: string; confidence: number; summary: string;
  stations: WxStation[]; hazards: WxHazard[];
  recommendations: string[]; alternates_wx: string;
  trend: string; vfr_minima_ok: boolean; ifr_minima_ok: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  aerodrome: "text-[#00d4ff]", navaid: "text-[#ffb347]", vfr_point: "text-[#00e676]",
  fix: "text-[#c8d0e8]", ctr_entry: "text-[#ff4444]", ctr_exit: "text-[#ff4444]",
  fl_change: "text-purple-400",
};
const TYPE_ICON: Record<string, string> = {
  aerodrome: "✈", navaid: "◆", vfr_point: "●", fix: "✕",
  ctr_entry: "⊕", ctr_exit: "⊗", fl_change: "↑",
};
const SEV_COLOR: Record<string, string> = { low: "text-[#00e676]", medium: "text-[#ffb347]", high: "text-[#ff4444]" };

export default function PrepaVol() {
  const [departure, setDeparture] = useState("");
  const [destination, setDestination] = useState("");
  const [waypoints, setWaypoints] = useState<string[]>([""]);
  const [flightType, setFlightType] = useState("VFR");
  const [cruisingLevel, setCruisingLevel] = useState("");
  const [aircraft, setAircraft] = useState("PA28-180");
  const [etd, setEtd] = useState("");
  const [chartText, setChartText] = useState("");
  const [chartFile, setChartFile] = useState<string | null>(null);

  const [navLog, setNavLog] = useState<NavLog | null>(null);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [metarRaw, setMetarRaw] = useState<Record<string, { metar: string | null; taf: string | null }>>({});

  const [loading, setLoading] = useState(false);
  const [loadingWx, setLoadingWx] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"log" | "wx" | "atc" | "chart">("log");
  const [expandedWp, setExpandedWp] = useState<number | null>(0);

  const chartRef = useRef<HTMLInputElement>(null);

  const handleChartUpload = async (file: File) => {
    const fd = new FormData();
    fd.append("pdf", file);
    try {
      const res = await fetch("/api/parse", { method: "POST", body: fd });
      const data = await res.json();
      setChartText(data.preview || "");
      setChartFile(file.name);
    } catch {
      setChartFile(file.name + " (erreur parsing)");
    }
  };

  const collectIcaos = (log: NavLog): string[] => {
    const codes = new Set<string>();
    if (departure.length >= 4) codes.add(departure.toUpperCase());
    if (destination.length >= 4) codes.add(destination.toUpperCase());
    log.alternates?.forEach(a => a.length >= 4 && codes.add(a.toUpperCase()));
    log.waypoints?.forEach(wp => wp.icao && codes.add(wp.icao.toUpperCase()));
    return Array.from(codes).slice(0, 8);
  };

  const generatePlan = async () => {
    if (!departure || !destination) { setError("Départ et destination requis"); return; }
    setLoading(true); setError(""); setNavLog(null); setBriefing(null);

    try {
      const res = await fetch("/api/route-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departure: departure.toUpperCase(),
          destination: destination.toUpperCase(),
          waypoints: waypoints.filter(Boolean).map(w => w.toUpperCase()),
          flightType, cruisingLevel, aircraft,
          chartContext: chartText,
        }),
      });
      const log: NavLog = await res.json();
      if ("error" in log) throw new Error((log as unknown as { error: string }).error);
      setNavLog(log);
      setActiveTab("log");

      // Auto-fetch METAR for all aerodromes
      const icaos = collectIcaos(log);
      if (icaos.length > 0) {
        setLoadingWx(true);
        const wxRes = await fetch(`/api/metar?icaos=${icaos.join(",")}`);
        const wxData = await wxRes.json();
        setMetarRaw(wxData);

        // Auto-briefing
        const bRes = await fetch("/api/briefing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            metarData: wxData,
            flightType,
            route: `${departure} → ${destination}`,
            etd,
          }),
        });
        const bData: Briefing = await bRes.json();
        setBriefing(bData);
        setLoadingWx(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
    setLoading(false);
  };

  const goNoGoColor = (v: string) => {
    if (v?.includes("GO") && !v?.includes("NO")) return "text-[#00e676] border-[#00e676]/30 bg-[#00e676]/8";
    if (v?.includes("NO-GO")) return "text-[#ff4444] border-[#ff4444]/30 bg-[#ff4444]/8";
    return "text-[#ffb347] border-[#ffb347]/30 bg-[#ffb347]/8";
  };

  return (
    <div className="space-y-5">
      {/* ── FORM ── */}
      <div className="panel p-5 space-y-4">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-[#00d4ff] text-lg">🗺</span>
          <span className="font-mono font-bold text-white text-sm tracking-wide">Préparation de vol</span>
        </div>

        {/* Départ / Arrivée */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="font-mono text-xs text-[#3d4460] uppercase tracking-widest">Départ</label>
            <input
              value={departure} onChange={e => setDeparture(e.target.value.toUpperCase())}
              placeholder="LFRS"
              className="w-full bg-[#08090c] border border-[#1c2030] rounded px-3 py-2 font-mono text-sm text-white placeholder-[#3d4460] focus:border-[#00d4ff]/40 focus:outline-none uppercase"
            />
          </div>
          <div className="space-y-1">
            <label className="font-mono text-xs text-[#3d4460] uppercase tracking-widest">Destination</label>
            <input
              value={destination} onChange={e => setDestination(e.target.value.toUpperCase())}
              placeholder="LFPB"
              className="w-full bg-[#08090c] border border-[#1c2030] rounded px-3 py-2 font-mono text-sm text-white placeholder-[#3d4460] focus:border-[#00d4ff]/40 focus:outline-none uppercase"
            />
          </div>
        </div>

        {/* Waypoints */}
        <div className="space-y-1">
          <label className="font-mono text-xs text-[#3d4460] uppercase tracking-widest">Étapes intermédiaires</label>
          <div className="space-y-2">
            {waypoints.map((wp, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={wp} onChange={e => { const n = [...waypoints]; n[i] = e.target.value.toUpperCase(); setWaypoints(n); }}
                  placeholder={`Étape ${i + 1} (ex: NANTES VOR, LORIENT, GL)`}
                  className="flex-1 bg-[#08090c] border border-[#1c2030] rounded px-3 py-2 font-mono text-xs text-white placeholder-[#3d4460] focus:border-[#00d4ff]/40 focus:outline-none"
                />
                {waypoints.length > 1 && (
                  <button onClick={() => setWaypoints(waypoints.filter((_, j) => j !== i))} className="px-2 text-[#3d4460] hover:text-[#ff4444] transition-colors font-mono">×</button>
                )}
              </div>
            ))}
            <button onClick={() => setWaypoints([...waypoints, ""])} className="text-[#3d4460] hover:text-[#00d4ff] font-mono text-xs transition-colors">+ Ajouter une étape</button>
          </div>
        </div>

        {/* Type + niveau + appareil + ETD */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="font-mono text-xs text-[#3d4460] uppercase tracking-widest">Type de vol</label>
            <select value={flightType} onChange={e => setFlightType(e.target.value)}
              className="w-full bg-[#08090c] border border-[#1c2030] rounded px-3 py-2 font-mono text-xs text-white focus:border-[#00d4ff]/40 focus:outline-none">
              <option>VFR</option>
              <option>IFR</option>
              <option>VFR de nuit</option>
              <option>VFR + Transit CTR</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="font-mono text-xs text-[#3d4460] uppercase tracking-widest">Niveau croisière</label>
            <input value={cruisingLevel} onChange={e => setCruisingLevel(e.target.value.toUpperCase())}
              placeholder="FL065 / 2500ft"
              className="w-full bg-[#08090c] border border-[#1c2030] rounded px-3 py-2 font-mono text-xs text-white placeholder-[#3d4460] focus:border-[#00d4ff]/40 focus:outline-none" />
          </div>
          <div className="space-y-1">
            <label className="font-mono text-xs text-[#3d4460] uppercase tracking-widest">Aéronef</label>
            <input value={aircraft} onChange={e => setAircraft(e.target.value)}
              placeholder="PA28 / C172 / TB20"
              className="w-full bg-[#08090c] border border-[#1c2030] rounded px-3 py-2 font-mono text-xs text-white placeholder-[#3d4460] focus:border-[#00d4ff]/40 focus:outline-none" />
          </div>
          <div className="space-y-1">
            <label className="font-mono text-xs text-[#3d4460] uppercase tracking-widest">ETD (UTC)</label>
            <input value={etd} onChange={e => setEtd(e.target.value)}
              placeholder="14:30 UTC"
              className="w-full bg-[#08090c] border border-[#1c2030] rounded px-3 py-2 font-mono text-xs text-white placeholder-[#3d4460] focus:border-[#00d4ff]/40 focus:outline-none" />
          </div>
        </div>

        {/* Chart upload */}
        <div className="flex items-center gap-3">
          <input ref={chartRef} type="file" accept=".pdf" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleChartUpload(f); }} />
          <button onClick={() => chartRef.current?.click()}
            className={`px-3 py-1.5 rounded border font-mono text-xs transition-all ${chartFile ? "border-[#00e676]/30 text-[#00e676] bg-[#00e676]/5" : "border-[#1c2030] text-[#3d4460] hover:border-[#3d4460] hover:text-white"}`}>
            {chartFile ? `✓ ${chartFile.slice(0, 30)}…` : "📎 Carte OACI (optionnel)"}
          </button>
          {chartFile && <span className="text-[#3d4460] font-mono text-xs">Contenu extrait — enrichit l'analyse IA</span>}
        </div>

        {error && <p className="text-[#ff4444] font-mono text-xs">{error}</p>}

        <button onClick={generatePlan} disabled={loading}
          className="w-full py-2.5 rounded bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-[#00d4ff] font-mono font-medium text-sm hover:bg-[#00d4ff]/20 transition-colors disabled:opacity-40">
          {loading ? "Calcul du routage en cours…" : "✈ Générer le plan de vol + briefing météo"}
        </button>
      </div>

      {/* ── RESULTS ── */}
      {navLog && (
        <div className="space-y-4 fade-in">
          {/* Summary header */}
          <div className="panel p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ["Route", navLog.title],
              ["Distance", navLog.totalDistance],
              ["Durée", navLog.estimatedTime],
              ["Niveau", navLog.cruisingLevel],
            ].map(([k, v]) => (
              <div key={k} className="space-y-0.5">
                <p className="font-mono text-xs text-[#3d4460] uppercase tracking-widest">{k}</p>
                <p className="font-mono text-sm text-white font-medium">{v}</p>
              </div>
            ))}
            {navLog.fuelEstimate && (
              <div className="space-y-0.5 col-span-2">
                <p className="font-mono text-xs text-[#3d4460] uppercase tracking-widest">Carburant</p>
                <p className="font-mono text-sm text-[#ffb347]">{navLog.fuelEstimate}</p>
              </div>
            )}
            {navLog.alternates?.length > 0 && (
              <div className="space-y-0.5 col-span-2">
                <p className="font-mono text-xs text-[#3d4460] uppercase tracking-widest">Alternates</p>
                <p className="font-mono text-sm text-white">{navLog.alternates.join(" · ")}</p>
              </div>
            )}
          </div>

          {/* Go/No-Go banner */}
          {briefing && (
            <div className={`panel p-4 flex items-center justify-between border ${goNoGoColor(briefing.go_nogo)}`}>
              <div className="flex items-center gap-4">
                <span className="font-mono font-bold text-2xl">{briefing.go_nogo}</span>
                <span className="text-[#c8d0e8] text-sm">{briefing.summary}</span>
              </div>
              <div className="text-right">
                <p className="font-mono text-xs text-[#3d4460]">Confiance météo</p>
                <p className="font-mono font-bold">{briefing.confidence}%</p>
              </div>
            </div>
          )}
          {loadingWx && !briefing && (
            <div className="panel p-3 flex items-center gap-3">
              <div className="animate-spin w-4 h-4 border border-[#00d4ff] rounded-full border-t-transparent shrink-0"></div>
              <span className="font-mono text-sm text-[#3d4460]">Récupération des METAR/TAF en cours…</span>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 border-b border-[#1c2030]">
            {(["log", "wx", "atc", "chart"] as const).map(tab => {
              const labels: Record<string, string> = { log: "Log de nav", wx: "Météo", atc: "Contacts ATC", chart: "Carte" };
              const disabled = tab === "wx" && !briefing;
              return (
                <button key={tab} onClick={() => !disabled && setActiveTab(tab)} disabled={disabled}
                  className={`px-4 py-2 font-mono text-xs transition-colors border-b-2 -mb-px ${activeTab === tab ? "border-[#00d4ff] text-[#00d4ff]" : "border-transparent text-[#3d4460] hover:text-white"} ${disabled ? "opacity-30 cursor-not-allowed" : ""}`}>
                  {labels[tab]}
                </button>
              );
            })}
          </div>

          {/* ── LOG DE NAV ── */}
          {activeTab === "log" && (
            <div className="space-y-2">
              {navLog.waypoints.map((wp, i) => (
                <div key={i} className={`panel transition-all ${expandedWp === i ? "border-[#00d4ff]/20" : ""}`}>
                  <button className="w-full px-4 py-3 flex items-center gap-4 text-left"
                    onClick={() => setExpandedWp(expandedWp === i ? null : i)}>
                    {/* Step indicator */}
                    <div className="flex flex-col items-center shrink-0">
                      <div className={`w-7 h-7 rounded-full border flex items-center justify-center text-sm ${expandedWp === i ? "border-[#00d4ff]/40 bg-[#00d4ff]/10" : "border-[#1c2030]"}`}>
                        <span className={TYPE_COLORS[wp.type] || "text-[#c8d0e8]"}>{TYPE_ICON[wp.type] || "•"}</span>
                      </div>
                      {i < navLog.waypoints.length - 1 && <div className="w-px h-3 bg-[#1c2030] mt-1"></div>}
                    </div>
                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-white text-sm">{wp.name}</span>
                        {wp.icao && <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-[#00d4ff]/10 text-[#00d4ff] border border-[#00d4ff]/20">{wp.icao}</span>}
                        <span className="font-mono text-xs text-[#ffb347]">{wp.altitude}</span>
                      </div>
                      {wp.airspace && <p className="font-mono text-xs text-[#3d4460] truncate mt-0.5">{wp.airspace}</p>}
                    </div>
                    {/* Times */}
                    <div className="text-right shrink-0 hidden md:block">
                      {wp.elapsed && <p className="font-mono text-xs text-[#c8d0e8]">{wp.elapsed}</p>}
                      {wp.distance && <p className="font-mono text-xs text-[#3d4460]">{wp.distance}</p>}
                      {wp.heading !== undefined && <p className="font-mono text-xs text-[#3d4460]">{wp.heading}°</p>}
                    </div>
                    <span className={`text-[#3d4460] font-mono text-xs shrink-0 ${expandedWp === i ? "text-[#00d4ff]" : ""}`}>{expandedWp === i ? "▲" : "▼"}</span>
                  </button>

                  {expandedWp === i && (
                    <div className="px-4 pb-4 space-y-4 border-t border-[#1c2030] pt-3">
                      {/* Actions */}
                      <div>
                        <p className="font-mono text-xs text-[#3d4460] uppercase tracking-widest mb-2">Actions requises</p>
                        <ul className="space-y-1.5">
                          {wp.actions.map((a, j) => (
                            <li key={j} className="flex gap-2 text-sm text-[#c8d0e8]">
                              <span className="text-[#00d4ff] shrink-0 font-mono">›</span>{a}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {/* Radio */}
                      {wp.radio && wp.radio.length > 0 && (
                        <div>
                          <p className="font-mono text-xs text-[#3d4460] uppercase tracking-widest mb-2">Fréquences radio</p>
                          <div className="flex flex-wrap gap-2">
                            {wp.radio.map((r, j) => (
                              <div key={j} className="flex items-center gap-2 px-3 py-1.5 rounded border border-[#ffb347]/20 bg-[#ffb347]/5">
                                <span className="dot bg-[#ffb347]"></span>
                                <span className="font-mono text-xs text-[#ffb347] font-bold">{r.freq}</span>
                                <span className="font-mono text-xs text-[#c8d0e8]">{r.name}</span>
                                <span className="font-mono text-xs text-[#3d4460]">{r.type}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Notes */}
                      {wp.notes && (
                        <div className="rounded p-3 border border-[#ffb347]/20 bg-[#ffb347]/5">
                          <span className="font-mono text-xs text-[#ffb347]">⚠ {wp.notes}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Safety altitudes */}
              {navLog.safetyAltitudes?.length > 0 && (
                <div className="panel p-4 space-y-2">
                  <p className="font-mono text-xs text-[#3d4460] uppercase tracking-widest">Altitudes de sécurité (MSA)</p>
                  <div className="grid grid-cols-2 gap-2">
                    {navLog.safetyAltitudes.map((s, i) => (
                      <div key={i} className="flex justify-between items-center px-3 py-1.5 rounded border border-[#1c2030]">
                        <span className="font-mono text-xs text-[#c8d0e8]">{s.sector}</span>
                        <span className="font-mono text-xs font-bold text-[#ff4444]">{s.msa}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Remarks */}
              {navLog.remarks?.length > 0 && (
                <div className="panel p-4 space-y-2 border-[#ffb347]/20">
                  <p className="font-mono text-xs text-[#ffb347] uppercase tracking-widest">⚠ Remarques importantes</p>
                  {navLog.remarks.map((r, i) => (
                    <p key={i} className="text-sm text-[#c8d0e8] flex gap-2"><span className="text-[#ffb347]">!</span>{r}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── MÉTÉO ── */}
          {activeTab === "wx" && briefing && (
            <div className="space-y-4">
              {/* Hazards */}
              {briefing.hazards?.length > 0 && (
                <div className="space-y-2">
                  <p className="font-mono text-xs text-[#3d4460] uppercase tracking-widest">Dangers identifiés</p>
                  {briefing.hazards.map((h, i) => (
                    <div key={i} className={`panel p-3 flex gap-3 items-start ${h.severity === "high" ? "border-[#ff4444]/30" : h.severity === "medium" ? "border-[#ffb347]/30" : "border-[#00e676]/20"}`}>
                      <span className={`font-mono text-xs px-2 py-0.5 rounded border shrink-0 ${h.severity === "high" ? "text-[#ff4444] border-[#ff4444]/30 bg-[#ff4444]/8" : h.severity === "medium" ? "text-[#ffb347] border-[#ffb347]/30 bg-[#ffb347]/8" : "text-[#00e676] border-[#00e676]/30 bg-[#00e676]/8"}`}>{h.type}</span>
                      <div>
                        <p className="text-sm text-[#c8d0e8]">{h.description}</p>
                        <p className="font-mono text-xs text-[#3d4460] mt-0.5">Concerné : {h.affected}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Stations */}
              <div className="space-y-2">
                <p className="font-mono text-xs text-[#3d4460] uppercase tracking-widest">Conditions par aérodrome</p>
                {briefing.stations?.map((st, i) => (
                  <div key={i} className="panel p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-white">{st.icao}</span>
                      <span className="font-mono text-xs text-[#3d4460]">{st.role}</span>
                      <span className={`font-mono text-xs px-2 py-0.5 rounded border ml-auto ${st.conditions === "VMC" ? "text-[#00e676] border-[#00e676]/30 bg-[#00e676]/8" : st.conditions === "IMC" ? "text-[#ff4444] border-[#ff4444]/30 bg-[#ff4444]/8" : "text-[#ffb347] border-[#ffb347]/30 bg-[#ffb347]/8"}`}>{st.conditions}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      {[["Plafond", st.ceiling], ["Visibilité", st.visibility], ["Vent", st.wind], ["T° / QNH", `${st.temperature} · ${st.qnh}`]].map(([k, v]) => (
                        <div key={k}>
                          <p className="font-mono text-[#3d4460]">{k}</p>
                          <p className="font-mono text-[#c8d0e8] font-medium mt-0.5">{v}</p>
                        </div>
                      ))}
                    </div>
                    {st.significant?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {st.significant.map((s, j) => (
                          <span key={j} className="font-mono text-xs px-2 py-0.5 rounded bg-[#3d4460]/20 text-[#c8d0e8]">{s}</span>
                        ))}
                      </div>
                    )}
                    {/* Raw METAR */}
                    {metarRaw[st.icao]?.metar && (
                      <details className="mt-1">
                        <summary className="font-mono text-xs text-[#3d4460] cursor-pointer hover:text-white">METAR brut</summary>
                        <p className="font-mono text-xs text-[#3d4460] mt-1 p-2 bg-[#08090c] rounded">{metarRaw[st.icao].metar}</p>
                      </details>
                    )}
                  </div>
                ))}
              </div>

              {/* Recommendations */}
              {briefing.recommendations?.length > 0 && (
                <div className="panel p-4 space-y-2">
                  <p className="font-mono text-xs text-[#3d4460] uppercase tracking-widest">Recommandations</p>
                  {briefing.recommendations.map((r, i) => (
                    <p key={i} className="text-sm text-[#c8d0e8] flex gap-2"><span className="text-[#00d4ff]">→</span>{r}</p>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="panel p-3 space-y-1">
                  <p className="font-mono text-xs text-[#3d4460]">Tendance 3h</p>
                  <p className="text-sm text-[#c8d0e8]">{briefing.trend}</p>
                </div>
                <div className="panel p-3 space-y-1">
                  <p className="font-mono text-xs text-[#3d4460]">Conditions alternates</p>
                  <p className="text-sm text-[#c8d0e8]">{briefing.alternates_wx}</p>
                </div>
              </div>
            </div>
          )}

          {/* ── ATC ── */}
          {activeTab === "atc" && (
            <div className="space-y-3">
              <p className="font-mono text-xs text-[#3d4460] uppercase tracking-widest">Plan de contacts ATC</p>
              {navLog.atcContacts?.map((c, i) => (
                <div key={i} className="panel p-4 flex items-center gap-4">
                  <div className="w-2 h-2 rounded-full bg-[#ffb347] shrink-0"></div>
                  <div className="flex-1">
                    <p className="font-mono text-xs text-[#3d4460]">{c.phase}</p>
                    <p className="font-mono text-sm text-white font-medium mt-0.5">{c.unit}</p>
                    <p className="font-mono text-xs text-[#c8d0e8] mt-0.5">{c.when}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-lg font-bold text-[#ffb347]">{c.freq}</span>
                    <p className="font-mono text-xs text-[#3d4460]">MHz</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── CHART ── */}
          {activeTab === "chart" && (
            <div className="panel p-5 text-center space-y-3">
              <p className="font-mono text-[#3d4460] text-sm">Visualisation de la carte OACI</p>
              <p className="text-xs text-[#3d4460]">Pour le proto, l'IA utilise le texte extrait du PDF pour le routage.<br/>L'affichage cartographique avec Mapbox GL JS sera intégré en v2.</p>
              {chartFile && <p className="font-mono text-xs text-[#00e676]">✓ Carte chargée : {chartFile}</p>}
              <button onClick={() => chartRef.current?.click()}
                className="px-4 py-2 rounded border border-[#1c2030] text-[#3d4460] font-mono text-xs hover:border-[#3d4460] hover:text-white transition-colors">
                {chartFile ? "Changer la carte" : "Charger la carte OACI PDF"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
