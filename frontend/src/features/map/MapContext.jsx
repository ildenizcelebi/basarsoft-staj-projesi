import React, { createContext, useContext, useState } from "react";

const MapCtx = createContext(null);

/**
 * Global map state: map instance, drawing mode, features, sidebar and visibility filters.
 */
export function MapProvider({ children }) {
  const [map, setMap] = useState(null);
  const [addMode, setAddMode] = useState(false);
  const [drawType, setDrawType] = useState("Point"); // "Point" | "LineString" | "Polygon"
  const [features, setFeatures] = useState([]); // ol/Feature[]
  const [focusFeature, setFocusFeature] = useState(() => () => {});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [listFilter, setListFilter] = useState("All"); // "All" | "Point" | "LineString" | "Polygon"
  const [visibleTypes, setVisibleTypes] = useState(new Set(["Point", "LineString", "Polygon"]));

  const value = {
    map,
    setMap,
    addMode,
    setAddMode,
    drawType,
    setDrawType,
    features,
    setFeatures,
    focusFeature,
    setFocusFeature,
    sidebarOpen,
    setSidebarOpen,
    listFilter,
    setListFilter,
    visibleTypes,
    setVisibleTypes,
  };

  return <MapCtx.Provider value={value}>{children}</MapCtx.Provider>;
}

/** Hook for accessing the map context. */
export function useMapCtx() {
  const ctx = useContext(MapCtx);
  if (!ctx) throw new Error("useMapCtx must be used inside <MapProvider>");
  return ctx;
}