import React, { useMemo, useState } from "react";
import { listLonLatStringsForGeometry } from "../utils/geom-utils";
import { updateGeometryName, deleteGeometry } from "../../../services/geometriesApi";
import ConfirmDialog from "./ConfirmDialog";

/**
 * Feature info panel with name edit, move/apply, vertex edit/apply and delete.
 * Coordinates are displayed as lon/lat strings (EPSG:4326).
 */
export default function InfoPopup({
  feature,
  onClose,
  onUpdateSuccess,
  onDeleteSuccess,
  // Move
  moving = false,
  onStartMove,
  onApplyMove,
  onCancelMove,
  // Edit
  editing = false,
  onStartEdit,
  onApplyEdit,
  onCancelEdit,
  // Forces coordinate recomputation when set
  geomRev = 0,
}) {
  const geom = feature?.getGeometry?.();
  const type = geom?.getType?.() || "Geometry";
  const id = feature?.getId?.();
  const name = feature?.get?.("name") || "(no name)";

  const coords = useMemo(() => listLonLatStringsForGeometry(geom), [geom, geomRev]);

  const [editMode, setEditMode] = useState(false);
  const [nameInput, setNameInput] = useState(name === "(no name)" ? "" : name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleStartNameEdit() {
    setNameInput(name === "(no name)" ? "" : name);
    setError("");
    setEditMode(true);
  }
  function handleCancelNameEdit() {
    setNameInput(name === "(no name)" ? "" : name);
    setError("");
    setEditMode(false);
  }

  async function handleSaveName() {
    const trimmed = (nameInput || "").trim();
    if (!trimmed) return setError("Name cannot be empty.");
    if (!id) return setError("Missing feature id.");

    setBusy(true);
    setError("");
    try {
      await updateGeometryName(id, trimmed, feature); // PUT: name + current geometry
      feature.set("name", trimmed);
      setEditMode(false);
      onUpdateSuccess?.(trimmed);
    } catch (e) {
      setError(e?.message || "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!id) {
      setError("Missing feature id.");
      setConfirmOpen(false);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await deleteGeometry(id);
      onDeleteSuccess?.();
    } catch (e) {
      setError(e?.message || "Delete failed.");
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  }

  const canEditGeometry = type === "Polygon" || type === "LineString";

  return (
    <>
      <div
        className="bg-white/95 backdrop-blur rounded-xl shadow border px-3 py-2 text-sm min-w-44 max-w-xs relative [color-scheme:light]"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-1.5 right-1.5 rounded-md w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-slate-100"
            aria-label="Close"
            title="Close"
          >
            ×
          </button>
        )}

        <div className="font-semibold text-slate-800 mb-1">{type}</div>

        {!editMode ? (
          <div className="text-slate-800 mb-2 break-words">{name}</div>
        ) : (
          <div className="mb-2">
            <label htmlFor="name-edit" className="text-xs text-slate-600">
              Name
            </label>
            <input
              id="name-edit"
              className="mt-1 w-full rounded-lg border px-2 py-1.5 text-slate-800 bg-white focus:outline-none focus:ring focus:ring-slate-200"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Enter a name"
              disabled={busy}
            />
            {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
          </div>
        )}

        <div className="mt-1">
          <div className="mb-1 font-medium text-slate-600">Coordinates</div>
          <div className="bg-slate-50 border rounded p-2 max-h-48 overflow-auto font-mono text-[11px] leading-snug text-slate-800">
            {coords.map((s, i) => (
              <div key={`${geomRev}-${i}`}>{s}</div>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          {editMode ? (
            <>
              <button
                onClick={handleCancelNameEdit}
                className="px-3 py-1.5 rounded-lg border text-slate-700 hover:bg-slate-50"
                disabled={busy}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveName}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60"
                disabled={busy}
              >
                {busy ? "Saving..." : "Save"}
              </button>
            </>
          ) : (
            <>
              {!moving && !editing && (
                <>
                  <button
                    onClick={handleStartNameEdit}
                    className="px-3 py-1.5 rounded-lg border text-slate-700 hover:bg-slate-50"
                  >
                    Update name
                  </button>

                  {canEditGeometry && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartEdit?.();
                      }}
                      className="px-3 py-1.5 rounded-lg border text-slate-700 hover:bg-slate-50"
                      title="Drag vertices or add nodes, then click Apply"
                    >
                      Edit geometry
                    </button>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartMove?.();
                    }}
                    className="px-3 py-1.5 rounded-lg border text-slate-700 hover:bg-slate-50"
                    title="Drag on the map, then click Apply"
                  >
                    Move
                  </button>

                  <button
                    onClick={() => setConfirmOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-500"
                  >
                    Delete
                  </button>
                </>
              )}

              {moving && !editing && (
                <>
                  <span className="mr-auto text-xs text-slate-600">
                    Drag on map, then <b>Apply</b>.
                  </span>
                  <button
                    onClick={() => onCancelMove?.()}
                    className="px-3 py-1.5 rounded-lg border text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => onApplyMove?.()}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
                  >
                    Apply
                  </button>
                </>
              )}

              {editing && !moving && (
                <>
                  <span className="mr-auto text-xs text-slate-600">
                    Drag vertices / click to add node, then <b>Apply</b>.
                  </span>
                  <button
                    onClick={() => onCancelEdit?.()}
                    className="px-3 py-1.5 rounded-lg border text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => onApplyEdit?.()}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
                  >
                    Apply
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {!editMode && error && <div className="text-xs text-red-600 mt-2">{error}</div>}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete geometry"
        message="Are you sure you want to delete this geometry? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}