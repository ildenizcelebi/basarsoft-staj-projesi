import GeoJSON from "ol/format/GeoJSON";
import { doFetch } from "./http";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

/** GET /Geometry → returns all geometries or an empty array. */
export async function getAllGeometries() {
  const data = await doFetch(`${BASE_URL}/Geometry`, {}, { toastOnSuccess: false, toastOnError: false });
  return Array.isArray(data) ? data : data ?? [];
}

/** POST /Geometry → creates a geometry. */
export async function addGeometry(payload) {
  return doFetch(
    `${BASE_URL}/Geometry`,
    { method: "POST", body: JSON.stringify(payload) },
    { toastOnSuccess: true, fallbackSuccess: "Record created successfully", fallbackError: "Failed to create record" }
  );
}

/**
 * PUT /Geometry/{id} → updates name + geometry.
 * Converts OL geometry (3857) to GeoJSON 4326 for the backend.
 */
export async function updateGeometryName(id, name, feature) {
  const gj = new GeoJSON();
  const geo4326 = gj.writeGeometryObject(feature.getGeometry(), {
    featureProjection: "EPSG:3857",
    dataProjection: "EPSG:4326",
  });

  return doFetch(
    `${BASE_URL}/Geometry/${id}`,
    { method: "PUT", body: JSON.stringify({ name, wkt: geo4326 }) },
    { toastOnSuccess: true, fallbackSuccess: "Record updated successfully", fallbackError: "Failed to update record" }
  );
}

/** DELETE /Geometry/{id} → deletes a geometry. */
export async function deleteGeometry(id) {
  return doFetch(
    `${BASE_URL}/Geometry/${id}`,
    { method: "DELETE" },
    { toastOnSuccess: true, fallbackSuccess: "Record deleted successfully", fallbackError: "Failed to delete record" }
  );
}

/**
 * GET /Geometry/paged → server-side paging.
 * Returns a normalized envelope regardless of backend nulls.
 */
export async function listGeometriesPaged({
  page = 1,
  pageSize = 10,
  sort = "id_desc",
  type = "All",
  signal,
} = {}) {
  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sort,
    type,
  }).toString();

  const data = await doFetch(
    `${BASE_URL}/Geometry/paged?${qs}`,
    { signal },
    { toastOnSuccess: false, toastOnError: false }
  );

  return {
    items: data?.items ?? [],
    page: data?.page ?? page,
    pageSize: data?.pageSize ?? pageSize,
    totalItems: data?.totalItems ?? 0,
    totalPages: data?.totalPages ?? 0,
  };
}