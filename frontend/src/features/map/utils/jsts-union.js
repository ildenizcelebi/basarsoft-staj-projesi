import Feature from "ol/Feature";
import {
  GeometryCollection as OlGeometryCollection,
  Polygon as OlPolygon,
  MultiPolygon as OlMultiPolygon,
} from "ol/geom";
import { getOl3Parser } from "./jsts-core";

/**
 * Dissolve/union for OL Polygon/MultiPolygon via JSTS.
 * Drops interior edges; returns one or more OL features.
 */
export function unionOlPolygons(polys) {
  if (!polys || polys.length === 0) return [];

  const parser = getOl3Parser();
  const js = [];

  // OL → JSTS
  for (const f of polys) {
    const g = f?.getGeometry?.();
    if (!g) continue;
    const t = g.getType?.();
    if (t !== "Polygon" && t !== "MultiPolygon") continue;
    try {
      js.push(parser.read(g));
    } catch (e) {
      console.warn("OL→JSTS parse error:", e);
    }
  }
  if (js.length === 0) return [];

  // Iterative union with buffer(0) fallback.
  let acc = js[0];
  for (let i = 1; i < js.length; i++) {
    try {
      acc = acc.union(js[i]);
    } catch {
      try {
        acc = acc.buffer(0).union(js[i].buffer(0));
      } catch (e) {
        console.warn("union error:", e);
      }
    }
  }
  if (!acc || acc.isEmpty?.()) return [];

  // JSTS → OL
  const out = [];
  const olGeom = parser.write(acc);
  if (!olGeom) return out;

  if (olGeom instanceof OlGeometryCollection) {
    olGeom.getGeometries().forEach((g) => out.push(new Feature(g)));
  } else {
    out.push(new Feature(olGeom));
  }
  return out;
}