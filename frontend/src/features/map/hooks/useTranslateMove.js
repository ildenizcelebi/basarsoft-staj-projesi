import { useEffect, useRef } from "react";
import Collection from "ol/Collection";
import Translate from "ol/interaction/Translate";

/**
 * Makes the given feature draggable on the map when `active` is true.
 * Works alongside default DragPan; translation wins when grabbing the feature.
 */
export function useTranslateMove({ mapRef, feature, active }) {
  const collRef = useRef(new Collection());
  const translateRef = useRef(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!translateRef.current) {
      translateRef.current = new Translate({
        features: collRef.current,
        hitTolerance: 6,
        filter: (feat) => !feat?.get?.("isOverlay"),
      });
      map.addInteraction(translateRef.current);
      translateRef.current.setActive(false);
    }

    collRef.current.clear();
    if (feature) collRef.current.push(feature);

    translateRef.current.setActive(!!active);
  }, [mapRef, feature, active]);

  useEffect(() => {
    return () => {
      const map = mapRef.current;
      if (map && translateRef.current) {
        map.removeInteraction(translateRef.current);
        translateRef.current = null;
      }
    };
  }, [mapRef]);
}