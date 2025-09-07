import { useEffect } from "react";
import GeoJSON from "ol/format/GeoJSON";

/**
 * Single-click selection for features. Opens the info popup and optionally zooms.
 * Disabled when `enabled=false`. Also listens to window "focus-feature" events.
 */
export function useInfoSelection({
  mapRef,
  vectorSourceRef,
  infoOverlayRef,
  setInfoFeature,
  setInfoCoord,
  featureFilter = () => true,
  zoomOnSelect = true,
  hitTolerance = 6,
  enabled = true,
}) {
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !enabled) return;
    const gj = new GeoJSON();

    function handleSingleClick(evt) {
      const domTarget = evt.originalEvent?.target;
      const infoEl =
        (infoOverlayRef?.current?.getElement?.() ?? infoOverlayRef?.current?.element) ||
        infoOverlayRef?.current;
      if (infoEl && (infoEl === domTarget || infoEl.contains(domTarget))) return;

      const pixel = evt.pixel;
      let picked = null;

      map.forEachFeatureAtPixel(
        pixel,
        (f) => {
          if (!featureFilter(f)) return undefined;
          const type = f?.getGeometry?.()?.getType?.();
          if (!type) return undefined;

          // Tighter pick for polygons (near interior point).
          if (type === "Polygon") {
            const centroid = f.getGeometry().getInteriorPoint().getCoordinates();
            const [cx, cy] = map.getPixelFromCoordinate(centroid);
            const dx = pixel[0] - cx;
            const dy = pixel[1] - cy;
            if (Math.hypot(dx, dy) <= 14) {
              picked = f;
              return true;
            }
            return undefined;
          }

          picked = f;
          return true;
        },
        { hitTolerance }
      );

      if (!picked) {
        infoOverlayRef.current?.setPosition(undefined);
        setInfoFeature(null);
        setInfoCoord(null);
        return;
      }

      const displayGeom = picked.getGeometry();
      const baseGeomObj = picked.get("origGeom");
      const baseGeom = baseGeomObj
        ? gj.readGeometry(baseGeomObj, { dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" })
        : displayGeom;

      const type = displayGeom.getType();
      let coord = null;

      if (type === "Point") {
        coord = baseGeom.getCoordinates();
        if (zoomOnSelect) {
          map.getView().animate({
            center: coord,
            zoom: Math.max(map.getView().getZoom() ?? 6, 12),
            duration: 250,
          });
        }
      } else if (type === "LineString") {
        const extent = displayGeom.getExtent();
        coord = baseGeom.getInteriorPoint
          ? baseGeom.getInteriorPoint().getCoordinates()
          : [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2];
        if (zoomOnSelect) map.getView().fit(extent, { padding: [60, 60, 60, 60], maxZoom: 14, duration: 300 });
      } else {
        const extent = displayGeom.getExtent();
        coord = baseGeom.getInteriorPoint
          ? baseGeom.getInteriorPoint().getCoordinates()
          : [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2];
        if (zoomOnSelect) map.getView().fit(extent, { padding: [60, 60, 60, 60], maxZoom: 14, duration: 300 });
      }

      setInfoFeature(picked);
      setInfoCoord(coord);
      infoOverlayRef.current?.setPosition(coord);
    }

    map.on("singleclick", handleSingleClick);

    // Support focusing a feature by id from outside (e.g., search results).
    function handleFocusEvent(e) {
      const id = e?.detail?.id;
      const all = vectorSourceRef.current?.getFeatures?.() || [];
      const f = all.find((ff) => (ff.getId?.() ?? null) === id);
      if (!f || !featureFilter(f)) return;

      const displayGeom = f.getGeometry();
      const baseGeomObj = f.get("origGeom");
      const baseGeom = baseGeomObj
        ? new GeoJSON().readGeometry(baseGeomObj, { dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" })
        : displayGeom;

      const type = displayGeom.getType();
      let coord = null;

      if (type === "Point") {
        coord = baseGeom.getCoordinates();
        if (zoomOnSelect) {
          map.getView().animate({
            center: coord,
            zoom: Math.max(map.getView().getZoom() ?? 6, 12),
            duration: 250,
          });
        }
      } else if (type === "LineString") {
        const extent = displayGeom.getExtent();
        coord = baseGeom.getInteriorPoint
          ? baseGeom.getInteriorPoint().getCoordinates()
          : [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2];
        if (zoomOnSelect) map.getView().fit(extent, { padding: [60, 60, 60, 60], maxZoom: 14, duration: 300 });
      } else {
        const extent = displayGeom.getExtent();
        coord = baseGeom.getInteriorPoint
          ? baseGeom.getInteriorPoint().getCoordinates()
          : [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2];
        if (zoomOnSelect) map.getView().fit(extent, { padding: [60, 60, 60, 60], maxZoom: 14, duration: 300 });
      }

      setInfoFeature(f);
      setInfoCoord(coord);
      infoOverlayRef.current?.setPosition(coord);
    }
    window.addEventListener("focus-feature", handleFocusEvent);

    return () => {
      map.un("singleclick", handleSingleClick);
      window.removeEventListener("focus-feature", handleFocusEvent);
    };
  }, [
    mapRef,
    vectorSourceRef,
    infoOverlayRef,
    setInfoFeature,
    setInfoCoord,
    featureFilter,
    zoomOnSelect,
    hitTolerance,
    enabled,
  ]);
}