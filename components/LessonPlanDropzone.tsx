"use client";

import { useCallback, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, FileText, CheckCircle2, Loader2, AlertCircle, WifiOff } from "lucide-react";
import { storage, auth } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { submitLessonPlan } from "@/app/actions/submissions";
import { toast } from "sonner";
import { DEPARTMENTS, GRADE_LEVELS, WEEK_OPTIONS } from "@/lib/constants";

// IndexedDB Helper Functions
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("lpauditor-offline-queue", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("submissions")) {
        db.createObjectStore("submissions", { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const storeOfflineSubmission = async (file: File, subject: string, weekName: string, gradeLevel: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("submissions", "readwrite");
    const store = transaction.objectStore("submissions");
    store.add({
      file,
      fileName: file.name,
      subject,
      weekName,
      gradeLevel,
      created_at: new Date().toISOString()
    });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

interface LessonPlanDropzoneProps {
  onUploadSuccess?: () => void;
}

export default function LessonPlanDropzone({ onUploadSuccess }: LessonPlanDropzoneProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "success" | "error" | "offline">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [subject, setSubject] = useState<string>(DEPARTMENTS[0]);
  const [gradeLevel, setGradeLevel] = useState<string>(GRADE_LEVELS[0]);
  const [weekName, setWeekName] = useState<string>(WEEK_OPTIONS[0]);

  // Sync Offline Queue when browser goes back online
  useEffect(() => {
    const syncOfflineSubmissions = async () => {
      if (!navigator.onLine) return;
      try {
        const db = await openDB();
        const transaction = db.transaction("submissions", "readwrite");
        const store = transaction.objectStore("submissions");
        const request = store.getAll();

        request.onsuccess = async () => {
          const items = request.result;
          if (items.length === 0) return;

          console.log(`Found ${items.length} offline submissions to sync...`);
          const user = auth.currentUser;
          const teacherId = user ? user.uid : "offline_user";
          
          for (const item of items) {
            try {
              const fileExt = item.fileName.split('.').pop();
              const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
              const filePath = `lesson-plans/${teacherId}/${fileName}`;
              const storageRef = ref(storage, filePath);

              await new Promise<void>((resolve, reject) => {
                const uploadTask = uploadBytesResumable(storageRef, item.file);
                uploadTask.on('state_changed', null, reject, () => resolve());
              });

              const fileUrl = await getDownloadURL(storageRef);
              const { success, error: actionError } = await submitLessonPlan({
                fileUrl,
                filePath,
                subject: item.subject,
                weekName: item.weekName,
                gradeLevel: item.gradeLevel || GRADE_LEVELS[0],
                teacherId,
              });

              if (!success) throw new Error(actionError);

              const deleteTx = db.transaction("submissions", "readwrite");
              deleteTx.objectStore("submissions").delete(item.id);
            } catch (err: unknown) {
              const errorMessage = err instanceof Error ? err.message : String(err);
              console.error(`Failed to sync offline item ID ${item.id}:`, errorMessage);
            }
          }

          if (onUploadSuccess) onUploadSuccess();
          toast.success("Offline submissions synced successfully!");
        };
      } catch (err) {
        console.error("Offline sync manager failed to initialize:", err);
      }
    };

    window.addEventListener("online", syncOfflineSubmissions);
    syncOfflineSubmissions();

    return () => {
      window.removeEventListener("online", syncOfflineSubmissions);
    };
  }, [onUploadSuccess]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const selectedFile = acceptedFiles[0];

    // Pre-flight file validation
    if (selectedFile.size > 10485760) {
      toast.error("File exceeds maximum allowed size of 10 MB.");
      setErrorMessage("File exceeds maximum allowed size of 10 MB.");
      return;
    }

    setFile(selectedFile);
    setErrorMessage("");
    setUploadProgress(0);

    if (!navigator.onLine) {
      setUploadState("offline");
      try {
        await storeOfflineSubmission(selectedFile, subject, weekName, gradeLevel);
        toast.info("You're offline. Lesson plan queued for automatic upload.");
      } catch (_err: unknown) {
        setUploadState("error");
        setErrorMessage("IndexedDB storage failed. Please connect to the internet.");
      }
      return;
    }

    setUploadState("uploading");

    try {
      const user = auth.currentUser;
      const teacherId = user ? user.uid : "anonymous_teacher";

      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `lesson-plans/${teacherId}/${fileName}`;
      const storageRef = ref(storage, filePath);

      // Upload to Firebase Cloud Storage with progress tracking
      await new Promise<void>((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, selectedFile);
        uploadTask.on(
          "state_changed",
          (snapshot) => {
            if (snapshot.totalBytes > 0) {
              const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
              setUploadProgress(progress);
            }
          },
          (err) => reject(err),
          () => resolve()
        );
      });

      const fileUrl = await getDownloadURL(storageRef);
      // Database Logging & Inngest Trigger
      const { success, error: actionError } = await submitLessonPlan({
        fileUrl,
        filePath,
        subject, 
        weekName,
        gradeLevel,
        teacherId,
      });

      if (!success) throw new Error(actionError);

      setUploadState("success");
      toast.success("Lesson plan uploaded and queued for audit!");
      if (onUploadSuccess) onUploadSuccess();

    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error("Unknown error");
      console.error("Upload failed:", err.message);
      setUploadState("error");
      setErrorMessage(err.message || "Failed to process lesson plan. Please try again.");
    }
  }, [onUploadSuccess, subject, gradeLevel, weekName]);

  const resetUploadState = () => {
    setFile(null);
    setUploadState("idle");
    setUploadProgress(0);
    setErrorMessage("");
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: (fileRejections) => {
      const errorMsg = fileRejections[0]?.errors[0]?.message;
      if (errorMsg) {
        toast.error(`File rejected: ${errorMsg}`);
        setErrorMessage(`File rejected: ${errorMsg}`);
      }
    },
    accept: {
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
    maxSize: 10485760, // 10MB
    disabled: uploadState === "uploading" || uploadState === "success"
  });

  return (
    <div className="w-full space-y-4 font-sans">
      {/* Configuration Pickers */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700">Subject Department</label>
          <select 
            value={subject} 
            onChange={(e) => setSubject(e.target.value)}
            disabled={uploadState === "uploading" || uploadState === "success"}
            className="w-full text-xs font-medium border border-slate-200 rounded-lg py-2 px-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all cursor-pointer shadow-2xs"
          >
            {DEPARTMENTS.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700">Grade Level</label>
          <select 
            value={gradeLevel} 
            onChange={(e) => setGradeLevel(e.target.value)}
            disabled={uploadState === "uploading" || uploadState === "success"}
            className="w-full text-xs font-medium border border-slate-200 rounded-lg py-2 px-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all cursor-pointer shadow-2xs"
          >
            {GRADE_LEVELS.map((gl) => (
              <option key={gl} value={gl}>{gl}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700">Academic Week</label>
          <select 
            value={weekName} 
            onChange={(e) => setWeekName(e.target.value)}
            disabled={uploadState === "uploading" || uploadState === "success"}
            className="w-full text-xs font-medium border border-slate-200 rounded-lg py-2 px-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all cursor-pointer shadow-2xs"
          >
            {WEEK_OPTIONS.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Drag & Drop Surface */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
          uploadState === "uploading" || uploadState === "success" 
            ? "cursor-default opacity-90" 
            : "cursor-pointer"
        } ${
          isDragActive
            ? "border-slate-900 bg-slate-100/70"
            : "border-slate-200 bg-slate-50/50 hover:bg-slate-100/50 hover:border-slate-300"
        } ${uploadState === "error" ? "border-rose-300 bg-rose-50/50" : ""} ${
          uploadState === "offline" ? "border-slate-300 bg-slate-100" : ""
        }`}
      >
        <input {...getInputProps()} />
        
        {uploadState === "idle" && (
          <div className="space-y-3">
            <div className="w-12 h-12 bg-white border border-slate-200 rounded-2xl mx-auto flex items-center justify-center text-slate-500 shadow-2xs">
              <UploadCloud size={24} />
            </div>
            {isDragActive ? (
              <p className="text-xs font-bold text-slate-900">Drop your lesson plan here…</p>
            ) : (
              <div>
                <p className="text-xs font-semibold text-slate-800">
                  Click to select or drag and drop your lesson plan document
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Accepted formats: <span className="font-semibold text-slate-600">.docx</span> or <span className="font-semibold text-slate-600">.pdf</span> • Maximum size: 10&nbsp;MB
                </p>
              </div>
            )}
          </div>
        )}

        {uploadState === "uploading" && (
          <div className="flex flex-col items-center justify-center py-2 w-full max-w-xs mx-auto space-y-3">
            <Loader2 className="h-8 w-8 text-slate-900 animate-spin" />
            <div className="text-center">
              <p className="text-xs font-bold text-slate-900">Uploading & Staging Document…</p>
              <p className="text-[11px] font-mono text-slate-500 mt-0.5">{uploadProgress}% uploaded</p>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-slate-900 h-full rounded-full transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {uploadState === "success" && (
          <div className="flex flex-col items-center justify-center py-2 space-y-2.5">
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full flex items-center justify-center">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">Upload Complete</p>
              <p className="text-[11px] text-slate-500">Document queued for automated Gemini 3.6 pedagogical audit.</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                resetUploadState();
              }}
              className="mt-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition-all shadow-xs cursor-pointer focus-visible:ring-2 focus-visible:ring-slate-900/20 active:scale-[0.99]"
            >
              + Upload Another Plan
            </button>
          </div>
        )}

        {uploadState === "offline" && (
          <div className="flex flex-col items-center justify-center py-2 space-y-2">
            <div className="w-10 h-10 bg-slate-200 text-slate-700 rounded-full flex items-center justify-center">
              <WifiOff size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">Queued Offline in Browser</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Will automatically upload and audit once network connection is restored.</p>
            </div>
          </div>
        )}
      </div>

      {file && uploadState !== "idle" && (
        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <FileText className="text-slate-700 h-4 w-4 shrink-0" />
            <span className="text-xs font-medium text-slate-800 truncate">
              {file.name}
            </span>
          </div>
          {uploadState === "error" && (
             <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-md">
               <AlertCircle size={12} /> Failed
             </span>
          )}
          {uploadState === "success" && (
            <span className="text-[11px] font-semibold px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md">
              Queued for Audit
            </span>
          )}
          {uploadState === "offline" && (
            <span className="text-[11px] font-semibold px-2 py-0.5 bg-slate-200 text-slate-800 rounded-md">
              Offline Queue
            </span>
          )}
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium flex items-center gap-2">
          <AlertCircle size={14} className="shrink-0 text-rose-600" />
          <p>{errorMessage}</p>
        </div>
      )}
    </div>
  );
}
