import LessonPlanDropzone from "@/components/LessonPlanDropzone";
import { BookOpen } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 font-sans p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Sleek Enterprise Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-500">
              <BookOpen size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">
                HecTech LPAuditor
              </h1>
              <p className="text-sm text-slate-400">St. Adelaide International Schools Portal</p>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs text-slate-500 font-mono">SYSTEM: ACTIVE</p>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Left Column: Submission Form Card */}
          <div className="md:col-span-2 bg-slate-950 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-slate-200">Submit Weekly Lesson Plan</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload your document to initialize the automated Cambridge pedagogical audit.
              </p>
            </div>
            
            {/* Injecting our Dropzone */}
            <LessonPlanDropzone />
            
            <button className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold rounded-lg shadow-lg hover:shadow-amber-500/10 transition-all text-sm">
              Initialize AI Audit
            </button>
          </div>

          {/* Right Column: Mini Info Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 shadow-xl h-fit space-y-4">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              Audit Guidelines
            </h3>
            <ul className="space-y-3 text-xs text-slate-400">
              <li className="flex gap-2">
                <span className="text-amber-500">•</span>
                Ensure layout tracking forms are left intact within your Word document.
              </li>
              <li className="flex gap-2">
                <span className="text-amber-500">•</span>
                Specify dedicated Test or Assessment days directly within your main activity block.
              </li>
              <li className="flex gap-2">
                <span className="text-amber-500">•</span>
                Continuous assessment data must follow chronological subject sequencing.
              </li>
            </ul>
          </div>

        </div>

      </div>
    </main>
  );
}
