//hello
"use client";

import { useRef, useState } from "react";

export default function DriveUploader({
  sessionId,
  email,
}: {
  sessionId: string;
  email: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const SCRIPT_URL = process.env.NEXT_PUBLIC_DRIVE_UPLOAD_URL;

  const openPicker = () => inputRef.current?.click();

  const onFileChange = async (file: File | null) => {
    if (!file) return;

    setError(null);
    setUploadedUrl(null);

    // quick validation
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (JPG/PNG/WebP).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File too large. Max 10MB.");
      return;
    }

    setFileName(file.name);

    // preview
    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);

    setUploading(true);

    try {
      if (!SCRIPT_URL) throw new Error("Missing NEXT_PUBLIC_DRIVE_UPLOAD_URL in .env.local");

      const base64 = await fileToBase64(file);

      // create a nice filename in Drive
      const ext = file.name.split(".").pop() || "jpg";
      const safeEmail = email.replace(/[^a-zA-Z0-9@._-]/g, "_");
      const driveFileName = `competition_${safeEmail}_${sessionId}.${ext}`;

      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: driveFileName,
          mimeType: file.type,
          base64: base64.split(",")[1],
          meta: { sessionId, email },
        }),
      });

      const data = await res.json();

      if (!data.ok) throw new Error(data.error || "Upload failed");

      setUploadedUrl(data.url);
    } catch (e: any) {
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid gap-5">
      {/* Drop style box */}
      <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 p-6 sm:p-8 text-center">
        <div className="mx-auto mb-3 text-5xl">📸</div>

        <h3 className="text-lg sm:text-xl font-bold">
          {uploadedUrl ? "Upload complete" : "Upload your image"}
        </h3>

        <p className="mt-1 text-sm text-gray-600">
          {fileName ? (
            <>
              Selected: <span className="font-semibold">{fileName}</span>
            </>
          ) : (
            "Click the button below to choose an image."
          )}
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          disabled={uploading}
        />

        <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={openPicker}
            disabled={uploading}
            className="w-full sm:w-auto px-8 py-3 rounded-xl text-base font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 shadow-lg hover:shadow-xl hover:scale-[1.02] transition disabled:opacity-60 disabled:hover:scale-100 cursor-pointer"
          >
            {uploading ? "Uploading…" : uploadedUrl ? "Upload another image" : "Upload Image"}
          </button>

          {uploadedUrl && (
            <a
              href={uploadedUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto px-6 py-3 rounded-xl text-base font-semibold bg-gray-900 text-white hover:bg-gray-800 transition text-center"
            >
              View upload
            </a>
          )}
        </div>

        <p className="mt-4 text-xs text-gray-500">
          JPG/PNG/WebP • Max 10MB
        </p>

        {/* Status */}
        {error && (
          <p className="mt-4 text-sm font-semibold text-red-600">{error}</p>
        )}

        {uploadedUrl && !error && (
          <p className="mt-4 text-sm font-semibold text-green-700">
            ✅ Image uploaded successfully
          </p>
        )}

        {uploading && (
          <div className="mt-4 h-2 w-full max-w-md mx-auto overflow-hidden rounded-full bg-gray-200">
            <div className="h-full w-2/3 animate-pulse bg-gray-900/70" />
          </div>
        )}
      </div>

      {/* Preview */}
      {preview && (
        <div className="rounded-2xl overflow-hidden border bg-white">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <p className="font-semibold">Preview</p>
            <button
              type="button"
              className="text-sm text-gray-600 hover:text-black underline"
              onClick={() => setPreview(null)}
            >
              Remove preview
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Upload preview"
            className="w-full max-h-[420px] object-cover"
          />
        </div>
      )}
    </div>
  );
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
