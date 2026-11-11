export async function submitForm(form: string, payload: Record<string, unknown>) {
  const res = await fetch("/api/enquiry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ form, ...payload }),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; reference?: string; error?: string };
  if (!res.ok || !json.ok) throw new Error(json.error || "Could not send. Please try again.");
  return json.reference ?? "";
}

