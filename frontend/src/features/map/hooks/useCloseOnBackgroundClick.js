import { useEffect } from "react";

/**
 * Closes popups when clicking on empty map space.
 * Ignores clicks inside popup elements; disabled while `moving` is true.
 */
export function useCloseOnBackgroundClick({ mapRef, infoRef, popupRef, moving, onClose }) {
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onSingleClick = (evt) => {
      if (moving) return;

      const t = evt.originalEvent?.target;
      const clickedInsideInfo =
        infoRef.current && (infoRef.current === t || infoRef.current.contains(t));
      const clickedInsideAdd =
        popupRef.current && (popupRef.current === t || popupRef.current.contains(t));
      if (clickedInsideInfo || clickedInsideAdd) return;

      let hitSomething = false;
      map.forEachFeatureAtPixel(
        evt.pixel,
        (f) => {
          if (f && !f.get("isOverlay")) {
            hitSomething = true;
            return true;
          }
          return false;
        },
        { hitTolerance: 6 }
      );

      if (!hitSomething) onClose?.();
    };

    map.on("singleclick", onSingleClick);
    return () => map.un("singleclick", onSingleClick);
  }, [mapRef, infoRef, popupRef, moving, onClose]);
}