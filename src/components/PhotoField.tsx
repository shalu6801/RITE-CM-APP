import React, { useRef } from "react";
import { fileToDataUrl } from "../utils";
import { IconTrash } from "./Icons";

interface PhotoFieldProps {
  value: string;          // base64 data URL ("" when none)
  onChange: (dataUrl: string) => void;
  onClear: () => void;
}

/**
 * Passport-photo upload widget.
 *  • Click the empty box (or "Upload" button) → choose any image file from the computer.
 *  • Image is read locally via FileReader and stored as a base64 data URL — never leaves the device.
 *  • Click the trash icon to remove.
 *  • Click on an existing photo to replace it.
 */
export default function PhotoField({ value, onChange, onClear }: PhotoFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    // Reject obviously-too-large images so we don't blow up IndexedDB.
    if (file.size > 4 * 1024 * 1024) {
      alert("Photo is too large. Please use an image under 4 MB.");
      return;
    }
    const url = await fileToDataUrl(file);
    onChange(url);
  };

  return (
    <div className="flex items-start gap-4">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className={[
          "group relative flex h-[25.4mm] w-[25.4mm] items-center justify-center overflow-hidden",
          value ? "bg-transparent" : "rounded-lg border-2 border-dashed border-ink-200 bg-ink-50 hover:border-brand-400 hover:bg-brand-50/40",
        ].join(" ")}
        aria-label={value ? "Replace photo" : "Upload photo"}
      >
        {value ? (
          <img
            src={value}
            alt="Candidate"
            className="h-full w-full"
            style={{ objectFit: "fill" }}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center px-3 text-center text-[11px] text-ink-500">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="mb-2 text-ink-400">
              <path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z" />
              <circle cx="9" cy="10" r="2.5" />
              <path d="M21 16l-5-5-9 9" />
            </svg>
            <span className="font-medium text-ink-700">Upload photo</span>
            <span>1 inch x 1 inch</span>
          </div>
        )}
        {value && (
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-black/0 py-1 text-[11px] font-semibold text-white opacity-0 transition group-hover:bg-black/55 group-hover:opacity-100">
            Click to replace
          </span>
        )}
      </button>
      <div className="space-y-2">
        <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
          {value ? "Replace…" : "Choose image…"}
        </button>
        {value && (
          <button type="button" className="btn-danger" onClick={onClear}>
            <IconTrash size={14} /> Remove
          </button>
        )}
        <p className="text-[11px] text-ink-400">
          JPG / PNG. Saved locally in the browser; appears on the certificate's top-right.
        </p>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          await handleFile(e.target.files?.[0]);
          if (fileRef.current) fileRef.current.value = "";   // allow re-uploading the same file
        }}
      />
    </div>
  );
}
