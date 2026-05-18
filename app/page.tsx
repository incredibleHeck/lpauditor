import { UploadAudit } from "@/components/UploadAudit";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <header className="flex items-center justify-between py-6 px-8 border-b border-zinc-200 bg-white dark:bg-black dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs">HT</span>
          </div>
          <span className="font-semibold text-zinc-900 dark:text-zinc-50">HecTech Auditor</span>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center py-20 px-6">
        <div className="max-w-4xl w-full flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 flex flex-col gap-6 text-center md:text-left">
            <h1 className="text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 leading-[1.1]">
              Automated <span className="text-blue-600">Cambridge</span> Lesson Plan Audits.
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-lg">
              Upload your lesson plans and get an instant pedagogical compliance report powered by Gemini 1.5 Pro. Ensure high-quality teaching standards with every submission.
            </p>
            <div className="flex items-center gap-4 justify-center md:justify-start">
              <div className="flex -space-x-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-zinc-200 flex items-center justify-center overflow-hidden">
                    <div className="w-full h-full bg-zinc-300" />
                  </div>
                ))}
              </div>
              <p className="text-sm text-zinc-500 font-medium">Trusted by 500+ teachers</p>
            </div>
          </div>

          <div className="flex-1 w-full max-w-md">
            <UploadAudit />
          </div>
        </div>
      </main>

      <footer className="py-10 px-8 border-t border-zinc-200 bg-white dark:bg-black dark:border-zinc-800 text-center">
        <p className="text-sm text-zinc-500">
          © 2026 HecTech Ltd. Powered by Gemini & Supabase.
        </p>
      </footer>
    </div>
  );
}
