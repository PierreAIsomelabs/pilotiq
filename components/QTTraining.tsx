"use client";

const AIRCRAFT = [
  { name: "A320", family: "Airbus", status: "available" as const },
  { name: "B737", family: "Boeing", status: "coming" as const },
  { name: "ATR72", family: "ATR", status: "coming" as const },
  { name: "CRJ900", family: "Bombardier", status: "coming" as const },
];

export default function QTTraining() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="font-display text-xl font-light text-white">QT Training</h2>
        <div className="w-10 h-0.5 bg-[#00e5c8] rounded-full mt-2"></div>
        <p className="text-[#4a5568] text-sm mt-3">Entraînement type rating — QCM et procédures spécifiques par aéronef.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {AIRCRAFT.map((ac, i) => (
          <div
            key={ac.name}
            className={`panel p-5 space-y-4 transition-all ${ac.status === "available" ? "hover:border-[#00e5c8]/30 cursor-pointer" : "opacity-60"}`}
          >
            {/* Placeholder image */}
            <div className="h-28 rounded bg-[#00e5c8]/4 border border-[#00e5c8]/8 flex items-center justify-center">
              <span className="font-display text-2xl font-light text-[#00e5c8]/30">{ac.name}</span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-[#00e5c8] font-label text-xs">{String(i + 1).padStart(2, "0")} —</span>
                <p className="text-white font-medium text-sm mt-0.5">{ac.name}</p>
                <p className="font-label text-[0.65rem] text-[#4a5568]">{ac.family}</p>
              </div>
              <span className={`font-label text-[0.6rem] px-2 py-1 rounded border ${
                ac.status === "available"
                  ? "text-[#00c896] border-[#00c896]/20 bg-[#00c896]/6"
                  : "text-[#4a5568] border-[#1a2332] bg-transparent"
              }`}>
                {ac.status === "available" ? "Disponible" : "Bientôt"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
