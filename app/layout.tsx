import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PilotIQ — Formation ATPL Intelligente",
  description: "Préparez votre ATPL avec l'IA — cours, QCM, examens blancs, coach personnalisé",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
