export async function api(path, options = {}) {
  const response = await fetch("/api/pulse" + path, {
    credentials: "same-origin",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    const error = new Error(body?.error?.message || "Operazione non riuscita");
    error.status = response.status;
    throw error;
  }
  return body;
}
export const send = (path, body, method = "PUT") =>
  api(path, { method, body: JSON.stringify(body) });
