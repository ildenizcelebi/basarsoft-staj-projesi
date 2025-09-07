import toast from "react-hot-toast";

/**
 * Fetch helper that understands { success, message, data, errors } envelopes.
 * Controlled toasts prevent duplicates via stable ids.
 */
export async function doFetch(
  url,
  { method = "GET", headers, body, signal } = {},
  {
    toastOnSuccess = false,
    toastOnError = true,
    fallbackSuccess = "Success",
    fallbackError = "An unexpected error occurred.",
    successToastId = "api-success",
    errorToastId = "api-error",
  } = {}
) {
  try {
    const finalHeaders = { ...(headers || {}) };
    // ⬇️ Sadece body varsa Content-Type ver
    if (body && !finalHeaders["Content-Type"]) {
      finalHeaders["Content-Type"] = "application/json";
    }

    const res = await fetch(url, {
      method,
      headers: finalHeaders,
      body,
      signal,
    });

    let payload = null;
    const text = await res.text().catch(() => "");
    if (text) {
      try { payload = JSON.parse(text); } catch { payload = text; }
    }

    const api =
      payload && typeof payload === "object" &&
      ("success" in payload || "message" in payload || "data" in payload)
        ? payload
        : null;

    const success = res.ok && (api ? api.success !== false : true);
    const message = (api?.message || (success ? fallbackSuccess : fallbackError)).toString();

    if (success) {
      if (toastOnSuccess) toast.success(message, { id: successToastId });
      return api?.data ?? payload ?? true;
    }

    if (toastOnError) {
      const valMsgs = Array.isArray(api?.errors)
        ? api.errors.slice(0, 3).join(" · ")
        : typeof api?.errors === "object"
        ? Object.values(api.errors).flat().slice(0, 3).join(" · ")
        : null;

      toast.error(valMsgs ? `${message}: ${valMsgs}` : message, { id: errorToastId });
    }

    throw new Error(message);
  } catch (err) {
    if (toastOnError) toast.error(fallbackError, { id: "api-fallback-error" });
    throw err;
  }
}