"use client";

import { useCallback, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, FileText, CheckCircle, Loader2, AlertCircle, WifiOff } from "lucide-react";
import { storage, auth } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { submitLessonPlan } from "@/app/actions/submissions";
import { toast } from "sonner";

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
  const [errorMessage, setErrorMessage] = useState("");
  const [subject, setSubject] = useState("Primary Science");
  const [gradeLevel, setGradeLevel] = useState("Grade 1");
  const [weekName, setWeekName] = useState("Week 1");

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
                gradeLevel: item.gradeLevel || "Grade 1",
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
    setFile(selectedFile);
    setErrorMessage("");

    if (!navigator.onLine) {
      setUploadState("offline");
      try {
        await storeOfflineSubmission(selectedFile, subject, weekName, gradeLevel);
        toast.info("You're offline. Lesson plan queued for upload.");
      } catch (error: unknown) {
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

      // Upload to Firebase Cloud Storage
      await new Promise<void>((resolve, reject) => {
        const uploadTask = uploadBytesResumable(storageRef, selectedFile);
        uploadTask.on(
          "state_changed",
          null,
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
      if (onUploadSuccess) onUploadSuccess();

    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error("Unknown error");
      console.error("Upload failed:", err.message);
      setUploadState("error");
      setErrorMessage(err.message || "Failed to process lesson plan. Please try again.");
    }
  }, [onUploadSuccess, subject, gradeLevel, weekName]);

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
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-left">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Subject</label>
          <select 
            value={subject} 
            onChange={(e) => setSubject(e.target.value)}
            disabled={uploadState === "uploading" || uploadState === "success"}
            className="w-full text-sm border border-slate-300 rounded-md py-1.5 px-3 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option>Primary Science</option>
            <option>Mathematics</option>
            <option>English Language</option>
            <option>History</option>
            <option>Geography</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Grade Level</label>
          <select 
            value={gradeLevel} 
            onChange={(e) => setGradeLevel(e.target.value)}
            disabled={uploadState === "uploading" || uploadState === "success"}
            className="w-full text-sm border border-slate-300 rounded-md py-1.5 px-3 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option>Grade 1</option>
            <option>Grade 2</option>
            <option>Grade 3</option>
            <option>Grade 4</option>
            <option>Grade 5</option>
            <option>Grade 6</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Week</label>
          <select 
            value={weekName} 
            onChange={(e) => setWeekName(e.target.value)}
            disabled={uploadState === "uploading" || uploadState === "success"}
            className="w-full text-sm border border-slate-300 rounded-md py-1.5 px-3 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option>Week 1</option>
            <option>Week 2</option>
            <option>Week 3</option>
            <option>Week 4</option>
            <option>Week 5</option>
            <option>Week 6</option>
          </select>
        </div>
      </div>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition ${
          uploadState === "uploading" || uploadState === "success" 
            ? "cursor-default opacity-75" 
            : "cursor-pointer"
        } ${
          isDragActive
            ? "border-amber-500 bg-amber-50/50"
            : "border-slate-300 bg-slate-50 hover:bg-slate-100"
        } ${uploadState === "error" ? "border-red-500 bg-red-50" : ""} ${
          uploadState === "offline" ? "border-zinc-500 bg-zinc-50" : ""
        }`}
      >
        <input {...getInputProps()} />
        
        {uploadState === "idle" && (
          <>
            <UploadCloud className="mx-auto h-12 w-12 text-slate-400 mb-3" />
            {isDragActive ? (
              <p className="text-sm font-medium text-amber-600">Drop the lesson plan here...</p>
            ) : (
              <div>
                <p className="text-sm font-medium text-slate-700">
                  Drag and drop your lesson plan here, or click to browse
                </p>
                <p className="text-xs text-slate-400 mt-1">Supports Cambridge formats (.docx or .pdf)</p>
              </div>
            )}
          </>
        )}

        {uploadState === "uploading" && (
          <div className="flex flex-col items-center justify-center py-4">
            <Loader2 className="h-10 w-10 text-amber-500 animate-spin mb-3" />
            <p className="text-sm font-medium text-slate-700">Encrypting & Uploading to Vault...</p>
          </div>
        )}

        {uploadState === "success" && (
          <div className="flex flex-col items-center justify-center py-4">
            <CheckCircle className="h-10 w-10 text-green-500 mb-3" />
            <p className="text-sm font-medium text-green-700">Upload Complete</p>
          </div>
        )}

        {uploadState === "offline" && (
          <div className="flex flex-col items-center justify-center py-4">
            <WifiOff className="h-10 w-10 text-zinc-500 mb-3" />
            <p className="text-sm font-medium text-zinc-700">Queued Offline</p>
            <p className="text-xs text-zinc-400 mt-1">Will automatically upload once internet returns.</p>
          </div>
        )}
      </div>

      {file && uploadState !== "idle" && (
        <div className="mt-4 p-3 bg-slate-100 rounded-lg flex items-center justify-between border border-slate-200">
          <div className="flex items-center gap-2 overflow-hidden">
            <FileText className="text-amber-600 h-5 w-5 shrink-0" />
            <span className="text-sm font-medium text-slate-700 truncate">
              {file.name}
            </span>
          </div>
          {uploadState === "error" && (
             <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 bg-red-100 text-red-800 rounded">
               <AlertCircle size={14} /> Failed
             </span>
          )}
          {uploadState === "success" && (
            <span className="text-xs font-semibold px-2 py-1 bg-green-100 text-green-800 rounded">
              Ready for Audit
            </span>
          )}
          {uploadState === "offline" && (
            <span className="text-xs font-semibold px-2 py-1 bg-zinc-200 text-zinc-800 rounded">
              Offline Queue
            </span>
          )}
        </div>
      )}

      {errorMessage && (
        <p className="mt-2 text-sm text-red-600 font-medium text-center">{errorMessage}</p>
      )}
    </div>
  );
}
