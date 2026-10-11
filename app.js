const KEY = "medications.v1";
const $ = (id) => document.getElementById(id);
const fields = ["name", "dose", "frequency", "time", "notes"];

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}
function save(meds) { localStorage.setItem(KEY, JSON.stringify(meds)); }

let meds = load();

function render() {
  const list = $("list");
  list.replaceChildren();
  $("empty").hidden = meds.length > 0;
  for (const m of meds) {
    const li = document.createElement("li");
    const title = document.createElement("strong");
    title.textContent = m.dose ? `${m.name} — ${m.dose}` : m.name;
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = [m.frequency, m.time].filter(Boolean).join(" · ");
    li.append(title, meta);
    if (m.notes) {
      const n = document.createElement("div");
      n.textContent = m.notes;
      li.append(n);
    }
    const actions = document.createElement("div");
    actions.className = "actions";
    const edit = document.createElement("button");
    edit.textContent = "Edit";
    edit.onclick = () => startEdit(m.id);
    const del = document.createElement("button");
    del.textContent = "Delete";
    del.className = "danger";
    del.onclick = () => {
      if (confirm(`Delete ${m.name}?`)) { meds = meds.filter((x) => x.id !== m.id); save(meds); render(); }
    };
    actions.append(edit, del);
    li.append(actions);
    list.append(li);
  }
}

function resetForm() {
  $("med-form").reset();
  $("med-id").value = "";
  $("save").textContent = "Add medication";
  $("cancel").hidden = true;
}

function startEdit(id) {
  const m = meds.find((x) => x.id === id);
  if (!m) return;
  $("med-id").value = id;
  for (const f of fields) $(f).value = m[f] || "";
  $("save").textContent = "Save changes";
  $("cancel").hidden = false;
  $("name").focus();
}

$("med-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const data = Object.fromEntries(fields.map((f) => [f, $(f).value.trim()]));
  const id = $("med-id").value;
  if (id) meds = meds.map((m) => (m.id === id ? { ...m, ...data } : m));
  else meds.push({ id: crypto.randomUUID(), ...data });
  save(meds);
  resetForm();
  render();
});
$("cancel").addEventListener("click", resetForm);

$("export").addEventListener("click", () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(meds, null, 2)], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: "medications.json" });
  a.click();
  URL.revokeObjectURL(url);
});

$("import").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data) || !data.every((m) => m && typeof m.name === "string")) throw new Error();
    if (!confirm(`Replace your list with ${data.length} imported medication(s)?`)) return;
    meds = data.map((m) => ({ id: m.id || crypto.randomUUID(), ...Object.fromEntries(fields.map((f) => [f, String(m[f] ?? "")])) }));
    save(meds);
    render();
  } catch { alert("That file isn't a valid medications backup."); }
  finally { e.target.value = ""; }
});

render();
