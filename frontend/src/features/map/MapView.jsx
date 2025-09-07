import React, { useMemo, useRef, useState, useEffect } from "react";
import { useMapCtx } from "./MapContext.jsx";
import AddPopup from "./components/AddPopup.jsx";
import InfoPopup from "./components/InfoPopup.jsx";

import { useMapSetup } from "./hooks/useMapSetup.js";
import { useDrawInteraction } from "./hooks/useDrawInteraction.js";
import { useInfoSelection } from "./hooks/useInfoSelection.js";
import { useTranslateMove } from "./hooks/useTranslateMove.js";
import { useCloseOnBackgroundClick } from "./hooks/useCloseOnBackgroundClick.js";
import { useMoveController } from "./hooks/useMoveController.js";
import { useModifyEdit } from "./hooks/useModifyEdit.js";

import GeoJSON from "ol/format/GeoJSON";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import { Style, Fill, Stroke } from "ol/style";

import {
  geometryFromPoint3857,
  featureFromDto,
  geometryFromFeature3857,
} from "../../utils/wkt.js";
import { addGeometry, updateGeometryName } from "../../services/geometriesApi.js";
import { pointInPolygonGeometry3857 } from "./utils/geom-utils.js";
import { styleFor } from "./utils/styles.js";

import { unionOlPolygons } from "./utils/jsts-union.js";
import {
  eraseWithJsts,
  splitToPolygonFeatures,
  cutExistingByNew,
  geometryTo4326Object,
} from "./utils/jsts-utils.js";

import toast from "react-hot-toast";

/** Visual style for the dissolved overlay polygons. */
const overlayStyle = new Style({
  fill: new Fill({ color: "rgba(0,123,255,0.18)" }),
  stroke: new Stroke({ color: "rgba(0,123,255,0.95)", width: 2 }),
  zIndex: 1100,
});

function filteredStyle(feature, visibleTypesSet) {
  const t = feature?.getGeometry?.()?.getType?.();
  if (!t) return null;
  if (!visibleTypesSet?.has?.(t)) return null;
  return styleFor(feature);
}

/**
 * Main map view orchestrating drawing, selection, move/edit and overlay union.
 * All geometries are displayed in EPSG:3857; persistence uses GeoJSON (EPSG:4326).
 */
export default function MapView() {
  const mapDivRef = useRef(null);
  const popupRef = useRef(null);
  const infoRef = useRef(null);

  const {
    setMap,
    addMode,
    setAddMode,
    drawType,
    setFeatures,
    sidebarOpen,
    features,
    setFocusFeature,
    visibleTypes,
  } = useMapCtx();

  const [currentCoord, setCurrentCoord] = useState(null);
  const [currentFeature, setCurrentFeature] = useState(null);

  const [infoFeature, setInfoFeature] = useState(null);
  const [infoCoord, setInfoCoord] = useState(null);
  const [infoGeomRev, setInfoGeomRev] = useState(0); // re-renders InfoPopup coordinate readout

  const { mapRef, vectorSourceRef, overlayRef, infoOverlayRef } = useMapSetup({
    mapDivRef,
    popupRef,
    infoRef,
    setMap,
    setFeatures,
    setErr: undefined,
    sidebarOpen,
  });

  // --- Move ---
  const { moving, startMove, cancelMove, applyMove } = useMoveController({ mapRef, infoOverlayRef });
  useTranslateMove({ mapRef, feature: infoFeature, active: moving });

  // --- Edit (vertex) ---
  const [editing, setEditing] = useState(false);
  const editOriginalGeomRef = useRef(null);
  useModifyEdit({ mapRef, feature: infoFeature, active: editing });

  function startEdit() {
    if (!infoFeature) return;
    editOriginalGeomRef.current = infoFeature.getGeometry()?.clone() || null;
    setEditing(true);
  }

  function cancelEdit() {
    if (editOriginalGeomRef.current && infoFeature) {
      infoFeature.setGeometry(editOriginalGeomRef.current);
    }
    setEditing(false);
    // Re-position the info popup to the geometry's sensible anchor.
    const g = infoFeature?.getGeometry?.();
    if (g) {
      const t = g.getType?.();
      let pos = null;
      if (t === "Point") pos = g.getCoordinates();
      else if (t === "LineString") pos = g.getLastCoordinate();
      else if (t === "Polygon") pos = g.getInteriorPoint().getCoordinates();
      else if (t === "MultiPolygon") pos = g.getInteriorPoints().getCoordinates()?.[0];
      setInfoCoord(pos);
      infoOverlayRef.current?.setPosition(pos);
      setInfoGeomRev((v) => v + 1);
    }
  }

  async function applyEditPersist() {
    if (!infoFeature) return;
    try {
      const id = infoFeature.getId?.();
      const currentName = infoFeature.get("name") || "";
      await updateGeometryName(id, currentName, infoFeature); // PUT: name + geometry
      vectorSourceRef.current?.changed?.();
      rebuildUnionOverlay();

      const g = infoFeature.getGeometry();
      const t = g.getType?.();
      let pos = null;
      if (t === "Point") pos = g.getCoordinates();
      else if (t === "LineString") pos = g.getLastCoordinate();
      else if (t === "Polygon") pos = g.getInteriorPoint().getCoordinates();
      else if (t === "MultiPolygon") pos = g.getInteriorPoints().getCoordinates()?.[0];
      setInfoCoord(pos);
      infoOverlayRef.current?.setPosition(pos);
      setInfoGeomRev((v) => v + 1);
    } catch {
      // Errors are toasted by the service layer.
    } finally {
      setEditing(false);
    }
  }

  /** Closes the info popup; cancels active move/edit if needed. */
  function closeInfoPopup(resetView = false) {
    infoOverlayRef.current?.setPosition(undefined);
    if (moving) {
      try {
        cancelMove?.(infoFeature, infoCoord);
      } catch {}
    }
    if (editing) {
      cancelEdit();
    }
    setInfoFeature(null);
    setInfoCoord(null);

    // Optional: restore initial center/zoom on close.
    if (resetView) {
      const map = mapRef.current;
      const view = map?.getView?.();
      const c = map?.__initialCenter;
      const z = map?.__initialZoom;
      if (view && c && z != null) {
        view.animate({ center: c, zoom: z, duration: 350 });
      }
    }
  }

  // --- UNION OVERLAY (dissolved polygons) ---
  const unionSrcRef = useRef(null);
  const unionLayerRef = useRef(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    unionSrcRef.current = new VectorSource();
    unionLayerRef.current = new VectorLayer({
      source: unionSrcRef.current,
      style: () => overlayStyle,
      properties: { isOverlayLayer: true },
    });
    unionLayerRef.current.setZIndex(1100);
    map.addLayer(unionLayerRef.current);
    return () => {
      if (map && unionLayerRef.current) map.removeLayer(unionLayerRef.current);
    };
  }, [mapRef]);

  function rebuildUnionOverlay() {
    const src = vectorSourceRef.current;
    const uSrc = unionSrcRef.current;
    const uLayer = unionLayerRef.current;
    const map = mapRef.current;
    if (!src || !uSrc) return;

    const showOverlay = visibleTypes?.has?.("Polygon") || visibleTypes?.has?.("MultiPolygon");
    if (uLayer) uLayer.setVisible(!!showOverlay);

    if (!showOverlay) {
      uSrc.clear();
      uSrc.changed?.();
      map?.renderSync?.();
      return;
    }

    const polys = (src.getFeatures?.() || []).filter((f) => {
      const t = f.getGeometry()?.getType?.();
      const isPoly = t === "Polygon" || t === "MultiPolygon";
      const isVisibleType = visibleTypes?.has?.(t);
      return isPoly && isVisibleType;
    });

    uSrc.clear();
    if (polys.length === 0) return;

    const dissolved = unionOlPolygons(polys);
    dissolved.forEach((f) => {
      f.set("isOverlay", true);
      f.setStyle(overlayStyle);
      uSrc.addFeature(f);
    });
    uSrc.changed?.();
    map?.renderSync?.();
  }

  // Refresh base layer styles and overlay when features or visibility change.
  useEffect(() => {
    const src = vectorSourceRef.current;
    if (!src) return;
    (src.getFeatures?.() || []).forEach((f) => f.setStyle(filteredStyle(f, visibleTypes)));
    rebuildUnionOverlay();
  }, [features, visibleTypes, vectorSourceRef]);

  // Bind style function to the primary vector layer (excluding overlay layer).
  useEffect(() => {
    const map = mapRef.current;
    const src = vectorSourceRef.current;
    if (!map || !src) return;

    let baseLayer = null;
    map.getLayers().forEach((lyr) => {
      if (lyr instanceof VectorLayer && lyr.getSource?.() === src && !lyr.get("isOverlayLayer")) {
        baseLayer = lyr;
      }
    });
    if (!baseLayer) return;

    baseLayer.setStyle((feature) => filteredStyle(feature, visibleTypes));
    baseLayer.changed();
    map.renderSync?.();
  }, [mapRef, vectorSourceRef, visibleTypes]);

  // React to source mutations to keep styles/overlay in sync.
  useEffect(() => {
    const src = vectorSourceRef.current;
    if (!src) return;
    const onAny = () => {
      (src.getFeatures?.() || []).forEach((f) => f.setStyle(filteredStyle(f, visibleTypes)));
      rebuildUnionOverlay();
    };
    src.on("addfeature", onAny);
    src.on("removefeature", onAny);
    src.on("clear", onAny);
    onAny();
    return () => {
      src.un("addfeature", onAny);
      src.un("removefeature", onAny);
      src.un("clear", onAny);
    };
  }, [vectorSourceRef, visibleTypes]);

  // Drawing flow: open AddPopup at a sensible anchor on draw end.
  const { sketchSourceRef } = useDrawInteraction({
    mapRef,
    addMode,
    drawType,
    setAddMode,
    onDrawEnd: (feat) => {
      setCurrentFeature(feat);
      const g = feat.getGeometry();
      const t = g.getType();
      let pos = null;
      if (t === "Point") pos = g.getCoordinates();
      else if (t === "LineString") pos = g.getLastCoordinate();
      else if (t === "Polygon") pos = g.getInteriorPoint().getCoordinates();
      setCurrentCoord(pos);
      overlayRef.current?.setPosition(pos);
    },
  });

  // Selection (disabled while moving/editing).
  useInfoSelection({
    mapRef,
    vectorSourceRef,
    infoOverlayRef,
    setInfoFeature,
    setInfoCoord,
    featureFilter: (feat) => !feat.get("isOverlay"),
    zoomOnSelect: true,
    enabled: !moving && !editing,
  });

  // Close popups on background clicks unless moving/editing.
  useCloseOnBackgroundClick({
    mapRef,
    infoRef,
    popupRef,
    moving: moving || editing,
    onClose: () => closeInfoPopup(false),
  });

  // Sidebar → focus feature callback.
  useEffect(() => {
    setFocusFeature(() => (idOrFeature) => {
      const src = vectorSourceRef.current;
      const map = mapRef.current;
      if (!src || !map) return;

      const f =
        idOrFeature && typeof idOrFeature === "object" && idOrFeature.getGeometry
          ? idOrFeature
          : src.getFeatureById?.(idOrFeature);
      if (!f) return;

      const g = f.getGeometry?.();
      if (!g) return;

      const t = g.getType?.();
      let pos = null;
      if (t === "Point") pos = g.getCoordinates();
      else if (t === "LineString") pos = g.getLastCoordinate();
      else if (t === "Polygon") pos = g.getInteriorPoint().getCoordinates();
      else if (t === "MultiPolygon") pos = g.getInteriorPoints().getCoordinates()?.[0];

      setInfoFeature(f);
      setInfoCoord(pos);
      infoOverlayRef.current?.setPosition(pos);

      const view = map.getView();
      const ext = g.getExtent?.();
      if (ext) {
        if (t === "Point") {
          view.animate({ center: pos, duration: 250 });
          view.animate({ zoom: Math.max(view.getZoom() || 6, 12), duration: 200 });
        } else {
          view.fit(ext, { padding: [50, 50, 50, 50], maxZoom: 12, duration: 250 });
        }
      }
    });
  }, [setFocusFeature, vectorSourceRef, infoOverlayRef, mapRef, setInfoFeature, setInfoCoord]);

  // --- Create (Add) ---
  async function handleSave({ name }) {
    if (!currentFeature) return;

    try {
      const geomType = currentFeature.getGeometry().getType();
      const map = mapRef.current;
      const viewProj = map.getView().getProjection().getCode();
      const src = vectorSourceRef.current;
      const gjFmt = new GeoJSON();

      if (geomType === "Point" || geomType === "LineString") {
        const geometry =
          geomType === "Point"
            ? geometryFromPoint3857(currentFeature.getGeometry().getCoordinates())
            : geometryFromFeature3857(currentFeature);

        const saved = await addGeometry({ name, wkt: geometry });
        const f = featureFromDto(saved?.data ?? saved ?? { WKT: geometry, Name: name });
        if (f) {
          f.setId(saved?.data?.id ?? saved?.id ?? saved?.Id ?? undefined);
          f.set("name", name);
          f.setStyle(filteredStyle(f, visibleTypes));
          src.addFeature(f);
        }
        setFeatures(src?.getFeatures?.() || []);
        handleClose();
        return;
      }

      // Polygon flow (cut existing + add remaining parts).
      const raw4326 = gjFmt.writeGeometryObject(currentFeature.getGeometry(), {
        featureProjection: viewProj,
        dataProjection: "EPSG:4326",
      });
      const saved = await addGeometry({ name, wkt: raw4326 });

      const res = map.getView().getResolution() || 1;
      const snapTol = 2 * res;

      cutExistingByNew({
        source: src,
        newFeature: currentFeature,
        styleFor: (feat) => filteredStyle(feat, visibleTypes),
        origGeomProvider: geometryTo4326Object,
        snapTol,
      });
      rebuildUnionOverlay();
      src.changed?.();
      map.renderSync?.();

      const existingAfterCut = (src?.getFeatures?.() || []).filter((ff) => {
        const t = ff.getGeometry()?.getType?.();
        return t === "Polygon" || t === "MultiPolygon";
        });

      const cleanedParts = eraseWithJsts(currentFeature, existingAfterCut, snapTol);
      if (!cleanedParts || cleanedParts.length === 0) {
        toast("New polygon is fully inside existing polygon(s); it won't be shown.", {
          id: "ui-info",
          duration: 6000,
        });
        handleClose();
        return;
      }

      const pieces = cleanedParts.flatMap((part) => splitToPolygonFeatures(part));

      pieces.forEach((piece, idx) => {
        const serverId = saved?.ids?.[idx] ?? saved?.id ?? saved?.Id;
        piece.setId(serverId != null ? `${serverId}#${idx}` : `tmp#${Date.now()}#${idx}`);
        piece.set("name", name);
        piece.set("origGeom", geometryTo4326Object(piece));
        piece.setStyle(filteredStyle(piece, visibleTypes));
        src.addFeature(piece);
      });

      rebuildUnionOverlay();
      src.changed?.();
      unionSrcRef.current?.changed?.();
      map.renderSync?.();

      setFeatures(src?.getFeatures?.() || []);
      handleClose();
    } catch {
      // Errors are toasted by the service layer.
    }
  }

  function handleClose() {
    overlayRef.current?.setPosition(undefined);
    setCurrentCoord(null);
    setCurrentFeature(null);
    sketchSourceRef?.current?.clear();
  }

  function handleInfoUpdateName(newName) {
    if (!infoFeature) return;
    const id = infoFeature.getId?.();
    infoFeature.set("name", newName);
    setFeatures((prev) =>
      (prev || []).map((f) => {
        const fid = f?.getId?.();
        return fid === id ? (() => { f.set?.("name", newName); return f; })() : f;
      })
    );
  }

  function handleInfoDelete() {
    if (!infoFeature) return;
    const src = vectorSourceRef.current;
    if (src && infoFeature) src.removeFeature(infoFeature);
    setFeatures(src?.getFeatures?.() || []);
    rebuildUnionOverlay();
    closeInfoPopup();
  }

  // Move → persist and reposition info popup.
  async function handleApplyMovePersist() {
    if (!infoFeature) return;
    try {
      const id = infoFeature.getId?.();
      const currentName = infoFeature.get("name") || "";
      await updateGeometryName(id, currentName, infoFeature);

      vectorSourceRef.current?.changed?.();
      rebuildUnionOverlay();

      const g = infoFeature.getGeometry();
      const t = g.getType?.();
      let pos = null;
      if (t === "Point") pos = g.getCoordinates();
      else if (t === "LineString") pos = g.getLastCoordinate();
      else if (t === "Polygon") pos = g.getInteriorPoint().getCoordinates();
      else if (t === "MultiPolygon") pos = g.getInteriorPoints().getCoordinates()?.[0];

      setInfoCoord(pos);
      infoOverlayRef.current?.setPosition(pos);
      setInfoGeomRev((v) => v + 1);
    } catch {
      // Errors are toasted by the service layer.
    }
  }

  /** Points that lie inside the currently selected polygon. */
  const pointsInside = useMemo(() => {
    if (!visibleTypes?.has?.("Point")) return [];
    const g = infoFeature?.getGeometry?.();
    const t = g?.getType?.();
    if (!g || (t !== "Polygon" && t !== "MultiPolygon")) return [];
    const all = features || vectorSourceRef.current?.getFeatures?.() || [];
    const pts = all.filter((ff) => {
      const gt = ff.getGeometry()?.getType?.();
      if (gt !== "Point") return false;
      const c = ff.getGeometry().getCoordinates();
      return pointInPolygonGeometry3857(c, g);
    });
    return pts.map((ff) => ({ id: ff.getId?.(), name: ff.get("name") || "(no name)" }));
  }, [infoFeature, features, vectorSourceRef, visibleTypes]);

  return (
    <div className="w-full h-full relative">
      <div
        ref={mapDivRef}
        className="absolute inset-0"
        style={{ right: sidebarOpen ? 300 : 0 }}
      />

      {/* Add popup */}
      <div ref={popupRef} className="z-20" style={{ display: currentCoord ? "block" : "none" }}>
        <AddPopup
          coord={currentCoord}
          type={currentFeature?.getGeometry()?.getType?.() || "Geometry"}
          onSave={handleSave}
          onClose={handleClose}
        />
      </div>

      {/* Info popup */}
      <div ref={infoRef} className="z-10" style={{ display: infoCoord ? "block" : "none" }}>
        <InfoPopup
          feature={infoFeature}
          onClose={() => closeInfoPopup(true)}
          onUpdateSuccess={handleInfoUpdateName}
          onDeleteSuccess={handleInfoDelete}
          // Move
          moving={moving}
          onStartMove={() => startMove(infoFeature)}
          onCancelMove={() => cancelMove(infoFeature, infoCoord)}
          onApplyMove={async () => {
            const res = applyMove({ feature: infoFeature, persist: true });
            if (res?.ok) await handleApplyMovePersist();
          }}
          // Edit
          editing={editing}
          onStartEdit={startEdit}
          onCancelEdit={cancelEdit}
          onApplyEdit={applyEditPersist}
          // Coordinate display trigger
          geomRev={infoGeomRev}
        />

        {pointsInside.length > 0 && (
          <div className="bg-white/95 dark:bg-white/95 backdrop-blur rounded-xl shadow border mt-2 px-3 py-2 text-sm [color-scheme:light] text-slate-800">
            <div className="mb-1 font-medium text-slate-700">Points inside</div>
            <ul className="bg-white border rounded p-2 max-h-32 overflow-auto font-mono text-[11px] leading-snug text-slate-800 mix-blend-normal">
              {pointsInside.map((p) => (
                <li key={p.id} className="truncate text-slate-800">
                  {p.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}