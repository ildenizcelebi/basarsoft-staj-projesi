import React from "react";
import { useMapCtx } from "../MapContext.jsx";

function chipBase(active) {
  return [
    "px-2 py-1 rounded-md text-xs font-medium border",
    "bg-white text-slate-800 border-slate-300",
    "hover:bg-slate-50",
    "dark:bg-white dark:text-slate-800 dark:border-slate-300",
    "[color-scheme:light]",
    active ? "ring-2 ring-indigo-400" : "",
  ].join(" ");
}

/** Chip-style type visibility toggles for Point/LineString/Polygon. */
export default function GeometryFilter() {
  const { visibleTypes, setVisibleTypes } = useMapCtx();

  const isOn = (t) => visibleTypes.has(t);
  const setOnly = (arr) => setVisibleTypes(new Set(arr));
  const toggle = (t) => {
    const next = new Set(visibleTypes);
    if (next.has(t)) next.delete(t); else next.add(t);
    setVisibleTypes(next);
  };

  return (
    <div className="flex items-center gap-1 select-none">
      <button className={chipBase(visibleTypes.size === 3)} onClick={() => setOnly(["Point","LineString","Polygon"])}>
        All
      </button>
      <button className={chipBase(visibleTypes.size === 0)} onClick={() => setOnly([])}>
        None
      </button>

      <button className={chipBase(isOn("Point"))} onClick={() => toggle("Point")}>Point</button>
      <button className={chipBase(isOn("LineString"))} onClick={() => toggle("LineString")}>Line</button>
      <button className={chipBase(isOn("Polygon"))} onClick={() => toggle("Polygon")}>Poly</button>
    </div>
  );
}