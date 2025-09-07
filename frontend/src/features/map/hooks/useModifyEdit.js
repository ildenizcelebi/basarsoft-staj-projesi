import { useEffect, useRef } from "react";
import Modify from "ol/interaction/Modify";
import Collection from "ol/Collection";

/**
 * Enables vertex-level editing for the given feature when `active` is true.
 * Supports Polygon and LineString; Point is unaffected.
 */
export function useModifyEdit({ mapRef, feature, active }) {
  const collRef = useRef(new Collection());
  const modifyRef = useRef(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!modifyRef.current) {
      modifyRef.current = new Modify({
        features: collRef.current,
        insertVertexCondition: () => true,
        deleteCondition: () => false, // keep deletions disabled by default
      });
      map.addInteraction(modifyRef.current);
      modifyRef.current.setActive(false);
    }

    collRef.current.clear();
    if (feature) collRef.current.push(feature);

    modifyRef.current.setActive(!!active);
  }, [mapRef, feature, active]);

  useEffect(() => {
    return () => {
      const map = mapRef.current;
      if (map && modifyRef.current) {
        map.removeInteraction(modifyRef.current);
        modifyRef.current = null;
      }
    };
  }, [mapRef]);
}