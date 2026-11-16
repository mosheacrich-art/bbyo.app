import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "BBYO España", template: "%s · BBYO España" },
  description: "Calendario, inscripciones y gestión de los chapters de BBYO España (propuesta no oficial).",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
