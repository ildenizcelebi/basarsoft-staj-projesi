import { useEffect, useRef } from "react";
import Draw from "ol/interaction/Draw";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";

/**
 * Handles temporary sketch layer and Draw interaction for adding features.
 * Cleans up interaction/layer after draw end or on unmount.
 */
export function useDrawInteraction({ mapRef, addMode, drawType, setAddMode, onDrawEnd }) {
  const drawRef = useRef(null);
  const sketchSourceRef = useRef(null);
  const sketchLayerRef = useRef(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove previous interaction/layer if any.
    if (drawRef.current) {
      map.removeInteraction(drawRef.current);
      drawRef.current = null;
    }
    if (sketchLayerRef.current) {
      sketchSourceRef.current?.clear();
      map.removeLayer(sketchLayerRef.current);
      sketchLayerRef.current = null;
      sketchSourceRef.current = null;
    }
    map.getViewport().style.cursor = "";

    if (!addMode) return;

    // 1) Sketch layer/source
    sketchSourceRef.current = new VectorSource();
    sketchLayerRef.current = new VectorLayer({
      source: sketchSourceRef.current,
      properties: { isSketchLayer: true },
    });
    map.addLayer(sketchLayerRef.current);

    // 2) Draw interaction
    const valid = new Set(["Point", "LineString", "Polygon"]);
    const safeType = valid.has((drawType || "").trim()) ? drawType.trim() : "Point";

    const draw = new Draw({
      source: sketchSourceRef.current,
      type: safeType,
      stopClick: true,
    });
    drawRef.current = draw;
    map.addInteraction(draw);
    map.getViewport().style.cursor = "crosshair";

    // 3) On complete: delegate, then teardown sketch/interaction.
    draw.on("drawend", (evt) => {
      try {
        onDrawEnd?.(evt.feature);
      } finally {
        sketchSourceRef.current?.clear();
        setAddMode(false);
        map.removeInteraction(draw);
        drawRef.current = null;
        map.getViewport().style.cursor = "";

        map.removeLayer(sketchLayerRef.current);
        sketchLayerRef.current = null;
        sketchSourceRef.current = null;
      }
    });

    // Cleanup on deps change/unmount.
    return () => {
      if (drawRef.current) {
        map.removeInteraction(drawRef.current);
        drawRef.current = null;
      }
      if (sketchLayerRef.current) {
        sketchSourceRef.current?.clear();
        map.removeLayer(sketchLayerRef.current);
        sketchLayerRef.current = null;
        sketchSourceRef.current = null;
      }
      map.getViewport().style.cursor = "";
    };
  }, [mapRef, addMode, drawType, setAddMode, onDrawEnd]);

  return { sketchSourceRef, sketchLayerRef };
}