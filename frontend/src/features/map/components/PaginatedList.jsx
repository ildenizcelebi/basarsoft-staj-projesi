import React, { useEffect, useMemo, useRef, useState } from "react";
import { listGeometriesPaged } from "../../../services/geometriesApi.js";
import { useMapCtx } from "../MapContext.jsx";

const PAGE_SIZE = 10;
const TYPE_OPTIONS = ["All", "Point", "LineString", "Polygon"];

function typeBadgeCls(t) {
  if (t === "Point") return "bg-blue-50 text-blue-800";
  if (t === "Polygon") return "bg-orange-50 text-orange-800";
  if (t === "LineString") return "from-green-50 to-red-50 text-green-800 bg-gradient-to-r";
  return "bg-slate-50 text-slate-800";
}

/** Server-driven list with sorting, type filter and paging. */
export default function PaginatedList() {
  const { focusFeature, visibleTypes, setVisibleTypes } = useMapCtx();

  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("id_desc");
  const [type, setType] = useState("All");

  const [data, setData] = useState({
    items: [],
    page: 1,
    pageSize: PAGE_SIZE,
    totalItems: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const abortRef = useRef(null);

  const key = useMemo(() => ({ page, sort, type }), [page, sort, type]);

  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setErr("");
    listGeometriesPaged({ page, pageSize: PAGE_SIZE, sort, type, signal: ac.signal })
      .then(setData)
      .catch((e) => {
        if (e.name !== "AbortError") setErr(e.message || "Fetch failed");
      })
      .finally(() => setLoading(false));

    return () => ac.abort();
  }, [key]);

  function onRowClick(it) {
    if (it.type && !visibleTypes.has(it.type)) {
      const next = new Set(visibleTypes);
      next.add(it.type);
      setVisibleTypes(next);
    }
    focusFeature?.(it.id);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="p-3 border-b bg-white/95 border-slate-200 dark:bg-white/95 dark:border-slate-200">
        <div className="grid grid-cols-2 gap-2">
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className="text-sm rounded-md px-2 py-2 bg-white border border-slate-300 dark:bg-white dark:text-slate-900 dark:border-slate-300"
          >
            <option value="id_desc">Newest (id)</option>
            <option value="id_asc">Oldest (id)</option>
            <option value="name_asc">Name A→Z</option>
            <option value="name_desc">Name Z→A</option>
          </select>

          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
            className="text-sm rounded-md px-2 py-2 bg-white border border-slate-300 dark:bg-white dark:text-slate-900 dark:border-slate-300"
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-2 text-xs text-slate-600 dark:text-slate-700">
          Total: {data.totalItems} • Page {data.page}/{data.totalPages || 1}
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white dark:bg-white">
        {err && <div className="p-3 text-sm text-red-600">{String(err)}</div>}
        {loading && <div className="p-3 text-sm text-slate-600">Loading…</div>}

        <ul className="divide-y divide-slate-200">
          {data.items.map((it) => (
            <li key={it.id} className="bg-white">
              <button
                onClick={() => onRowClick(it)}
                className="w-full text-left px-3 py-2 transition-colors hover:bg-slate-100 bg-white text-slate-800 dark:bg-white dark:text-slate-900"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium truncate">{it.name || "(no name)"}</div>
                  <span className={`text-[11px] px-2 py-0.5 rounded ${typeBadgeCls(it.type)}`}>
                    {it.type || "-"}
                  </span>
                </div>
                <div className="text-xs text-slate-600">id: {it.id}</div>
              </button>
            </li>
          ))}
          {!loading && data.items.length === 0 && (
            <li className="p-4 text-sm text-slate-500 bg-white">No records</li>
          )}
        </ul>
      </div>

      <div className="p-3 border-t border-slate-2 00 flex justify-end gap-2 bg-white/95 dark:bg-white/95">
        <button
          className="px-3 py-2 rounded-md text-sm border border-slate-300 hover:bg-slate-100 bg-white text-slate-800 dark:bg-white dark:text-slate-900 dark:border-slate-300"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={loading || page <= 1}
        >
          ← Previous
        </button>
        <button
          className="px-3 py-2 rounded-md text-sm border border-slate-300 hover:bg-slate-100 bg-white text-slate-800 dark:bg-white dark:text-slate-900 dark:border-slate-300"
          onClick={() => setPage((p) => p + 1)}
          disabled={loading || page >= (data.totalPages || 1)}
        >
          Next →
        </button>
      </div>
    </div>
  );
}