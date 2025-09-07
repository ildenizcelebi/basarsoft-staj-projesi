import React, { useState } from "react";

/** Inline form for creating a new feature at the given coordinate. */
export default function AddPopup({ coord, onSave, onClose, type }) {
  const [name, setName] = useState("");
  if (!coord) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await onSave({ name });
      setName("");
      onClose?.();
    } catch {}
  }

  function handleCancel() {
    onClose?.();
  }

  return (
    <form onSubmit={handleSubmit}
          className="bg-white/95 backdrop-blur rounded-2xl shadow-xl border p-4 w-80">
      <div className="font-semibold text-slate-800 mb-2">New {type}</div>

      <label className="block text-xs text-slate-500 mb-1">Name</label>
      <input
        className="w-full border rounded px-2 py-2 text-sm mb-3 outline-none
                   bg-white text-slate-800 placeholder-slate-400 border-slate-300
                   focus:ring-2 focus:ring-blue-400 focus:border-blue-400
                   dark:bg-white dark:text-slate-800 dark:placeholder-slate-400 dark:border-slate-300
                   [color-scheme:light]"
        placeholder="e.g., Ankara"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        autoFocus
        onInvalid={(e) => e.target.setCustomValidity("Please fill out this field")}
        onInput={(e) => e.target.setCustomValidity("")}
      />

      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={handleCancel}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold shadow focus:outline-none focus:ring-4 focus:ring-offset-2"
                style={{ backgroundColor: '#dc2626', color: '#ffffff' }}>
          Cancel
        </button>
        <button type="submit"
                className="px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg focus:outline-none focus:ring-4 focus:ring-offset-2"
                style={{ backgroundColor: '#16a34a', color: '#ffffff' }}>
          Save
        </button>
      </div>
    </form>
  );
}