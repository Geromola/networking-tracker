// smoke.mjs — exercise a DEPLOYED build end to end as a real signed-in user.
//
//   npm run smoke                          (against production)
//   node --env-file=.env.local scripts/smoke.mjs http://localhost:5173
//
// The unit tests cover validation in isolation and rls.test.ts covers ownership
// at the database. This covers the seam neither one touches: the deployed
// Express service, reached over HTTP with a real JWT, doing real CRUD.
//
// It cleans up every contact it creates.
const BASE = process.argv[2];
const AUTH = process.env.NEON_AUTH_URL.replace(/\/+$/, "");
const ORIGIN = BASE;

async function signIn(email, password) {
  const r = await fetch(`${AUTH}/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error(`sign-in ${r.status}: ${await r.text()}`);
  const cookie = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  const t = await fetch(`${AUTH}/token`, { headers: { cookie, Origin: ORIGIN } });
  const { token } = await t.json();
  return token;
}

const token = await signIn(process.env.TEST_USER_A_EMAIL, process.env.TEST_USER_A_PASSWORD);
const api = (path, init = {}) =>
  fetch(`${BASE}/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init.headers },
  });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

// create
let r = await api("/contacts", { method: "POST", body: JSON.stringify({ name: "  Smoke   Test ", company: "Acme", priority: "high", where_met: "prod smoke" }) });
const created = await r.json();
check("POST creates a contact (201)", r.status === 201, `status ${r.status}`);
check("name is normalized server-side", created.contact?.name === "Smoke Test", `got ${JSON.stringify(created.contact?.name)}`);
const id = created.contact?.id;

// read
r = await api("/contacts"); const list = await r.json();
check("GET returns it", list.contacts?.some((c) => c.id === id));

// filter + sort
r = await api("/contacts?priority=high&sort=priority&order=asc");
check("GET honours priority filter + sort", (await r.json()).contacts?.some((c) => c.id === id));
r = await api("/contacts?search=Acme");
check("GET honours search", (await r.json()).contacts?.some((c) => c.id === id));

// update
r = await api(`/contacts/${id}`, { method: "PATCH", body: JSON.stringify({ priority: "low" }) });
check("PATCH updates it", r.status === 200 && (await r.json()).contact?.priority === "low");

// validation
r = await api("/contacts", { method: "POST", body: JSON.stringify({ name: "   " }) });
let body = await r.json();
check("empty name rejected (400)", r.status === 400, `"${body.error?.message}"`);
r = await api("/contacts", { method: "POST", body: JSON.stringify({ name: "X", priority: "urgent" }) });
body = await r.json();
check("invalid priority rejected (400)", r.status === 400, `"${body.error?.message}"`);
r = await api("/contacts", { method: "POST", body: JSON.stringify({ name: "Y", user_id: "someone-else" }) });
const forged = await r.json();
check("client-supplied user_id ignored", r.status === 201 && !("user_id" in (forged.contact ?? {})));
await api(`/contacts/${forged.contact.id}`, { method: "DELETE" });

// delete
r = await api(`/contacts/${id}`, { method: "DELETE" });
check("DELETE removes it (204)", r.status === 204, `status ${r.status}`);
r = await api(`/contacts/${id}`, { method: "PATCH", body: JSON.stringify({ name: "gone" }) });
check("PATCH on a deleted contact is 404", r.status === 404, `status ${r.status}`);

console.log(`\n${results.filter((x) => x.ok).length}/${results.length} passed`);
process.exit(results.every((x) => x.ok) ? 0 : 1);
