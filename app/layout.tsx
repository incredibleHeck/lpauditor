import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "HecTech LPAuditor — Cambridge Pedagogical Compliance Platform",
  description: "Enterprise pedagogical compliance and lesson plan auditing platform for St. Adelaide International School.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased font-sans"
    >
      <body className="min-h-full flex flex-col bg-[#F8FAFC] text-[#0B132B] selection:bg-[#0B132B] selection:text-white font-sans">
        {children}
        <Toaster 
          position="top-right" 
          richColors 
          closeButton
          toastOptions={{
            className: "text-xs font-medium border border-slate-200 shadow-xs rounded-xl bg-white text-slate-900",
          }}
        />
      </body>
    </html>
  );
}
