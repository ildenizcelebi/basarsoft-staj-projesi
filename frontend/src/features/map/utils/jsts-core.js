import jsts from "jsts/dist/jsts.min.js";
import {
  Point as OlPoint,
  LineString as OlLineString,
  LinearRing as OlLinearRing,
  Polygon as OlPolygon,
  MultiPoint as OlMultiPoint,
  MultiLineString as OgMultiLineString,
  MultiPolygon as OlMultiPolygon,
  GeometryCollection as OlGeometryCollection,
} from "ol/geom";

let _parser = null;

/** Shared OL ↔︎ JSTS parser (singleton). */
export function getOl3Parser() {
  if (_parser) return _parser;
  const p = new jsts.io.OL3Parser();
  p.inject(
    OlPoint,
    OlLineString,
    OlLinearRing,
    OlPolygon,
    OlMultiPoint,
    OgMultiLineString,
    OlMultiPolygon,
    OlGeometryCollection
  );
  _parser = p;
  return _parser;
}

/** Reduce precision to improve robustness in overlay ops. */
export function reducePrecision(jGeom, scale = 1e6) {
  const pm = new jsts.geom.PrecisionModel(scale);
  const reducer = new jsts.precision.GeometryPrecisionReducer(pm);
  return reducer.reduce(jGeom);
}

/**
 * Robust difference with fallbacks:
 * 1) direct difference
 * 2) SnapIfNeededOverlayOp.difference (if available)
 * 3) buffer(0) normalize + difference
 */
export function safeDifference(a, b, snapTol = 0) {
  try {
    return a.difference(b);
  } catch {}
  if (snapTol > 0 && jsts.operation?.overlay?.snap?.SnapIfNeededOverlayOp) {
    try {
      return jsts.operation.overlay.snap.SnapIfNeededOverlayOp.difference(a, b, snapTol);
    } catch {}
  }
  try {
    const aa = reducePrecision(a);
    const bb = reducePrecision(b);
    return aa.buffer(0).difference(bb.buffer(0));
  } catch {}
  return null;
}