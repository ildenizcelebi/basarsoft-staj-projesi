import { useRef, useState } from "react";
import GeoJSON from "ol/format/GeoJSON";

/**
 * Controls move lifecycle for a selected feature.
 * startMove → user drags → applyMove({ persist }) or cancelMove.
 */
export function useMoveController({ mapRef, infoOverlayRef }) {
  const [moving, setMoving] = useState(false);
  const originalGeomRef = useRef(null);

  function startMove(feature) {
    if (!feature) return;
    originalGeomRef.current = feature.getGeometry()?.clone() || null;
    setMoving(true);
  }

  function cancelMove(feature, infoCoord) {
    if (originalGeomRef.current && feature) {
      feature.setGeometry(originalGeomRef.current);
    }
    setMoving(false);
    if (infoCoord) infoOverlayRef.current?.setPosition(infoCoord);
  }

  /**
   * If `persist` is true, returns payload for PUT (name + geometry in EPSG:4326).
   */
  function applyMove({ feature, persist = false }) {
    setMoving(false);
    if (!persist) return { ok: true };

    const name = feature?.get?.("name") || "";
    const gj = new GeoJSON();
    const wkt4326 = gj.writeGeometryObject(feature.getGeometry(), {
      featureProjection: "EPSG:3857",
      dataProjection: "EPSG:4326",
    });

    return { ok: true, payload: { name, wkt: wkt4326 } };
  }

  return { moving, startMove, cancelMove, applyMove };
}