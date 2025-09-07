import { useMapCtx } from "../MapContext.jsx";
import React, { useMemo, useState } from "react";
import GeometryFilter from "./GeometryFilter.jsx";

/** Top navigation: visibility chips, search, draw type selector and add toggle. */
export default function MapNavbar() {
  const { addMode, setAddMode, drawType, setDrawType, features, sidebarOpen, setSidebarOpen } =
    useMapCtx();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return (features || [])
      .filter((f) => String(f.get("name") || "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, features]);

  return (
    <div className="w-full border-b bg-white sticky top-0 z-30 dark:bg-white [color-scheme:light]">
      <div className="max-w-screen-2xl mx-auto px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-600 rotate-45" />
          <div className="text-blue-900 font-extrabold text-2xl tracking-tight">
            Başarsoft <span className="text-blue-600">Map</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <GeometryFilter />

          {/* Search */}
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name..."
              className="border rounded-lg px-3 py-1.5 text-sm w-56
                         bg-white text-slate-800 placeholder-slate-400 border-slate-300
                         focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400
                         dark:bg-white dark:text-slate-800 dark:placeholder-slate-400 dark:border-slate-300
                         [color-scheme:light]"
            />
            {query && results.length > 0 && (
              <div className="absolute z-50 mt-1 w-full max-h-64 overflow-auto bg-white dark:bg-white text-slate-800 border border-slate-200 rounded-lg shadow-xl [color-scheme:light]">
                {results.map((f, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setQuery("");
                      const ev = new CustomEvent("focus-feature", {
                        detail: { id: f.getId?.() },
                      });
                      window.dispatchEvent(ev);
                    }}
                    className="block w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
                  >
                    {String(f.get("name") || "(no name)")}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Geometry + Add */}
          <div className="flex items-stretch rounded-xl shadow-sm border focus-within:ring-2 focus-within:ring-indigo-400 overflow-hidden">
            <select
              value={drawType}
              onChange={(e) => setDrawType(e.target.value)}
              disabled={addMode}
              title="Geometry type"
              className={`px-3 py-1.5 text-sm outline-none border-0 border-r border-slate-200
                          ${addMode ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "bg-white text-slate-800"}
                          dark:bg-white dark:text-slate-800 [color-scheme:light]`}
            >
              <option value="Point">Point</option>
              <option value="LineString">LineString</option>
              <option value="Polygon">Polygon</option>
            </select>

            <button
              onClick={() => setAddMode((v) => !v)}
              title={addMode ? "Cancel drawing" : "Add new geometry"}
              className={`px-5 text-sm font-semibold tracking-wide uppercase transition-colors
                          ${addMode ? "bg-red-600 text-white hover:bg-red-700" : "bg-blue-600 text-white hover:bg-blue-700"}`}
            >
              {addMode ? "Cancel" : "Add"}
            </button>
          </div>

          {/* Sidebar toggle */}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white shadow hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-400"
            style={{ backgroundColor: "#4f46e5" }}
            title="Toggle list"
          >
            {sidebarOpen ? "Hide List" : "Show List"}
          </button>
        </div>
      </div>
    </div>
  );
}