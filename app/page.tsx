import LessonPlanDropzone from "@/components/LessonPlanDropzone";
import { BookOpen } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 font-sans p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Sleek Enterprise Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-600">
              <BookOpen size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900">
                HecTech LPAuditor
              </h1>
              <p className="text-sm text-zinc-500">St. Adelaide International Schools Portal</p>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs text-zinc-400 font-mono font-semibold tracking-wider">SYSTEM: ACTIVE</p>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Left Column: Submission Form Card */}
          <div className="md:col-span-2 bg-white border border-zinc-200 rounded-xl p-8 shadow-sm space-y-6">
            <div>
              <h2 className="text-xl font-bold text-zinc-900">Submit Weekly Lesson Plan</h2>
              <p className="text-sm text-zinc-500 mt-1">
                Upload your document to initialize the automated Cambridge pedagogical audit.
              </p>
            </div>
            
            {/* Injecting our Dropzone */}
            <LessonPlanDropzone />
            
            <button className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg shadow-md shadow-amber-200/50 transition-all text-sm uppercase tracking-wide">
              Initialize AI Audit
            </button>
          </div>

          {/* Right Column: Mini Info Card */}
          <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm h-fit space-y-5">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">
              Audit Guidelines
            </h3>
            <ul className="space-y-4 text-sm text-zinc-600">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5"></span>
                <p>Ensure layout tracking forms are left intact within your Word document.</p>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5"></span>
                <p>Specify dedicated Test or Assessment days directly within your main activity block.</p>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5"></span>
                <p>Continuous assessment data must follow chronological subject sequencing.</p>
              </li>
            </ul>
          </div>

        </div>

        <footer className="text-center pt-8 border-t border-zinc-100">
          <p className="text-xs text-zinc-400">© 2026 HecTech Ltd. Powered by Gemini & Supabase.</p>
        </footer>
      </div>
    </main>
  );
}
