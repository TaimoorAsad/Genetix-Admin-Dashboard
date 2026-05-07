import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

export const metadata: Metadata = {
  title: "Genetix Admin Dashboard",
  description: "Admin panel for Genetix mobile application",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
