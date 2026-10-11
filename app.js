const KEY = "doselog.v1";
const $ = (id) => document.getElementById(id);
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());

function load() {
  try { const v = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(v) ? v : []; } catch { return []; }
}
let log = load();
let pendingDelete = null;
let manualTime = false; // true once the user types a date/time themselves

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(log)); } catch { say("Could not save in this browser."); }
}
function say(msg) { $("status").textContent = msg; }

const pad = (n) => String(n).padStart(2, "0");
function toLocalInput(d) {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
}
function dayKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function dayLabel(d) {
  const today = new Date(); const y = new Date(); y.setDate(today.getDate() - 1);
  const full = d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  if (dayKey(d) === dayKey(today)) return "Today, " + full;
  if (dayKey(d) === dayKey(y)) return "Yesterday, " + full;
  return full;
}
const timeLabel = (d) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

function syncAuto() {
  $("auto-note").textContent = manualTime ? "Time set by you." : "Time is filled in automatically when you log. Change it to enter a different time.";
}
function setNow() {
  manualTime = false;
  $("when").value = toLocalInput(new Date());
  syncAuto();
}
$("when").addEventListener("input", () => { manualTime = true; syncAuto(); });
$("now").addEventListener("click", setNow);
// Keep the automatic time current while the page is open.
setInterval(() => { if (!manualTime && !$("entry-id").value) $("when").value = toLocalInput(new Date()); }, 15000);

function renderChips() {
  const seen = new Map();
  for (const e of [...log].sort((a, b) => b.takenAt.localeCompare(a.takenAt))) {
    const k = e.name.toLowerCase() + "|" + e.dose.toLowerCase();
    if (!seen.has(k)) seen.set(k, e);
    if (seen.size >= 8) break;
  }
  const chips = $("chips");
  chips.replaceChildren();
  for (const e of seen.values()) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip";
    b.textContent = e.dose ? e.name + " " + e.dose : e.name;
    b.onclick = () => { $("name").value = e.name; $("dose").value = e.dose; currentChoice = null; renderDoseChips([]); $("dose").focus(); };
    chips.append(b);
  }
  chips.hidden = seen.size === 0;
}

function render() {
  const wrap = $("log");
  wrap.replaceChildren();
  $("empty").hidden = log.length > 0;
  $("backup-text").value = JSON.stringify(log, null, 2);
  renderChips();

  const sorted = [...log].sort((a, b) => b.takenAt.localeCompare(a.takenAt));
  const days = new Map();
  for (const e of sorted) {
    const d = new Date(e.takenAt); const k = dayKey(d);
    if (!days.has(k)) days.set(k, { date: d, items: [] });
    days.get(k).items.push(e);
  }
  for (const { date, items } of days.values()) {
    const sec = document.createElement("div"); sec.className = "day";
    const head = document.createElement("div"); head.className = "day-head";
    const h = document.createElement("h3"); h.textContent = dayLabel(date);
    const counts = new Map();
    for (const e of items) counts.set(e.name, (counts.get(e.name) || 0) + 1);
    const sum = document.createElement("span"); sum.className = "sum";
    sum.textContent = items.length + (items.length === 1 ? " dose" : " doses") + " · " + [...counts].map(([n, c]) => c > 1 ? n + " ×" + c : n).join(", ");
    head.append(h, sum); sec.append(head);

    for (const e of items) {
      const row = document.createElement("div"); row.className = "entry";
      const t = document.createElement("span"); t.className = "t"; t.textContent = timeLabel(new Date(e.takenAt));
      const what = document.createElement("span"); what.className = "what";
      const b = document.createElement("b"); b.textContent = e.name; what.append(b);
      if (e.dose) { const s = document.createElement("span"); s.textContent = "  " + e.dose; what.append(s); }
      const acts = document.createElement("span"); acts.className = "acts";
      const edit = document.createElement("button"); edit.textContent = "Edit"; edit.onclick = () => startEdit(e.id);
      const del = document.createElement("button"); del.className = "danger";
      del.textContent = pendingDelete === e.id ? "Confirm" : "Delete";
      del.onclick = () => {
        if (pendingDelete === e.id) { log = log.filter((x) => x.id !== e.id); pendingDelete = null; persist(); }
        else pendingDelete = e.id;
        render();
      };
      acts.append(edit, del);
      row.append(t, what, acts); sec.append(row);
    }
    wrap.append(sec);
  }
}

function resetForm() {
  $("dose-form").reset();
  currentChoice = null; renderDoseChips([]);
  $("entry-id").value = "";
  $("save").textContent = "Log dose";
  $("cancel").hidden = true;
  setNow();
}
function startEdit(id) {
  const e = log.find((x) => x.id === id);
  if (!e) return;
  $("entry-id").value = id;
  $("name").value = e.name; $("dose").value = e.dose;
  $("when").value = toLocalInput(new Date(e.takenAt));
  manualTime = true; syncAuto();
  $("save").textContent = "Save changes";
  $("cancel").hidden = false;
  $("name").focus();
}

$("dose-form").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const id = $("entry-id").value;
  // Automatic time is read at the moment of logging.
  const when = manualTime || id ? new Date($("when").value) : new Date();
  if (isNaN(when)) { $("when").focus(); return; }
  const rec = { name: $("name").value.trim(), dose: $("dose").value.trim(), takenAt: when.toISOString() };
  if (id) log = log.map((e) => (e.id === id ? { ...e, ...rec } : e));
  else log.push({ id: newId(), ...rec });
  pendingDelete = null;
  persist(); resetForm(); render();
});
$("cancel").addEventListener("click", resetForm);

$("copy").addEventListener("click", async () => {
  const ta = $("backup-text");
  try { await navigator.clipboard.writeText(ta.value); say("Copied."); }
  catch { ta.select(); say("Press Ctrl+C (or Cmd+C) to copy."); }
});
$("import").addEventListener("click", () => {
  try {
    const data = JSON.parse($("backup-text").value);
    if (!Array.isArray(data) || !data.every((e) => e && typeof e.name === "string" && e.name && !isNaN(new Date(e.takenAt)))) throw new Error();
    log = data.map((e) => ({ id: e.id || newId(), name: e.name, dose: String(e.dose ?? ""), takenAt: new Date(e.takenAt).toISOString() }));
    persist(); render(); say("Imported " + log.length + " entries.");
  } catch { say("That text is not a valid backup."); }
});

// Built-in list of common medications ("Generic|Brand, Brand"). It pairs brand and generic names and is the
// fallback when the RxNorm download is unavailable. Any other name can still be typed in freely.
const DRUGS = `Atorvastatin|Lipitor
Rosuvastatin|Crestor
Simvastatin|Zocor
Pravastatin|Pravachol
Lovastatin|Mevacor
Ezetimibe|Zetia
Fenofibrate|Tricor
Gemfibrozil|Lopid
Metformin|Glucophage, Glumetza
Glipizide|Glucotrol
Glimepiride|Amaryl
Glyburide|Diabeta
Pioglitazone|Actos
Sitagliptin|Januvia
Linagliptin|Tradjenta
Empagliflozin|Jardiance
Dapagliflozin|Farxiga
Canagliflozin|Invokana
Semaglutide|Ozempic, Wegovy, Rybelsus
Liraglutide|Victoza, Saxenda
Dulaglutide|Trulicity
Tirzepatide|Mounjaro, Zepbound
Insulin glargine|Lantus, Basaglar, Toujeo
Insulin lispro|Humalog
Insulin aspart|Novolog
Lisinopril|Prinivil, Zestril
Enalapril|Vasotec
Ramipril|Altace
Benazepril|Lotensin
Losartan|Cozaar
Valsartan|Diovan
Olmesartan|Benicar
Irbesartan|Avapro
Candesartan|Atacand
Telmisartan|Micardis
Sacubitril/valsartan|Entresto
Amlodipine|Norvasc
Nifedipine|Procardia, Adalat
Diltiazem|Cardizem
Verapamil|Calan
Metoprolol|Lopressor, Toprol-XL
Atenolol|Tenormin
Carvedilol|Coreg
Bisoprolol|Zebeta
Propranolol|Inderal
Nebivolol|Bystolic
Hydrochlorothiazide|Microzide
Chlorthalidone|Thalitone
Furosemide|Lasix
Spironolactone|Aldactone
Torsemide|Demadex
Clonidine|Catapres
Hydralazine|Apresoline
Doxazosin|Cardura
Prazosin|Minipress
Warfarin|Coumadin, Jantoven
Apixaban|Eliquis
Rivaroxaban|Xarelto
Dabigatran|Pradaxa
Clopidogrel|Plavix
Ticagrelor|Brilinta
Aspirin|Bayer, Ecotrin
Digoxin|Lanoxin
Amiodarone|Pacerone, Cordarone
Isosorbide mononitrate|Imdur
Nitroglycerin|Nitrostat
Ranolazine|Ranexa
Levothyroxine|Synthroid, Levoxyl, Unithroid
Liothyronine|Cytomel
Methimazole|Tapazole
Prednisone|Deltasone, Rayos
Methylprednisolone|Medrol
Dexamethasone|Decadron
Hydrocortisone|Cortef
Omeprazole|Prilosec
Esomeprazole|Nexium
Pantoprazole|Protonix
Lansoprazole|Prevacid
Famotidine|Pepcid
Ondansetron|Zofran
Metoclopramide|Reglan
Loperamide|Imodium
Sertraline|Zoloft
Fluoxetine|Prozac
Escitalopram|Lexapro
Citalopram|Celexa
Paroxetine|Paxil
Venlafaxine|Effexor
Duloxetine|Cymbalta
Bupropion|Wellbutrin, Zyban
Mirtazapine|Remeron
Trazodone|Desyrel
Amitriptyline|Elavil
Nortriptyline|Pamelor
Buspirone|Buspar
Alprazolam|Xanax
Lorazepam|Ativan
Clonazepam|Klonopin
Diazepam|Valium
Zolpidem|Ambien
Eszopiclone|Lunesta
Melatonin|
Quetiapine|Seroquel
Aripiprazole|Abilify
Olanzapine|Zyprexa
Risperidone|Risperdal
Lurasidone|Latuda
Lithium|Lithobid
Lamotrigine|Lamictal
Divalproex|Depakote
Carbamazepine|Tegretol
Levetiracetam|Keppra
Topiramate|Topamax
Gabapentin|Neurontin
Pregabalin|Lyrica
Phenytoin|Dilantin
Methylphenidate|Ritalin, Concerta
Amphetamine/dextroamphetamine|Adderall
Lisdexamfetamine|Vyvanse
Atomoxetine|Strattera
Donepezil|Aricept
Memantine|Namenda
Carbidopa/levodopa|Sinemet
Ropinirole|Requip
Pramipexole|Mirapex
Sumatriptan|Imitrex
Rizatriptan|Maxalt
Ibuprofen|Advil, Motrin
Naproxen|Aleve, Naprosyn
Meloxicam|Mobic
Celecoxib|Celebrex
Diclofenac|Voltaren
Acetaminophen|Tylenol, Paracetamol
Tramadol|Ultram
Oxycodone|OxyContin, Roxicodone
Hydrocodone/acetaminophen|Vicodin, Norco
Morphine|MS Contin
Cyclobenzaprine|Flexeril
Methocarbamol|Robaxin
Baclofen|Lioresal
Tizanidine|Zanaflex
Allopurinol|Zyloprim
Colchicine|Colcrys
Methotrexate|Trexall
Hydroxychloroquine|Plaquenil
Adalimumab|Humira
Etanercept|Enbrel
Alendronate|Fosamax
Cetirizine|Zyrtec
Loratadine|Claritin
Fexofenadine|Allegra
Diphenhydramine|Benadryl
Pseudoephedrine|Sudafed
Guaifenesin|Mucinex
Montelukast|Singulair
Fluticasone|Flonase, Flovent
Budesonide/formoterol|Symbicort
Fluticasone/salmeterol|Advair
Albuterol|Ventolin, ProAir
Tiotropium|Spiriva
Amoxicillin|Amoxil
Amoxicillin/clavulanate|Augmentin
Azithromycin|Zithromax, Z-Pak
Ciprofloxacin|Cipro
Levofloxacin|Levaquin
Doxycycline|Vibramycin
Cephalexin|Keflex
Sulfamethoxazole/trimethoprim|Bactrim, Septra
Nitrofurantoin|Macrobid
Metronidazole|Flagyl
Clindamycin|Cleocin
Fluconazole|Diflucan
Acyclovir|Zovirax
Valacyclovir|Valtrex
Oseltamivir|Tamiflu
Ivermectin|Stromectol
Sildenafil|Viagra, Revatio
Tadalafil|Cialis
Finasteride|Proscar, Propecia
Tamsulosin|Flomax
Oxybutynin|Ditropan
Estradiol|Estrace
Medroxyprogesterone|Provera
Norethindrone/ethinyl estradiol|Loestrin
Progesterone|Prometrium
Testosterone|AndroGel
Tamoxifen|Nolvadex
Anastrozole|Arimidex
Naloxone|Narcan
Buprenorphine/naloxone|Suboxone
Naltrexone|Revia
Varenicline|Chantix
Folic acid|
Vitamin D3 (cholecalciferol)|
Vitamin B12 (cyanocobalamin)|
Ferrous sulfate (iron)|Feosol
Calcium carbonate|Tums
Magnesium|
Potassium chloride|K-Dur
Omega-3 (fish oil)|Lovaza
Multivitamin|`.split("\n").map((line) => {
  const [generic, brands] = line.split("|");
  return { generic, brands: brands ? brands.split(",").map((b) => b.trim()).filter(Boolean) : [] };
});
const OPTIONS = [];
for (const d of DRUGS) {
  OPTIONS.push({ label: d.generic, value: d.generic, sub: d.brands.join(", "), key: d.generic.toLowerCase() });
  for (const b of d.brands) OPTIONS.push({ label: b, value: b + " (" + d.generic.toLowerCase() + ")", sub: d.generic.toLowerCase(), key: b.toLowerCase() });
}


// Full drug-name list from the NIH RxNorm service (brand and generic names). The list is downloaded
// once and cached; what you type is never sent anywhere. If the download fails, the built-in list is used.
const RX_URL = "https://rxnav.nlm.nih.gov/REST/displaynames.json";
const RX_CACHE = "rxnorm.displaynames.v1";
const RX_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
let remoteNames = [];

function setSourceNote(text) { $("src-note").textContent = text; }

async function loadRemoteNames() {
  try {
    const c = JSON.parse(localStorage.getItem(RX_CACHE));
    if (c && Array.isArray(c.names) && Date.now() - c.t < RX_MAX_AGE) {
      remoteNames = c.names;
      setSourceNote("Searching " + remoteNames.length.toLocaleString() + " names from NIH RxNorm.");
      return;
    }
  } catch {}
  setSourceNote("Loading drug names from NIH RxNorm...");
  try {
    const res = await fetch(RX_URL);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const terms = (await res.json())?.displayTermsList?.term;
    if (!Array.isArray(terms) || !terms.length) throw new Error("unexpected response");
    remoteNames = terms.filter((t) => typeof t === "string" && t.trim());
    try { localStorage.setItem(RX_CACHE, JSON.stringify({ t: Date.now(), names: remoteNames })); } catch {}
    setSourceNote("Searching " + remoteNames.length.toLocaleString() + " names from NIH RxNorm.");
  } catch {
    setSourceNote("Could not reach the NIH drug database. Using the built-in list of common medications.");
  }
}


// Live lookups while typing: Health Canada Drug Product Database (brand names and active ingredients)
// and the US FDA product directory (openFDA). Only runs when the "search online" box is ticked.
const LIVE_KEY = "livesearch.enabled";
function liveEnabled() { try { return localStorage.getItem(LIVE_KEY) !== "off"; } catch { return true; } }
const liveCache = new Map(); // query -> options
let liveTimer = null;
let liveCtl = null;

function titleCase(str) {
  return String(str || "").toLowerCase().replace(/(^|[\s\-\/(])([a-z])/g, (m, a, b) => a + b.toUpperCase()).trim();
}
async function getJSON(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}
function unitText(u) {
  const x = String(u || "").trim().toLowerCase();
  return x === "iu" ? "IU" : x;
}
function strengthText(r) {
  const n = String(r.strength ?? "").trim();
  return n ? (n + " " + unitText(r.strength_unit)).trim() : "";
}
function fdaStrength(list) {
  const parts = (Array.isArray(list) ? list : []).map((a) => String(a.strength || "").replace(/\/1$/, "").trim()).filter(Boolean);
  return parts.length ? parts.join(" / ") : "";
}
async function fetchLive(q, signal) {
  const safe = q.replace(/[^a-z0-9 ]/gi, " ").replace(/\s+/g, " ").trim();
  if (safe.length < 3) return { options: [], failed: false, report: "" };
  const full = encodeURIComponent(safe);
  const first = encodeURIComponent(safe.split(" ")[0]);
  const jobs = [
    getJSON("https://health-products.canada.ca/api/drug/drugproduct/?brandname=" + full + "&lang=en&type=json", signal)
      .then((rows) => (Array.isArray(rows) ? rows : []).map((r) => ({ name: titleCase(r.brand_name), sub: "Health Canada", code: r.drug_code }))),
    getJSON("https://health-products.canada.ca/api/drug/activeingredient/?ingredientname=" + full + "&lang=en&type=json", signal)
      .then((rows) => (Array.isArray(rows) ? rows : []).map((r) => ({ name: titleCase(r.ingredient_name), sub: "Health Canada", dose: strengthText(r) }))),
    getJSON("https://api.fda.gov/drug/ndc.json?search=brand_name:" + first + "*+OR+generic_name:" + first + "*&limit=25", signal)
      .then((j) => (j && Array.isArray(j.results) ? j.results : []).map((r) => {
        const generic = String(r.generic_name || "").toLowerCase();
        return { name: titleCase(r.brand_name || r.generic_name), generic: generic.length <= 40 ? generic : "", sub: "FDA", dose: fdaStrength(r.active_ingredients) };
      })),
  ];
  const settled = await Promise.allSettled(jobs);
  const names = ["Health Canada brands", "Health Canada ingredients", "FDA"];
  const report = settled.map((r, i) => names[i] + ": " + (r.status === "fulfilled" ? r.value.length + " found" : "no response")).join(" · ");
  const byValue = new Map();
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    for (const item of r.value) {
      if (!item.name) continue;
      const value = item.generic && item.generic !== item.name.toLowerCase() ? item.name + " (" + item.generic + ")" : item.name;
      const k = value.toLowerCase();
      let o = byValue.get(k);
      if (!o) { o = { label: item.name, value, sub: item.generic || item.sub, key: item.name.toLowerCase(), doses: [], codes: [] }; byValue.set(k, o); }
      if (item.dose && !o.doses.includes(item.dose)) o.doses.push(item.dose);
      if (item.code && o.codes.length < 6 && !o.codes.includes(item.code)) o.codes.push(item.code);
    }
  }
  return { options: [...byValue.values()].slice(0, 60), failed: settled.every((r) => r.status === "rejected"), report };
}
// Strengths for a Health Canada brand: one request per product code (a brand can have several products).
async function fetchStrengthsByCode(codes) {
  const out = [];
  const results = await Promise.allSettled(codes.map((c) =>
    getJSON("https://health-products.canada.ca/api/drug/activeingredient/?id=" + encodeURIComponent(c) + "&lang=en&type=json")));
  for (const r of results) {
    if (r.status !== "fulfilled" || !Array.isArray(r.value)) continue;
    const text = r.value.map(strengthText).filter(Boolean).join(" / ");
    if (text && !out.includes(text)) out.push(text);
  }
  return out;
}
function scheduleLive() {
  if (!liveEnabled()) return;
  const q = $("name").value.trim().toLowerCase();
  if (q.length < 3 || liveCache.has(q)) return;
  clearTimeout(liveTimer);
  liveTimer = setTimeout(async () => {
    if (liveCtl) liveCtl.abort();
    liveCtl = new AbortController();
    try {
      const { options, failed, report } = await fetchLive(q, liveCtl.signal);
      $("live-status").textContent = failed ? "Online lookup is unavailable right now. Showing the saved list only. (" + report + ")" : "Searched \u201c" + q + "\u201d. " + report;
      if (failed) return;
      liveCache.set(q, options);
      if (liveCache.size > 12) liveCache.delete(liveCache.keys().next().value);
      if ($("name").value.trim().toLowerCase() === q && document.activeElement === $("name") && Date.now() > noReopenUntil) openList();
    } catch { /* aborted or offline: the saved lists still work */ }
  }, 300);
}

let shown = [];
let active = -1;

function score(key, q) {
  if (key.startsWith(q)) return 0;
  if (key.split(/[\s\/(),-]+/).some((w) => w.startsWith(q))) return 1;
  return key.includes(q) ? 2 : -1;
}
function matches(q) {
  q = q.trim().toLowerCase();
  if (!q) return [];
  const pool = [];
  const seen = new Set();
  for (const e of [...log].sort((a, b) => b.takenAt.localeCompare(a.takenAt))) {
    if (seen.has(e.name)) continue;
    seen.add(e.name);
    pool.push({ label: e.name, value: e.name, sub: "Logged before", recent: true, key: e.name.toLowerCase() });
  }
  pool.push(...OPTIONS.filter((o) => !seen.has(o.value)));
  const known = new Set(OPTIONS.map((o) => o.key));
  for (const n of remoteNames) {
    const k = n.toLowerCase();
    if (!known.has(k) && !seen.has(n)) pool.push({ label: n, value: n, sub: "RxNorm", key: k });
  }
  if (liveEnabled()) {
    const have = new Set(pool.map((o) => o.value.toLowerCase()));
    for (const opts of liveCache.values()) for (const o of opts) {
      if (!have.has(o.value.toLowerCase()) && !known.has(o.key)) { have.add(o.value.toLowerCase()); pool.push(o); }
    }
  }
  const scored = [];
  for (const o of pool) {
    let sc = score(o.key, q);
    if (sc < 0 && o.sub && !o.recent) { const s2 = score(o.sub.toLowerCase(), q); if (s2 >= 0) sc = s2 + 3; }
    if (sc >= 0) scored.push({ o, sc: o.recent ? Math.min(sc, 1) - 0.5 : sc });
  }
  scored.sort((a, b) => a.sc - b.sc || a.o.label.localeCompare(b.o.label));
  return scored.slice(0, 8).map((x) => x.o);
}
function closeList() {
  $("suggest").hidden = true; $("name").setAttribute("aria-expanded", "false");
  $("name").removeAttribute("aria-activedescendant"); active = -1;
}
function highlight(i) {
  active = i;
  [...$("suggest").children].forEach((li, n) => li.setAttribute("aria-selected", String(n === i)));
  if (i >= 0) { $("name").setAttribute("aria-activedescendant", "opt-" + i); $("suggest").children[i].scrollIntoView({ block: "nearest" }); }
  else $("name").removeAttribute("aria-activedescendant");
}
let currentChoice = null;
function lastDose(name) {
  const key = name.trim().toLowerCase();
  const hit = [...log].sort((a, b) => b.takenAt.localeCompare(a.takenAt)).find((e) => e.name.toLowerCase() === key && e.dose);
  return hit ? hit.dose : "";
}
function renderDoseChips(doses) {
  const box = $("dose-chips");
  box.replaceChildren();
  for (const d of doses) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip"; b.textContent = d;
    b.onclick = () => { $("dose").value = d; };
    box.append(b);
  }
  box.hidden = doses.length === 0;
}
async function showDoses(chosen) {
  let o = chosen;
  const last = lastDose(o.value);
  const known = [...(o.doses || [])];
  // A "Logged before" suggestion has no database details of its own; borrow them from a matching online result.
  if (o.recent) {
    for (const opts of liveCache.values()) {
      const m = opts.find((x) => x.value.toLowerCase() === o.value.toLowerCase());
      if (m) { known.push(...m.doses); o = { ...o, codes: m.codes }; break; }
    }
  }
  const list = () => [...new Set([last, ...known].filter(Boolean))].slice(0, 10);
  const prefill = () => {
    if ($("dose").value.trim()) return;
    if (last) $("dose").value = last;
    else if (list().length === 1) $("dose").value = list()[0];
  };
  renderDoseChips(list()); prefill();
  if (o.codes && o.codes.length && liveEnabled()) {
    try { known.push(...(await fetchStrengthsByCode(o.codes))); } catch {}
    if (currentChoice !== chosen) return;
    renderDoseChips(list()); prefill();
  }
}
let noReopenUntil = 0;
function choose(o) {
  noReopenUntil = Date.now() + 500;
  $("name").value = o.value;
  currentChoice = o;
  closeList();
  showDoses(o);
  $("dose").focus();
}
function openList() {
  shown = matches($("name").value);
  const typed = $("name").value.trim();
  if (typed && !shown.some((o) => o.value.toLowerCase() === typed.toLowerCase())) {
    shown.push({ label: "Use \u201c" + typed + "\u201d", value: typed, sub: "as typed" });
  }
  const ul = $("suggest");
  ul.replaceChildren();
  if (!shown.length) { closeList(); return; }
  shown.forEach((o, i) => {
    const li = document.createElement("li");
    li.id = "opt-" + i; li.setAttribute("role", "option"); li.setAttribute("aria-selected", "false");
    const n = document.createElement("span"); n.className = "opt-name"; n.textContent = o.label;
    const s = document.createElement("span"); s.className = "opt-sub" + (o.recent ? " opt-recent" : ""); s.textContent = o.sub;
    li.append(n, s);
    li.addEventListener("mousedown", (ev) => ev.preventDefault()); // keep focus in the field until the click lands
    li.addEventListener("click", () => choose(o));
    ul.append(li);
  });
  ul.hidden = false; $("name").setAttribute("aria-expanded", "true"); active = -1;
}
$("name").addEventListener("input", () => {
  if (currentChoice && $("name").value !== currentChoice.value) { currentChoice = null; renderDoseChips([]); }
  openList(); scheduleLive();
});
$("name").addEventListener("focus", () => { if (Date.now() > noReopenUntil && $("name").value.trim()) openList(); });
$("name").addEventListener("blur", closeList);
$("name").addEventListener("keydown", (ev) => {
  const open = !$("suggest").hidden;
  if (ev.key === "ArrowDown") { ev.preventDefault(); if (!open) openList(); else highlight((active + 1) % shown.length); }
  else if (ev.key === "ArrowUp" && open) { ev.preventDefault(); highlight(active <= 0 ? shown.length - 1 : active - 1); }
  else if (ev.key === "Enter" && open && active >= 0) { ev.preventDefault(); choose(shown[active]); }
  else if (ev.key === "Escape" && open) { ev.preventDefault(); closeList(); }
});

setNow();
render();
$("live-on").checked = liveEnabled();
$("live-on").addEventListener("change", () => {
  try { localStorage.setItem(LIVE_KEY, $("live-on").checked ? "on" : "off"); } catch {}
  $("live-status").textContent = "";
});
loadRemoteNames();
