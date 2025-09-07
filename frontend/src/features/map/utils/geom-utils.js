import { toLonLat } from "ol/proj";

/** Ray-casting test: point ∈ ring (in map projection). */
export function pointInRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const onStraddle = (yi > y) !== (yj > y);
    const xCross = ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-12) + xi;
    if (onStraddle && x < xCross) inside = !inside;
  }
  return inside;
}

/** Point-in-polygon for OL Polygon/MultiPolygon in EPSG:3857. */
export function pointInPolygonGeometry3857(coord, geom) {
  const type = geom?.getType?.();
  if (type === "Polygon") {
    const rings = geom.getCoordinates() || [];
    const outer = rings[0] || [];
    return outer.length ? pointInRing(coord, outer) : false;
  }
  if (type === "MultiPolygon") {
    const polys = geom.getCoordinates() || [];
    for (const poly of polys) {
      const outer = (poly && poly[0]) || [];
      if (outer.length && pointInRing(coord, outer)) return true;
    }
    return false;
  }
  return false;
}

/** Pretty-print coordinates (lon/lat) for a geometry, 5 decimals. */
export function listLonLatStringsForGeometry(geom) {
  if (!geom) return [];
  const fmt = (c) => {
    const [lon, lat] = toLonLat(c);
    const f = (n) => Number(n).toFixed(5);
    return `${f(lat)}, ${f(lon)}`;
  };
  const t = geom.getType();
  if (t === "Point") return [fmt(geom.getCoordinates())];
  if (t === "MultiPoint") return (geom.getCoordinates() || []).map(fmt);
  if (t === "LineString") return (geom.getCoordinates() || []).map(fmt);
  if (t === "MultiLineString") return (geom.getCoordinates() || []).flat().map(fmt);
  if (t === "Polygon") return (geom.getCoordinates()?.[0] || []).map(fmt);
  if (t === "MultiPolygon") return (geom.getCoordinates() || []).flat(2).map(fmt);
  return [];
}