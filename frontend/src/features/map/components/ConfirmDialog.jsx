import React from "react";

/** Minimal confirm dialog with overlay. */
export default function ConfirmDialog({ open, title="Confirm", message, onConfirm, onCancel }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-2xl bg-neutral-900 text-neutral-50 shadow-xl p-5">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-neutral-300 mb-5">{message}</p>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-neutral-700 hover:bg-neutral-600 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 transition"
          >
            Yes, Delete
          </button>
        </div>
      </div>
    </div>
  );
}