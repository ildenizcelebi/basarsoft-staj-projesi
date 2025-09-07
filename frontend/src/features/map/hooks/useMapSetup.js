import { useEffect, useRef } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import OSM from "ol/source/OSM";
import Overlay from "ol/Overlay";
import { fromLonLat, transformExtent } from "ol/proj";
import { defaults as defaultControls, Zoom } from "ol/control";
import { styleFor } from "../utils/styles";
import { getAllGeometries } from "../../../services/geometriesApi";
import { featureFromDto } from "../../../utils/wkt";

/**
 * Initializes OpenLayers map, base/vector layers and two overlays (Add/Info).
 * Loads initial features from API and fits view if data exists.
 */
export function useMapSetup({ mapDivRef, popupRef, infoRef, setMap, setFeatures, setErr, sidebarOpen }) {
  const vectorSourceRef = useRef(null);
  const overlayRef = useRef(null);
  const infoOverlayRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    const vectorSource = new VectorSource();
    vectorSourceRef.current = vectorSource;
    const vectorLayer = new VectorLayer({ source: vectorSource, style: (f) => styleFor(f) });
    const base = new TileLayer({ source: new OSM(), opacity: 1 });

    // Türkiye extent (approx WGS84) constrained to center movement.
    const trWgs84 = [25.5, 35.5, 45.0, 42.5];
    const trExtent = transformExtent(trWgs84, "EPSG:4326", "EPSG:3857");

    const view = new View({
      center: fromLonLat([35.2433, 38.9637]),
      zoom: 6,
      minZoom: 4,
      maxZoom: 18,
      extent: trExtent,
      constrainOnlyCenter: true,
    });

    const map = new Map({
      target: mapDivRef.current,
      layers: [base, vectorLayer],
      view,
      controls: defaultControls({ zoom: false, rotate: false, attribution: false }).extend([new Zoom()]),
    });

    // Store initial state for optional reset.
    map.__initialCenter = fromLonLat([35.2433, 38.9637]);
    map.__initialZoom = 6;
    map.__trExtent = trExtent;

    mapRef.current = map;
    setMap(map);

    // Add popup (create)
    const overlay = new Overlay({
      element: popupRef.current,
      autoPan: { animation: { duration: 250 } },
      offset: [0, -10],
      positioning: "bottom-center",
      stopEvent: true,
    });
    map.addOverlay(overlay);
    overlayRef.current = overlay;

    // Info popup
    const infoOverlay = new Overlay({
      element: infoRef.current,
      autoPan: { animation: { duration: 200 } },
      offset: [0, -15],
      positioning: "bottom-center",
      stopEvent: true,
    });
    map.addOverlay(infoOverlay);
    infoOverlayRef.current = infoOverlay;

    // Initial data load
    (async () => {
      try {
        const data = await getAllGeometries();
        const feats = [];
        for (const item of data ?? []) {
          const f = featureFromDto(item);
          if (f) {
            f.setId(item.id ?? item.Id ?? undefined);
            f.set("name", item.name ?? item.Name ?? "");
            feats.push(f);
          }
        }
        vectorSource.clear();
        vectorSource.addFeatures(feats);
        setFeatures(feats);

        if (feats.length > 0) {
          const extent = vectorSource.getExtent();
          if (extent && extent.every(Number.isFinite)) {
            view.fit(extent, { padding: [40, 40, 40, 40], maxZoom: 8, duration: 400 });
          }
        }
      } catch (e) {
        setErr?.(e.message || "Data load error");
      }
    })();

    return () => {
      map.setTarget(null);
    };
  }, [mapDivRef, popupRef, infoRef, setMap, setFeatures, setErr]);

  return { mapRef, vectorSourceRef, overlayRef, infoOverlayRef };
}