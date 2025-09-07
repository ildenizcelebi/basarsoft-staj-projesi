import GeoJSON from "ol/format/GeoJSON";
import WKT from "ol/format/WKT";
import { toLonLat } from "ol/proj";

const gj = new GeoJSON();
const wkt = new WKT();

/** Returns true if the object looks like a GeoJSON geometry. */
function isGeom(obj) {
  return (
    obj &&
    typeof obj === "object" &&
    typeof obj.type === "string" &&
    Array.isArray(obj.coordinates)
  );
}

/**
 * Builds an OL Feature from a DTO that may contain geometry in various shapes.
 * Accepts GeoJSON geometry, Feature, or WKT. Projects 4326 → 3857.
 */
export function featureFromDto(dto) {
  if (!dto) return null;
  let g = dto.WKT ?? dto.wkt ?? dto.geometry ?? dto.Geometry ?? dto.geom ?? dto.Geom;
  if (g && g.type === "Feature" && g.geometry) g = g.geometry;

  try {
    if (isGeom(g)) {
      const f = gj.readFeature(
        { type: "Feature", geometry: g, properties: {} },
        { dataProjection: "EPSG:4326", featureProjection: "EPSG:3857" }
      );
      f.setId(dto.id ?? dto.Id);
      f.set("name", dto.name ?? dto.Name ?? "");
      f.set("origGeom", g); // keep original 4326 geometry
      return f;
    }
    if (typeof g === "string" && g.trim()) {
      const f = wkt.readFeature(g.trim(), {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
      });
      f.setId(dto.id ?? dto.Id);
      f.set("name", dto.name ?? dto.Name ?? "");
      const g4326 = gj.writeGeometryObject(f.getGeometry(), {
        featureProjection: "EPSG:3857",
        dataProjection: "EPSG:4326",
      });
      f.set("origGeom", g4326);
      return f;
    }
  } catch {
    return null;
  }
  return null;
}

/** OL Point (EPSG:3857) → GeoJSON Point (EPSG:4326). */
export function geometryFromPoint3857(coord3857) {
  const [lon, lat] = toLonLat(coord3857);
  return { type: "Point", coordinates: [lon, lat] };
}

/**
 * OL Feature (EPSG:3857) → minimal GeoJSON (EPSG:4326).
 * Supports Point, LineString, Polygon.
 */
export function geometryFromFeature3857(feature) {
  const geom = feature.getGeometry();
  const type = geom.getType();

  if (type === "Point") {
    return geometryFromPoint3857(geom.getCoordinates());
  }
  if (type === "LineString") {
    return {
      type: "LineString",
      coordinates: geom.getCoordinates().map((c) => toLonLat(c)),
    };
  }
  if (type === "Polygon") {
    return {
      type: "Polygon",
      coordinates: geom.getCoordinates().map((ring) => ring.map((c) => toLonLat(c))),
    };
  }
  return null;
}