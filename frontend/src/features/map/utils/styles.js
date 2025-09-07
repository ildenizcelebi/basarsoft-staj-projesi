import { Style, Fill, Stroke, Icon } from "ol/style";
import Point from "ol/geom/Point";

/** Inline SVG pin icon to avoid external assets. */
export function pinSvgDataUri(colorHex) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${colorHex}">` +
    `<path d="M12 2C8.686 2 6 4.686 6 8c0 4.5 6 12 6 12s6-7.5 6-12c0-3.314-2.686-6-6-6zm0 8.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

export function createPinIcon(colorHex) {
  return new Icon({ anchor: [0.5, 1], src: pinSvgDataUri(colorHex), imgSize: [24, 24] });
}

/** Default point style (blue pin), kept on top. */
const pointStyle = new Style({ image: createPinIcon("#2563eb"), zIndex: 3000 });

/**
 * Map styling for all geometry types:
 * - Point/MultiPoint: blue pin
 * - LineString: blue stroke + green/red endpoint pins
 * - Polygon/MultiPolygon: fill only (no stroke) + orange interior pin
 *   (outer borders are drawn via the union overlay layer)
 */
export function styleFor(feature) {
  const t = feature.getGeometry()?.getType?.();

  // Points
  if (t === "Point" || t === "MultiPoint") return pointStyle;

  // Lines
  if (t?.includes("Line")) {
    const stroke = new Style({
      stroke: new Stroke({ color: "rgba(0,123,255,0.95)", width: 5 }),
      zIndex: 1200,
    });
    const startPin = new Style({
      geometry: (f) => new Point(f.getGeometry().getFirstCoordinate()),
      image: createPinIcon("#16a34a"),
      zIndex: 3000,
    });
    const endPin = new Style({
      geometry: (f) => new Point(f.getGeometry().getLastCoordinate()),
      image: createPinIcon("#dc2626"),
      zIndex: 3000,
    });
    return [stroke, startPin, endPin];
  }

  // Polygons
  return [
    new Style({
      fill: new Fill({ color: "rgba(0,123,255,0.18)" }),
      stroke: new Stroke({ color: "rgba(0,0,0,0)", width: 0 }), // hide interior edges
      zIndex: 1000,
    }),
    new Style({
      geometry: (f) =>
        f.getGeometry().getType() === "Polygon"
          ? new Point(f.getGeometry().getInteriorPoint().getCoordinates())
          : new Point(f.getGeometry().getInteriorPoints().getCoordinates()?.[0]),
      image: createPinIcon("#f97316"),
      zIndex: 3000,
    }),
  ];
}