import Feature from "ol/Feature";
import GeoJSON from "ol/format/GeoJSON";
import { GeometryCollection as OlGeometryCollection, MultiPolygon as OlMultiPolygon } from "ol/geom";
import { getOl3Parser, safeDifference } from "./jsts-core";

const gj = new GeoJSON();

/** Splits Polygon/MultiPolygon into single-polygon features. */
export function splitToPolygonFeatures(olGeomOrFeature) {
  const features = [];
  const g = olGeomOrFeature.getGeometry ? olGeomOrFeature.getGeometry() : olGeomOrFeature;
  if (!g) return features;

  if (g instanceof OlMultiPolygon && typeof g.getPolygons === "function") {
    g.getPolygons().forEach((poly) => features.push(new Feature(poly.clone())));
  } else {
    features.push(olGeomOrFeature.getGeometry ? olGeomOrFeature : new Feature(g));
  }
  return features;
}

/** Returns geometry as GeoJSON object in EPSG:4326. */
export function geometryTo4326Object(feature) {
  return gj.writeGeometryObject(feature.getGeometry(), {
    featureProjection: "EPSG:3857",
    dataProjection: "EPSG:4326",
  });
}

/**
 * new − existing, robust difference.
 * Returns zero, one or many OL features for the remaining parts.
 */
export function eraseWithJsts(newOlFeature, existingOlPolys, snapTol = 0) {
  const parser = getOl3Parser();
  let jNew = parser.read(newOlFeature.getGeometry());

  for (const f of existingOlPolys || []) {
    try {
      const jOld = parser.read(f.getGeometry());
      const jDiff = safeDifference(jNew, jOld, snapTol);
      if (!jDiff || jDiff.isEmpty?.()) {
        jNew = null;
        break;
      }
      jNew = jDiff;
    } catch {}
  }

  if (!jNew || jNew.isEmpty?.()) return [];

  const out = [];
  const olGeom = parser.write(jNew);
  if (!olGeom) return out;

  if (olGeom instanceof OlGeometryCollection) {
    olGeom.getGeometries().forEach((g) => out.push(new Feature(g)));
  } else {
    out.push(new Feature(olGeom));
  }
  return out;
}

/**
 * existing − new, in-place update against source.
 * Replaces or splits existing polygons; preserves name/original geometry metadata.
 */
export function cutExistingByNew({ source, newFeature, styleFor, origGeomProvider, snapTol = 0 }) {
  const parser = getOl3Parser();
  const jNew = parser.read(newFeature.getGeometry());

  const existing = (source?.getFeatures?.() || []).filter((ff) => {
    const t = ff.getGeometry()?.getType?.();
    return t === "Polygon" || t === "MultiPolygon";
    });

  for (const oldF of existing) {
    let jOld;
    try {
      jOld = parser.read(oldF.getGeometry());
    } catch {
      continue;
    }

    const jDiff = safeDifference(jOld, jNew, snapTol);
    if (!jDiff || jDiff.isEmpty?.()) {
      source.removeFeature(oldF);
      continue;
    }

    const outGeom = parser.write(jDiff);
    if (outGeom instanceof OlGeometryCollection) {
      source.removeFeature(oldF);
      outGeom.getGeometries().forEach((g, idx) => {
        const nf = new Feature(g);
        nf.setId(`${oldF.getId?.() ?? "old"}#cut#${idx}`);
        nf.set("name", oldF.get("name"));
        const orig4326 = oldF.get("origGeom") ?? origGeomProvider(oldF);
        nf.set("origGeom", orig4326);
        nf.setStyle(styleFor(nf));
        source.addFeature(nf);
      });
    } else {
      oldF.setGeometry(outGeom);
      if (!oldF.get("origGeom")) oldF.set("origGeom", origGeomProvider(oldF));
      oldF.setStyle(styleFor(oldF));
    }
  }
}