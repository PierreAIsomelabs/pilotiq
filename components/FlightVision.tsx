"use client";

export default function FlightVision() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="font-display text-xl font-light text-white">Flight Vision</h2>
        <div className="w-10 h-0.5 bg-[#00e5c8] rounded-full mt-2"></div>
        <p className="text-[#4a5568] text-sm mt-3">Cartographie interactive et visualisation de route.</p>
      </div>

      <div className="panel p-8 space-y-6">
        {/* SVG route map placeholder */}
        <div className="relative">
          <svg viewBox="0 0 600 300" className="w-full h-auto" fill="none">
            {/* Background grid */}
            {Array.from({ length: 15 }).map((_, i) => (
              <line key={`v${i}`} x1={i * 40 + 20} y1={0} x2={i * 40 + 20} y2={300} stroke="rgba(0,229,200,0.04)" strokeWidth={0.5} />
            ))}
            {Array.from({ length: 8 }).map((_, i) => (
              <line key={`h${i}`} x1={0} y1={i * 40 + 20} x2={600} y2={i * 40 + 20} stroke="rgba(0,229,200,0.04)" strokeWidth={0.5} />
            ))}

            {/* Route line */}
            <path d="M 80 220 Q 200 80 320 150 Q 440 220 520 100" stroke="#00e5c8" strokeWidth={1.5} strokeDasharray="6 4" opacity={0.5} />

            {/* Waypoints */}
            <circle cx={80} cy={220} r={6} fill="#0d1117" stroke="#00e5c8" strokeWidth={1.5} />
            <text x={80} y={245} textAnchor="middle" className="font-label" fill="#00e5c8" fontSize={9}>LFRS</text>

            <circle cx={320} cy={150} r={4} fill="#0d1117" stroke="#ff6b4a" strokeWidth={1} />
            <text x={320} y={175} textAnchor="middle" className="font-label" fill="#ff6b4a" fontSize={8}>VOR TRS</text>

            <circle cx={520} cy={100} r={6} fill="#0d1117" stroke="#00e5c8" strokeWidth={1.5} />
            <text x={520} y={125} textAnchor="middle" className="font-label" fill="#00e5c8" fontSize={9}>LFPB</text>

            {/* Compass */}
            <circle cx={540} cy={260} r={18} fill="none" stroke="rgba(0,229,200,0.15)" strokeWidth={0.5} />
            <text x={540} y={247} textAnchor="middle" fill="#4a5568" fontSize={7} className="font-label">N</text>
            <line x1={540} y1={252} x2={540} y2={268} stroke="rgba(0,229,200,0.2)" strokeWidth={0.5} />
          </svg>
        </div>

        <div className="text-center space-y-2">
          <p className="font-label text-xs text-[#4a5568] uppercase tracking-wider">Intégration Mapbox GL JS — Phase 2</p>
          <p className="text-[#4a5568] text-xs">La visualisation cartographique interactive sera disponible dans une prochaine mise à jour.</p>
        </div>
      </div>
    </div>
  );
}
