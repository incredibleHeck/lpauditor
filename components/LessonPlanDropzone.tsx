"use client";

import { useCallback, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, CheckCircle2, Loader2, AlertCircle, WifiOff, History, X } from "lucide-react";
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

const storeOfflineSubmission = async ({
  file,
  subject,
  weekName,
  gradeLevel,
  teacherId,
  parentSubmissionId,
  version,
  revisionNotes,
}: {
  file: File;
  subject: string;
  weekName: string;
  gradeLevel: string;
  teacherId: string;
  parentSubmissionId?: string;
  version?: number;
  revisionNotes?: string;
}): Promise<void> => {
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
      teacherId,
      parentSubmissionId,
      version,
      revisionNotes,
      created_at: new Date().toISOString()
    });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

interface LessonPlanDropzoneProps {
  onUploadSuccess?: () => void;
  initialSubject?: string;
  initialGradeLevel?: string;
  initialWeekName?: string;
  parentSubmissionId?: string;
  parentVersion?: number;
  onCancelRevision?: () => void;
}

export default function LessonPlanDropzone({ 
  onUploadSuccess,
  initialSubject,
  initialGradeLevel,
  initialWeekName,
  parentSubmissionId,
  parentVersion,
  onCancelRevision,
}: LessonPlanDropzoneProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "success" | "error" | "offline">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [subject, setSubject] = useState<string>(initialSubject || DEPARTMENTS[0]);
  const [gradeLevel, setGradeLevel] = useState<string>(initialGradeLevel || GRADE_LEVELS[0]);
  const [weekName, setWeekName] = useState<string>(initialWeekName || WEEK_OPTIONS[0]);
  const [revisionNotes, setRevisionNotes] = useState("");

  const [prevInitial, setPrevInitial] = useState({
    subject: initialSubject,
    gradeLevel: initialGradeLevel,
    weekName: initialWeekName,
  });

  if (
    initialSubject !== prevInitial.subject ||
    initialGradeLevel !== prevInitial.gradeLevel ||
    initialWeekName !== prevInitial.weekName
  ) {
    setPrevInitial({
      subject: initialSubject,
      gradeLevel: initialGradeLevel,
      weekName: initialWeekName,
    });
    if (initialSubject) setSubject(initialSubject);
    if (initialGradeLevel) setGradeLevel(initialGradeLevel);
    if (initialWeekName) setWeekName(initialWeekName);
  }

  const isRevisionMode = Boolean(parentSubmissionId);
  const nextVersion = (parentVersion || 1) + 1;

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

          const currentUser = auth.currentUser;
          
          for (const item of items) {
            try {
              const teacherId = item.teacherId || currentUser?.uid;
              if (!teacherId) {
                console.warn(`Skipping offline item ID ${item.id} due to missing authenticated teacher ID`);
                continue;
              }

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
                parentSubmissionId: item.parentSubmissionId,
                version: item.version,
                revisionNotes: item.revisionNotes,
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

    const user = auth.currentUser;
    if (!user) {
      toast.error("Authentication required to submit lesson plans.");
      setErrorMessage("You must be logged in to upload files.");
      return;
    }

    const teacherId = user.uid;

    if (!navigator.onLine) {
      setUploadState("offline");
      try {
        await storeOfflineSubmission({
          file: selectedFile,
          subject,
          weekName,
          gradeLevel,
          teacherId,
          parentSubmissionId,
          version: isRevisionMode ? nextVersion : 1,
          revisionNotes: revisionNotes.trim() || undefined,
        });
        toast.info("You're offline. Lesson plan queued for automatic upload.");
      } catch {
        setUploadState("error");
        setErrorMessage("IndexedDB storage failed. Please connect to the internet.");
      }
      return;
    }

    setUploadState("uploading");

    try {
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
        parentSubmissionId,
        version: isRevisionMode ? nextVersion : 1,
        revisionNotes: revisionNotes.trim() || undefined,
      });

      if (!success) throw new Error(actionError);

      setUploadState("success");
      toast.success(
        isRevisionMode 
          ? `Lesson plan revision (v${nextVersion}) uploaded and queued for audit!` 
          : "Lesson plan uploaded and queued for audit!"
      );
      if (onUploadSuccess) onUploadSuccess();

    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error("Unknown error");
      console.error("Upload failed:", err.message);
      setUploadState("error");
      setErrorMessage(err.message || "Failed to process lesson plan. Please try again.");
    }
  }, [onUploadSuccess, subject, gradeLevel, weekName, parentSubmissionId, isRevisionMode, nextVersion, revisionNotes]);

  const resetUploadState = () => {
    setFile(null);
    setUploadState("idle");
    setUploadProgress(0);
    setErrorMessage("");
    setRevisionNotes("");
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
      
      {/* Revision Mode Banner */}
      {isRevisionMode && (
        <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 shadow-2xs">
          <div className="flex items-center gap-2">
            <History size={16} className="text-amber-700 shrink-0" />
            <span>
              <strong>Revision Mode:</strong> Submitting <strong>Version {nextVersion}</strong> linked to previous submission.
            </span>
          </div>
          {onCancelRevision && (
            <button
              onClick={onCancelRevision}
              className="inline-flex items-center gap-1 text-amber-800 hover:text-amber-950 font-semibold px-2 py-1 rounded hover:bg-amber-100 transition-all cursor-pointer"
            >
              <X size={13} /> Cancel Revision
            </button>
          )}
        </div>
      )}

      {/* Configuration Pickers */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700">Subject Department</label>
          <select 
            value={subject} 
            onChange={(e) => setSubject(e.target.value)}
            disabled={uploadState === "uploading" || uploadState === "success" || isRevisionMode}
            className="w-full text-xs font-medium border border-slate-200 rounded-lg py-2 px-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all cursor-pointer shadow-2xs disabled:bg-slate-50 disabled:text-slate-500"
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
            disabled={uploadState === "uploading" || uploadState === "success" || isRevisionMode}
            className="w-full text-xs font-medium border border-slate-200 rounded-lg py-2 px-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all cursor-pointer shadow-2xs disabled:bg-slate-50 disabled:text-slate-500"
          >
            {GRADE_LEVELS.map((grade) => (
              <option key={grade} value={grade}>{grade}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700">Teaching Week</label>
          <select 
            value={weekName} 
            onChange={(e) => setWeekName(e.target.value)}
            disabled={uploadState === "uploading" || uploadState === "success" || isRevisionMode}
            className="w-full text-xs font-medium border border-slate-200 rounded-lg py-2 px-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all cursor-pointer shadow-2xs disabled:bg-slate-50 disabled:text-slate-500"
          >
            {WEEK_OPTIONS.map((week) => (
              <option key={week} value={week}>{week}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Revision Notes Input */}
      {isRevisionMode && (
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700">Revision Summary / Changes Made (Optional)</label>
          <input
            type="text"
            value={revisionNotes}
            onChange={(e) => setRevisionNotes(e.target.value)}
            placeholder="e.g. Added measurable SMART verbs to Starter and adjusted EAL scaffolding."
            disabled={uploadState === "uploading" || uploadState === "success"}
            className="w-full text-xs font-medium border border-slate-200 rounded-lg py-2 px-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all shadow-2xs placeholder:text-slate-400"
          />
        </div>
      )}

      {/* Dropzone Container */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[160px] ${
          isDragActive 
            ? "border-slate-900 bg-slate-100/70 scale-[0.99]" 
            : uploadState === "error"
            ? "border-rose-300 bg-rose-50/40"
            : uploadState === "success"
            ? "border-emerald-300 bg-emerald-50/40 cursor-default"
            : uploadState === "offline"
            ? "border-amber-300 bg-amber-50/40"
            : "border-slate-200 hover:border-slate-400 hover:bg-slate-50/60 bg-slate-50/30"
        }`}
      >
        <input {...getInputProps()} />

        {/* State: IDLE */}
        {uploadState === "idle" && (
          <div className="space-y-2">
            <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center">
              <UploadCloud size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">
                {isRevisionMode ? "Upload Revised Document" : "Click to select or drag & drop lesson plan"}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Supported formats: PDF (`.pdf`) or Word Document (`.docx`) • Maximum 10MB
              </p>
            </div>
          </div>
        )}

        {/* State: UPLOADING */}
        {uploadState === "uploading" && (
          <div className="space-y-3 w-full max-w-xs">
            <div className="mx-auto w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center">
              <Loader2 className="animate-spin" size={20} />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-slate-900">
                Uploading {file?.name} ({uploadProgress}%)
              </p>
              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-slate-900 h-full rounded-full transition-all duration-200" 
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-500">Initiating background Gemini pedagogical compliance audit…</p>
            </div>
          </div>
        )}

        {/* State: SUCCESS */}
        {uploadState === "success" && (
          <div className="space-y-2">
            <div className="mx-auto w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-950">
                {isRevisionMode ? `Revision v${nextVersion} Submitted Successfully!` : "Lesson Plan Submitted Successfully!"}
              </p>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                Audit is running in background. Results will appear in your dashboard shortly.
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                resetUploadState();
                if (onCancelRevision) onCancelRevision();
              }}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-2xs"
            >
              Upload Another Document
            </button>
          </div>
        )}

        {/* State: OFFLINE */}
        {uploadState === "offline" && (
          <div className="space-y-2">
            <div className="mx-auto w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
              <WifiOff size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-950">Queued in Offline Storage</p>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Your file is stored securely in browser IndexedDB and will auto-upload when you reconnect.
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                resetUploadState();
              }}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-900 text-white rounded-lg text-xs font-semibold hover:bg-amber-950 transition-all cursor-pointer"
            >
              Queue Another Plan
            </button>
          </div>
        )}

        {/* State: ERROR */}
        {uploadState === "error" && (
          <div className="space-y-2">
            <div className="mx-auto w-10 h-10 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center">
              <AlertCircle size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-rose-950">Upload Encountered an Error</p>
              <p className="text-[11px] text-rose-800 mt-0.5 max-w-sm mx-auto">
                {errorMessage}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                resetUploadState();
              }}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-all cursor-pointer"
            >
              Try Again
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
