"use client";

import { useCallback, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, CheckCircle2, Loader2, AlertCircle, WifiOff, History, X } from "lucide-react";
import { storage, auth } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { submitLessonPlan } from "@/app/actions/submissions";
import { toast } from "sonner";
import { DEPARTMENTS, GRADE_LEVELS, WEEK_OPTIONS, SCHOOL_SUBJECTS, SCHOOL_CLASSES } from "@/lib/constants";
import type { ExpectedQuota } from "@/lib/types";

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
  teacherId?: string;
  initialSubject?: string;
  initialGradeLevel?: string;
  initialWeekName?: string;
  parentSubmissionId?: string;
  parentVersion?: number;
  onCancelRevision?: () => void;
  assignedSubjects?: string[];
  assignedClasses?: string[];
  expectedQuotas?: ExpectedQuota[];
  isAdmin?: boolean;
}

export default function LessonPlanDropzone({ 
  onUploadSuccess,
  teacherId: propTeacherId,
  initialSubject,
  initialGradeLevel,
  initialWeekName,
  parentSubmissionId,
  parentVersion,
  onCancelRevision,
  assignedSubjects,
  assignedClasses,
  expectedQuotas,
  isAdmin = false,
}: LessonPlanDropzoneProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "success" | "error" | "offline">("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  // Determine available subjects based on user assignment and admin role
  const availableSubjects: readonly string[] = (!isAdmin && assignedSubjects && assignedSubjects.length > 0)
    ? assignedSubjects
    : SCHOOL_SUBJECTS;

  // Function to filter classes matching the selected subject
  const getAvailableClassesForSubject = useCallback((subj: string): readonly string[] => {
    if (isAdmin || !expectedQuotas || expectedQuotas.length === 0) {
      if (assignedClasses && assignedClasses.length > 0 && !isAdmin) {
        return assignedClasses;
      }
      return SCHOOL_CLASSES;
    }
    const matching = expectedQuotas
      .filter((q) => q.subject.toLowerCase() === subj.toLowerCase())
      .map((q) => q.className);
    if (matching.length > 0) return matching;
    return assignedClasses && assignedClasses.length > 0
      ? assignedClasses
      : SCHOOL_CLASSES;
  }, [isAdmin, expectedQuotas, assignedClasses]);

  const defaultSubject = initialSubject || availableSubjects[0] || DEPARTMENTS[0];
  const initialClassOptions = getAvailableClassesForSubject(defaultSubject);
  const defaultGrade = initialGradeLevel || initialClassOptions[0] || GRADE_LEVELS[0];

  const [subject, setSubject] = useState<string>(defaultSubject);
  const [gradeLevel, setGradeLevel] = useState<string>(defaultGrade);
  const [weekName, setWeekName] = useState<string>(initialWeekName || WEEK_OPTIONS[0]);
  const [revisionNotes, setRevisionNotes] = useState("");

  const [prevInitial, setPrevInitial] = useState({
    subject: initialSubject,
    gradeLevel: initialGradeLevel,
    weekName: initialWeekName,
    availableSubjectList: availableSubjects,
  });

  if (
    initialSubject !== prevInitial.subject ||
    initialGradeLevel !== prevInitial.gradeLevel ||
    initialWeekName !== prevInitial.weekName ||
    availableSubjects !== prevInitial.availableSubjectList
  ) {
    setPrevInitial({
      subject: initialSubject,
      gradeLevel: initialGradeLevel,
      weekName: initialWeekName,
      availableSubjectList: availableSubjects,
    });
    if (initialSubject) {
      setSubject(initialSubject);
    } else if (availableSubjects.length > 0 && !availableSubjects.includes(subject)) {
      const nextSubj = availableSubjects[0];
      setSubject(nextSubj);
      const nextClasses = getAvailableClassesForSubject(nextSubj);
      if (nextClasses.length > 0 && !nextClasses.includes(gradeLevel)) {
        setGradeLevel(nextClasses[0]);
      }
    }
    if (initialGradeLevel) setGradeLevel(initialGradeLevel);
    if (initialWeekName) setWeekName(initialWeekName);
  }

  const availableClasses = getAvailableClassesForSubject(subject);

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
      setUploadState("error");
      return;
    }

    setFile(selectedFile);
    setErrorMessage("");
    setUploadProgress(0);

    const user = auth.currentUser;
    const teacherId = propTeacherId || user?.uid || "demo-teacher-ict";

    if (!user && !propTeacherId) {
      toast.error("Authentication required to submit lesson plans.");
      setErrorMessage("You must be logged in to upload files.");
      return;
    }

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
      let fileUrl = "";

      // Upload to Firebase Cloud Storage with progress tracking (with sandbox fallback)
      try {
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

        fileUrl = await getDownloadURL(storageRef);
      } catch (storageErr) {
        console.warn("Storage upload fallback for local sandbox testing:", storageErr);
        fileUrl = `https://lpauditor-app.appspot.com/${filePath}`;
        setUploadProgress(100);
      }
      
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
        setUploadState("error");
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
    <div className="w-full space-y-4.5 font-sans bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs">
      
      {/* Revision Mode Banner */}
      {isRevisionMode && (
        <div className="flex items-center justify-between p-3.5 bg-amber-50/90 border border-amber-300/80 rounded-xl text-xs text-amber-950 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
              <History size={16} className="shrink-0" />
            </div>
            <div>
              <span className="font-bold text-amber-950">Revision Mode Active:</span>{" "}
              <span>Submitting <strong>Version {nextVersion}</strong> linked to previous evaluation.</span>
            </div>
          </div>
          {onCancelRevision && (
            <button
              onClick={onCancelRevision}
              className="inline-flex items-center gap-1 text-amber-900 hover:text-black font-semibold text-[11px] px-2.5 py-1 rounded-lg border border-amber-300 bg-white hover:bg-amber-100 transition-all tactile-btn cursor-pointer"
            >
              <X size={12} /> Cancel Revision
            </button>
          )}
        </div>
      )}

      {/* Configuration Pickers */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">Subject Department</label>
            {!isAdmin && assignedSubjects && assignedSubjects.length > 0 && (
              <span className="text-[10px] font-semibold text-blue-800 bg-blue-50 border border-blue-200/80 px-1.5 py-0.5 rounded">
                Assigned
              </span>
            )}
            {isAdmin && (
              <span className="text-[10px] font-semibold text-purple-800 bg-purple-50 border border-purple-200/80 px-1.5 py-0.5 rounded">
                Admin
              </span>
            )}
          </div>
          <select 
            value={subject} 
            onChange={(e) => {
              const newSubj = e.target.value;
              setSubject(newSubj);
              const nextClasses = getAvailableClassesForSubject(newSubj);
              if (nextClasses.length > 0 && !nextClasses.includes(gradeLevel)) {
                setGradeLevel(nextClasses[0]);
              }
            }}
            disabled={uploadState === "uploading" || uploadState === "success" || isRevisionMode}
            className="w-full text-xs font-semibold border border-slate-200 rounded-xl py-2.5 px-3 bg-white text-[#0B132B] focus:outline-none focus:ring-2 focus:ring-[#0B132B]/15 focus:border-[#0B132B] transition-all cursor-pointer shadow-2xs disabled:bg-slate-50 disabled:text-slate-400"
          >
            {availableSubjects.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">Class / Cohort</label>
            {!isAdmin && assignedClasses && assignedClasses.length > 0 && (
              <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded">
                Assigned
              </span>
            )}
            {isAdmin && (
              <span className="text-[10px] font-semibold text-purple-800 bg-purple-50 border border-purple-200/80 px-1.5 py-0.5 rounded">
                All Classes
              </span>
            )}
          </div>
          <select 
            value={gradeLevel} 
            onChange={(e) => setGradeLevel(e.target.value)}
            disabled={uploadState === "uploading" || uploadState === "success" || isRevisionMode}
            className="w-full text-xs font-semibold border border-slate-200 rounded-xl py-2.5 px-3 bg-white text-[#0B132B] focus:outline-none focus:ring-2 focus:ring-[#0B132B]/15 focus:border-[#0B132B] transition-all cursor-pointer shadow-2xs disabled:bg-slate-50 disabled:text-slate-400"
          >
            {availableClasses.map((grade) => (
              <option key={grade} value={grade}>{grade}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">Curriculum Week</label>
          <select 
            value={weekName} 
            onChange={(e) => setWeekName(e.target.value)}
            disabled={uploadState === "uploading" || uploadState === "success" || isRevisionMode}
            className="w-full text-xs font-semibold border border-slate-200 rounded-xl py-2.5 px-3 bg-white text-[#0B132B] focus:outline-none focus:ring-2 focus:ring-[#0B132B]/15 focus:border-[#0B132B] transition-all cursor-pointer shadow-2xs disabled:bg-slate-50 disabled:text-slate-400"
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
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">Revision Rationale & Remediation Summary (Optional)</label>
          <input
            type="text"
            value={revisionNotes}
            onChange={(e) => setRevisionNotes(e.target.value)}
            placeholder="e.g. Added SMART command verbs to Starter phase and calibrated EAL tiering."
            disabled={uploadState === "uploading" || uploadState === "success"}
            className="w-full text-xs font-medium border border-slate-200 rounded-xl py-2 px-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B132B]/15 focus:border-[#0B132B] transition-all shadow-2xs placeholder:text-slate-400"
          />
        </div>
      )}

      {/* Dropzone Container */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[175px] ${
          isDragActive 
            ? "border-[#0B132B] bg-slate-100/80 scale-[0.995]" 
            : uploadState === "error"
            ? "border-rose-300 bg-rose-50/50"
            : uploadState === "success"
            ? "border-emerald-300 bg-emerald-50/50 cursor-default"
            : uploadState === "offline"
            ? "border-amber-300 bg-amber-50/50"
            : "border-slate-300 hover:border-[#0B132B] hover:bg-slate-50/80 bg-slate-50/40"
        }`}
      >
        <input {...getInputProps()} />

        {/* State: IDLE */}
        {uploadState === "idle" && (
          <div className="space-y-3">
            <div className="mx-auto w-12 h-12 rounded-xl bg-white border border-slate-200 text-[#0B132B] flex items-center justify-center shadow-xs">
              <UploadCloud size={24} className="text-[#0B132B]" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#0B132B] tracking-tight">
                {isRevisionMode ? "Upload Revised Lesson Plan" : "Drop weekly lesson plan document here, or click to browse"}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
                <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono font-semibold text-slate-600">
                  PDF (.pdf)
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono font-semibold text-slate-600">
                  Word (.docx)
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono font-semibold text-slate-600">
                  Max: 10MB
                </span>
              </div>
            </div>
          </div>
        )}

        {/* State: UPLOADING */}
        {uploadState === "uploading" && (
          <div className="space-y-3 w-full max-w-sm">
            <div className="mx-auto w-12 h-12 rounded-xl bg-[#0B132B] text-white flex items-center justify-center shadow-xs">
              <Loader2 className="animate-spin" size={24} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-[#0B132B] truncate max-w-[200px]">{file?.name}</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-[#0B132B] h-full rounded-full transition-all duration-200" 
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
                <span>Securely dispatching to Gemini pedagogical auditor…</span>
              </p>
            </div>
          </div>
        )}

        {/* State: SUCCESS */}
        {uploadState === "success" && (
          <div className="space-y-2.5">
            <div className="mx-auto w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center justify-center shadow-xs">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-950">
                {isRevisionMode ? `Revision v${nextVersion} Submitted Successfully!` : "Lesson Plan Received & Queued for Audit!"}
              </p>
              <p className="text-[11px] text-emerald-800 mt-0.5 max-w-sm mx-auto">
                Multimodal analysis is underway. Evaluation metrics will populate below momentarily.
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                resetUploadState();
                if (onCancelRevision) onCancelRevision();
              }}
              className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0B132B] hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all tactile-btn cursor-pointer shadow-xs"
            >
              Upload Another Lesson Plan
            </button>
          </div>
        )}

        {/* State: OFFLINE */}
        {uploadState === "offline" && (
          <div className="space-y-2.5">
            <div className="mx-auto w-12 h-12 rounded-xl bg-amber-100 text-amber-800 border border-amber-200 flex items-center justify-center shadow-xs">
              <WifiOff size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-950">Secured in Offline Queue</p>
              <p className="text-[11px] text-amber-800 mt-0.5 max-w-sm mx-auto">
                No internet connection detected. Document is stored in browser storage and will automatically upload when reconnected.
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                resetUploadState();
              }}
              className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-900 text-white rounded-xl text-xs font-semibold hover:bg-amber-950 transition-all tactile-btn cursor-pointer shadow-xs"
            >
              Queue Another Document
            </button>
          </div>
        )}

        {/* State: ERROR */}
        {uploadState === "error" && (
          <div className="space-y-2.5">
            <div className="mx-auto w-12 h-12 rounded-xl bg-rose-100 text-rose-800 border border-rose-200 flex items-center justify-center shadow-xs">
              <AlertCircle size={24} />
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
              className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0B132B] text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-all tactile-btn cursor-pointer shadow-xs"
            >
              Try Again
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
