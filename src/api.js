// All backend calls live here so each endpoint contract is fixed in one place.
const BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:9000";
const JSON_HEADERS = { "Content-Type": "application/json" };

async function request(path, body) {
  const res = await fetch(BASE + path, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON body */ }
  if (!res.ok || data?.success === false) {
    const d = data?.detail ?? data?.message ?? res.statusText;
    throw new Error(typeof d === "string" ? d : JSON.stringify(d));
  }
  return data;
}

// POST /api/import  { type: "curl" | "yaml" | "url", content: string }
// "url" = link to a Swagger/OpenAPI document; the backend fetches it.
export async function importApis({ type, curl, file, url }) {
  const content = type === "yaml" ? await file.text() : type === "url" ? url : curl;
  return request("/api/import", { type, content });
}

// POST /api/generate-tests  { specification }  (spec comes from the import response)
export function generateTestCases(imported) {
  return request("/api/generate-tests", { specification: imported.specification });
}

// Each test carries the operation_id of the API it belongs to.
export function groupTests(tests = []) {
  const map = {};
  for (const t of tests) (map[t.operation_id] ||= []).push(t);
  return map;
}
