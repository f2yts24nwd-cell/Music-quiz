/* =====================================================================
   Music Quiz – App-Logik
   ===================================================================== */
"use strict";
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = x => String(x ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = t => { t = Math.max(0, Math.floor(t)); return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"); };
const shuffle = (a, rnd = Math.random) => { for (let i = a.length - 1; i > 0; i--) { const j = rnd() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
const THIS_YEAR = new Date().getFullYear();
const RING = 301.6, PREVIEW = 30, DPS = 60; // Scratch: eine Umdrehung der Platte = 6 s

/* iPad erkennen (auch iPadOS, das sich als Mac ausgibt) */
const isIPad = /iPad/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
if (isIPad) document.documentElement.classList.add("ipad");

/* ============================ Einstellungen ============================ */
const DEFAULTS = { theme: "original", name: "", listen: 30, count: 10, cover: 20, hints: true, autoplay: true, answer: "type", strict: "locker", yearLevel: "normal", mixer: true, scratch: true, sfx: true };
const S = Object.assign({}, DEFAULTS, store.get("mq-settings", {}));
const saveSettings = () => store.set("mq-settings", S);

const SETTINGS = [
  { key: "theme", label: "Design", desc: "Wie die App aussieht. Probier alle durch.", opts: [["original", "Original"], ["glass", "Glass"], ["pop", "Farbrausch"], ["retro", "Retro"]] },
  { key: "name", label: "Dein Name", desc: "Steht in der Bestenliste.", type: "text" },
  { key: "listen", label: "Hördauer", desc: "Wie lange der Ausschnitt laufen darf.", opts: [[10, "10 s"], [20, "20 s"], [30, "30 s"]] },
  { key: "count", label: "Songs pro Runde", opts: [[5, "5"], [10, "10"], [15, "15"], [20, "20"]] },
  { key: "cover", label: "Verschwommenes Cover", desc: "Taucht nach dieser Hörzeit als Bild auf der Platte auf.", opts: [[0, "Aus"], [10, "nach 10 s"], [20, "nach 20 s"]] },
  { key: "autoplay", label: "Automatisch abspielen", desc: "Der Song startet von selbst, sobald er geladen ist.", opts: [[true, "An"], [false, "Aus"]] },
  { key: "hints", label: "Tipps", desc: "Tipps kosten je einen Punkt.", opts: [[true, "Erlaubt"], [false, "Aus"]] },
  { key: "answer", label: "Antworten", desc: "Eintippen oder aus Vorschlägen wählen – gilt für alle Modi, auch Party.", opts: [["type", "Eintippen"], ["choice", "Vorschläge"]] },
  { key: "strict", label: "Schreibweise", desc: "Wie genau Titel und Interpret stimmen müssen.", opts: [["locker", "Locker"], ["normal", "Normal"], ["streng", "Streng"]] },
  { key: "yearLevel", label: "Jahres-Auswahl", desc: "Wie nah die falschen Jahre am richtigen liegen.", opts: [["leicht", "Leicht"], ["normal", "Normal"], ["schwer", "Schwer"]] },
  { key: "mixer", label: "Mischpult", desc: "Lautstärke, Tempo, Filter und Effekt-Pads unter dem Plattenspieler.", opts: [[true, "Anzeigen"], [false, "Ausblenden"]] },
  { key: "scratch", label: "Scratch-Sound", desc: "Beim Drehen der Platte wie ein DJ scratchen.", opts: [[true, "An"], [false, "Aus"]] },
  { key: "sfx", label: "Soundeffekte", opts: [[true, "An"], [false, "Aus"]] },
];

/* ============================ Modi ============================ */
const MODES = {
  classic: { name: "Klassisch", icon: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>', desc: "Hören, raten, auflösen. Titel 2, Interpret 2, Jahr 3 Punkte." },
  blitz:   { name: "Blitz", icon: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>', desc: "20 Sekunden pro Song, ab dem ersten Ton. Wer schneller auflöst, kassiert bis zu 2 Bonuspunkte." },
  intro:   { name: "Intro-Profi", icon: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>', desc: "Nur 2 Sekunden Musik. Jede Verlängerung kostet einen Punkt – erkennst du es früh, gewinnst du." },
  sudden:  { name: "Sudden Death", icon: '<path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z"/>', desc: "Endlos-Runde. Sobald du Titel und Interpret verpasst, ist Schluss." },
  choice:  { name: "Multiple Choice", icon: '<path d="M4 6h2M4 12h2M4 18h2M9 6h11M9 12h11M9 18h11"/>', desc: "Titel und Interpret aus je vier Vorschlägen antippen – kein Eintippen nötig." },
  party:   { name: "Party", icon: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M14 20a4.5 4.5 0 0 1 7-3.7"/>', desc: "2 bis 6 Leute, ein Gerät. Ihr seid abwechselnd dran, am Ende gibt es ein Treppchen." },
};
let mode = store.get("mq-mode", "classic");
const INTRO_STAGES = [2, 5, 10, 20, 30];
const BLITZ_SEC = 20;

/* ============================ Live-Charts-Genre ============================ */
window.GENRES = window.GENRES || [];
GENRES.splice(1, 0, { id: "live", name: "Live-Charts", tagline: "Was gerade läuft: die aktuellen Top 100 bei Deezer", colors: ["#ff7b9c", "#7ff3e6"], live: true, songs: [] });

/* ============================ Deezer-Ausbau: mehr Songs pro Genre ============================ */
// Jedes Genre holt sich zusätzlich Songs aus passenden Deezer-Playlists.
const DZ_QUERIES = {
  trance: ["Trance Classics", "Trance Anthems", "Vocal Trance Classics", "Trance 2000s"],
  charts2526: ["Top Hits 2025", "Hits 2026", "Charts Deutschland 2025", "Top Deutschland"],
  achtziger: ["80s Hits", "Best of 80s", "80er Hits", "80s Pop"],
  eurodance: ["90s Dance", "Eurodance", "90er Hits", "90s Party"],
  nullerjahre: ["2000s Hits", "00s Pop", "2000er Hits", "Throwback 2000s"],
  deutschrap: ["Deutschrap Klassiker", "Deutschrap Hits", "Deutschrap Brandneu", "Deutschrap 2010er"],
  rock: ["Rock Classics", "Classic Rock", "Rock Hymnen", "90s Rock"],
  schlager: ["Schlager Hits", "Schlager Klassiker", "Ballermann Hits", "Party Schlager"],
  kids: ["Disney Hits", "Kinderlieder", "Familien Hits", "Disney Songs"],
  zehner: ["2010s Hits", "Best of 2010s", "2010er Hits", "Throwback 2010s"],
  siebziger: ["70s Hits", "Disco Classics", "70er Hits", "Disco"],
  hiphop: ["Hip Hop Classics", "90s Hip Hop", "R&B Classics", "2000s Hip Hop"],
  edm: ["EDM Hits", "House Classics", "Dance Hits", "Festival Hits"],
  latin: ["Latin Hits", "Reggaeton Classics", "Latin Pop", "Sommerhits"],
};
[
  { id: "zehner", name: "2010er Hits", tagline: "Streaming-Ära: die Hits der 2010er", colors: ["#7fb2ff", "#ff9ad5"] },
  { id: "siebziger", name: "70er & Disco", tagline: "Schlaghosen, Glitzerkugel, Groove", colors: ["#ffcf5c", "#ff7a3d"] },
  { id: "hiphop", name: "Hip-Hop & R&B", tagline: "Klassiker von Old School bis heute", colors: ["#ffd23d", "#9b8cff"] },
  { id: "edm", name: "EDM & House", tagline: "Festival-Hymnen und Club-Bretter", colors: ["#2ee6ff", "#a347ff"] },
  { id: "latin", name: "Latin & Sommer", tagline: "Reggaeton, Latin Pop, Sommerhits", colors: ["#ff9500", "#ff2d55"] },
].forEach(g => GENRES.push(Object.assign({ songs: [], dynamic: true }, g)));
GENRES.forEach(g => { if (DZ_QUERIES[g.id]) g.dz = DZ_QUERIES[g.id]; });

const cleanTitle = t => String(t || "")
  .replace(/\s*[\(\[][^\)\]]*\b(remaster(ed)?|radio edit|single version|edit|version|mix|mono|stereo|live|feat\.?|ft\.?|with)\b[^\)\]]*[\)\]]/ig, "")
  .replace(/\s+[-–]\s+.*\b(remaster(ed)?|radio edit|single version|edit|version|mix|mono|live)\b.*$/i, "").trim();
const songKey = (a, t) => norm(String(a).split(/,|&| feat| x /i)[0]) + "|" + norm(cleanTitle(t));
const BAD_ALBUM = /\b(karaoke|tribute|cover|instrumental|workout|lullaby|8-bit|piano|made famous|in the style)\b/i;
async function loadExtra(g) {
  if (!g.dz) return [];
  if (g._extra) return g._extra;
  const ck = "mq-dz2-" + g.id, cached = store.get(ck, null);
  if (cached && Date.now() - cached.t < 3 * 864e5 && cached.s.length) return (g._extra = cached.s);
  const have = new Set(g.songs.map(s => songKey(s[0], s[1]))), out = [];
  const lists = (await Promise.allSettled(g.dz.map(q => jsonp("search/playlist?limit=6&q=" + encodeURIComponent(q)))))
    .flatMap(r => r.status === "fulfilled" ? (r.value.data || []).filter(p => p.nb_tracks >= 20).slice(0, 2) : []);
  const ids = [...new Set(lists.map(p => p.id))].slice(0, 8);
  const tracks = await Promise.allSettled(ids.map(id => jsonp(`playlist/${id}/tracks?limit=200`)));
  tracks.forEach(r => { if (r.status !== "fulfilled") return; (r.value.data || []).forEach(t => {
    if (!t.preview || !t.artist || BAD_ALBUM.test((t.album && t.album.title) || "") || BAD_ALBUM.test(t.title)) return;
    const title = cleanTitle(t.title_short || t.title), k = songKey(t.artist.name, title);
    if (!title || have.has(k)) return; have.add(k);
    out.push([t.artist.name, title, null, dzOf(t)]);
  }); });
  if (out.length) store.set(ck, { t: Date.now(), s: out });
  return (g._extra = out);
}
// Erscheinungsjahr: früheste Veröffentlichung über alle passenden Alben (Sampler & Remaster zählen nicht)
const yearCache = store.get("mq-years", {});
async function resolveYear(song) {
  const k = songKey(song[0], song[1]);
  if (yearCache[k]) return yearCache[k];
  const ids = new Set(), yrs = [];
  if (song[3] && song[3].albumId) ids.add(song[3].albumId);
  try {
    const d = await jsonp("search?limit=25&q=" + encodeURIComponent(`artist:"${song[0]}" track:"${cleanTitle(song[1])}"`));
    (d.data || []).filter(x => matches(x.title_short || x.title, cleanTitle(song[1]), false, "normal") && matches(x.artist.name, song[0], true, "locker"))
      .forEach(x => x.album && ids.add(x.album.id));
  } catch (e) {}
  const al = await Promise.allSettled([...ids].slice(0, 8).map(id => jsonp("album/" + id)));
  al.forEach(r => { if (r.status !== "fulfilled") return; const a = r.value, y = parseInt(String(a.release_date).slice(0, 4), 10);
    if (y > 1900 && y <= THIS_YEAR && !(a.record_type === "compile" && ids.size > 1)) yrs.push(y); });
  const y = yrs.length ? Math.min(...yrs) : null;
  if (y) { yearCache[k] = y; store.set("mq-years", yearCache); }
  return y;
}
// Song vorbereiten: Vorschau + Jahr (für den nächsten Song schon im Hintergrund)
const prepCache = new Map();
function prepare(song) {
  const key = song[0] + "|" + song[1];
  if (prepCache.has(key)) return prepCache.get(key);
  const p = (async () => { const dz = await lookup(song); if (!dz) return null; let years = song[2]; if (!years) { const y = await resolveYear(song); if (!y) return null; years = [y]; } return { dz, years }; })();
  prepCache.set(key, p); return p;
}

/* ============================ Textvergleich ============================ */
function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss").replace(/&|\+/g, " and ").replace(/['’`´]/g, "").replace(/!/g, "i").replace(/\$/g, "s")
    .replace(/[^a-z0-9]+/g, " ").replace(/\b(the|dj|feat|ft|featuring|pres|presents|der|die|das)\b/g, " ")
    .replace(/\s+/g, " ").trim();
}
function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let p = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) { const c = [i]; for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; }
  return p[n];
}
const LV = { locker: { sim: .62, tok: .5, loose: true }, normal: { sim: .78, tok: .6, loose: false }, streng: { sim: .9, tok: 9, loose: false } };
const tol = len => len <= 3 ? 0 : len <= 5 ? 1 : len <= 8 ? 2 : 3;
// Lautähnliche Schreibweisen angleichen: "Tiesto/Tiësto", "Gouryela/Gouryella", "Kristal/Crystal" …
const simp = s => s.replace(/ph/g, "f").replace(/ck/g, "k").replace(/c(?=[aou ]|$)/g, "k").replace(/c/g, "s").replace(/z/g, "s").replace(/y/g, "i")
  .replace(/th/g, "t").replace(/ie/g, "i").replace(/ou/g, "u").replace(/oo/g, "u").replace(/(.)\1+/g, "$1").replace(/h(?![aeiou])/g, "");
const STOP = new Set(["a", "an", "of", "in", "on", "to", "my", "me", "you", "i", "is", "it", "and", "for", "be", "la", "le", "el", "de", "der", "die", "das", "und", "im", "am"]);
function similar(g, a, L) {
  if (!g || !a) return false;
  if (g === a) return true;
  const gc = g.replace(/ /g, ""), ac = a.replace(/ /g, "");
  if (gc === ac) return true;
  const ratio = (x, y) => 1 - lev(x, y) / Math.max(x.length, y.length);
  if (ratio(gc, ac) >= L.sim) return true;
  if (L.tok > 1) return false;
  if (ac.length >= 3 && gc.includes(ac)) return true;
  if (L.loose) {
    const gs = simp(gc), as = simp(ac);
    if (gs === as || ratio(gs, as) >= L.sim - .04) return true;
    if (gc.length >= 3 && ac.startsWith(gc) && gc.length / ac.length >= .3) return true;            // Anfang reicht: "sandst" -> Sandstorm
    if (gc.length >= 4 && ac.includes(gc) && gc.length / ac.length >= .3) return true;             // Teil reicht: "feels like"
    if (gc.length >= 5 && ac.length >= 5 && ratio(gs, as.slice(0, gs.length)) >= .75 && gs.length / as.length >= .45) return true; // vertippter Anfang
  }
  const at = a.split(" ").filter(w => (w.length > 1 || /\d/.test(w)) && !STOP.has(w)), gt = g.split(" ").filter(w => w.length > 1 || /\d/.test(w));
  if (!at.length || !gt.length) return false;
  const tokHit = (w, x) => x === w || (w.length > 3 && lev(x, w) <= tol(w.length)) ||
    (L.loose && ((x.length >= 4 && w.startsWith(x)) || (w.length > 3 && simp(x) === simp(w)) || (w.length > 4 && lev(simp(x), simp(w)) <= tol(w.length))));
  const hit = at.filter(w => gt.some(x => tokHit(w, x)));
  if (hit.length / at.length >= L.tok && hit.some(w => w.length >= 3)) return true;
  return L.loose && (hit.some(w => w.length >= 4) || (hit.length / at.length >= .34 && hit.some(w => w.length >= 3)));
}
function variants(answer, isArtist) {
  const v = new Set([answer, answer.replace(/\(.*?\)/g, ""), answer.replace(/[()]/g, " ")]);
  (answer.match(/\((.*?)\)/g) || []).forEach(x => v.add(x.slice(1, -1)));
  if (isArtist) answer.split(/\s*(?:&|\band\b|\bx\b|\bvs\.?|\bfeat\.?|\bft\.?|,|\bpres\.?|\bwith\b)\s*/i).forEach(x => x && v.add(x));
  return [...v].map(norm).filter(Boolean);
}
const matches = (guess, answer, isArtist, lvl = S.strict) => { const g = norm(guess); return !!g && variants(answer, isArtist).some(a => similar(g, a, LV[lvl] || LV.locker)); };

/* ============================ Deezer ============================ */
let cbId = 0;
function jsonp(path) {
  return new Promise((res, rej) => {
    const name = "__dz" + (cbId++), s = document.createElement("script");
    const t = setTimeout(() => { done(); rej(new Error("timeout")); }, 9000);
    function done() { clearTimeout(t); delete window[name]; s.remove(); }
    window[name] = d => { done(); d && d.error ? rej(new Error("api")) : res(d); };
    s.onerror = () => { done(); rej(new Error("network")); };
    s.src = "https://api.deezer.com/" + path + (path.includes("?") ? "&" : "?") + "output=jsonp&callback=" + name;
    document.head.appendChild(s);
  });
}
const cache = new Map();
const dzOf = f => ({ preview: f.preview, cover: f.album && (f.album.cover_xl || f.album.cover_big), link: f.link, albumId: f.album && f.album.id, rank: f.rank || 0 });
function lookup(song) {
  if (song[3]) return Promise.resolve(song[3]);
  const key = song[0] + "|" + song[1];
  if (cache.has(key)) return cache.get(key);
  const p = (async () => {
    const title = song[1].replace(/\(.*?\)/g, "").trim(), artist = song[0].replace(/^DJ\s+/i, "").replace(/-Cast$/i, "");
    for (const q of [`artist:"${artist}" track:"${title}"`, `${artist} ${title}`, title]) {
      try {
        const d = await jsonp("search?limit=20&q=" + encodeURIComponent(q));
        const list = (d && d.data || []).filter(x => x.preview);
        const f = list.find(x => matches(x.title_short || x.title, title, false, "locker") && matches(x.artist.name, artist, true, "locker"))
          || (q !== title && list.find(x => matches(x.title_short || x.title, title, false, "normal")));
        if (f) return dzOf(f);
      } catch (e) {}
    }
    return null;
  })();
  cache.set(key, p);
  return p;
}
async function loadLiveCharts() {
  const g = GENRES.find(x => x.live);
  if (g.songs.length) return g;
  const d = await jsonp("chart/0/tracks?limit=100");
  g.songs = (d.data || []).filter(t => t.preview).map(t => [t.artist.name, t.title_short || t.title, null, dzOf(t)]);
  return g;
}
async function yearOfAlbum(id) {
  try { const a = await jsonp("album/" + id); const y = parseInt(String(a.release_date).slice(0, 4), 10); return y > 1900 ? y : null; } catch (e) { return null; }
}

/* ============================ Sound & Effekte ============================ */
let actx = null;
function ac() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (actx && actx.state === "suspended") actx.resume(); return actx; }
function tone(f, dur = .12, type = "sine", vol = .12, delay = 0, slide = 0) {
  if (!S.sfx) return; const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + delay;
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + .02);
}
const SFX = {
  tap: () => tone(520, .06, "triangle", .05),
  tick: () => tone(2400, .02, "square", .015),
  good: () => { tone(660, .12, "triangle", .1); tone(880, .12, "triangle", .1, .09); tone(1320, .22, "triangle", .1, .18); },
  mid: () => { tone(560, .12, "triangle", .08); tone(700, .18, "triangle", .08, .1); },
  bad: () => { tone(260, .25, "sawtooth", .045, 0, .6); },
  hint: () => tone(980, .14, "sine", .07, 0, 1.4),
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .25, "triangle", .08, i * .09)),
};
document.addEventListener("pointerdown", () => ac(), { once: true });

const fx = $("#fx"), fxc = fx.getContext("2d");
let parts = [], fxRun = false;
function confetti(n = 140) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const W = fx.width = innerWidth * devicePixelRatio, H = fx.height = innerHeight * devicePixelRatio;
  const cols = ["#b9a4ff", "#7ff3e6", "#ffb38a", "#f39cff", "#fff2c4", "#7ff3a8"];
  for (let i = 0; i < n; i++) parts.push({ x: W / 2 + (Math.random() - .5) * W * .3, y: H * .35, vx: (Math.random() - .5) * 26 * devicePixelRatio, vy: (-Math.random() * 22 - 8) * devicePixelRatio,
    r: (Math.random() * 6 + 4) * devicePixelRatio, c: cols[i % cols.length], a: Math.random() * 6, va: (Math.random() - .5) * .4, life: 1 });
  if (!fxRun) { fxRun = true; requestAnimationFrame(fxLoop); }
}
function fxLoop() {
  fxc.clearRect(0, 0, fx.width, fx.height);
  parts.forEach(p => { p.vy += .9 * devicePixelRatio; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.a += p.va; p.life -= .008;
    fxc.save(); fxc.globalAlpha = Math.max(0, p.life); fxc.translate(p.x, p.y); fxc.rotate(p.a); fxc.fillStyle = p.c; fxc.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); fxc.restore(); });
  parts = parts.filter(p => p.life > 0 && p.y < fx.height + 50);
  if (parts.length) requestAnimationFrame(fxLoop); else { fxRun = false; fxc.clearRect(0, 0, fx.width, fx.height); }
}
let toastT = 0;
function toast(t) { const el = $("#toast"); el.textContent = t; el.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("on"), 2300); }
function countUp(el, from, to, ms = 600) {
  const t0 = performance.now();
  (function f(now) { const k = Math.min(1, (now - t0) / ms); el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(f); })(t0);
}
const setDiscColors = (el, g) => { if (!g || !g.colors) return; el.style.setProperty("--c1", g.colors[0]); el.style.setProperty("--c2", g.colors[1]); };

/* ============================ Sheets ============================ */
let openSheetId = null, sheetReturn = null;
function openSheet(id, ret = null) {
  closeSheet(true);
  sheetReturn = ret;
  if (id === "settings") renderSettings();
  if (id === "board") renderBoard();
  $("#scrim").classList.add("on"); $("#sheet-" + id).classList.add("on"); openSheetId = id;
}
function closeSheet(silent) {
  if (!openSheetId) return;
  $("#sheet-" + openSheetId).classList.remove("on"); $("#scrim").classList.remove("on");
  const was = openSheetId; openSheetId = null;
  if (!silent && was === "settings") { renderHome(); if (sheetReturn === "setup") { sheetReturn = null; setTimeout(() => { renderSetupSummary(); openSheet("setup"); }, 250); } }
}
$("#scrim").onclick = () => closeSheet();
document.addEventListener("keydown", e => { if (e.key === "Escape") closeSheet(); });
document.addEventListener("click", e => {
  const b = e.target.closest("[data-sheet]"); if (!b) return;
  openSheet(b.dataset.sheet, b.closest("#sheet-setup") ? "setup" : null);
});
// Sheet nach unten wegwischen
$$(".sheet").forEach(sh => {
  let y0 = null, dy = 0;
  sh.addEventListener("touchstart", e => { if (sh.scrollTop <= 0) { y0 = e.touches[0].clientY; dy = 0; } }, { passive: true });
  sh.addEventListener("touchmove", e => { if (y0 == null) return; dy = e.touches[0].clientY - y0; if (dy > 0) { sh.style.transition = "none"; sh.style.transform = `translate(-50%,${dy}px)`; } }, { passive: true });
  sh.addEventListener("touchend", () => { if (y0 == null) return; sh.style.transition = ""; sh.style.transform = ""; if (dy > 110) closeSheet(); y0 = null; });
});
let confirmCb = null;
function confirmBox(title, text, yes, cb) { $("#confirmTitle").textContent = title; $("#confirmText").textContent = text; $("#confirmYes").textContent = yes; confirmCb = cb; openSheet("confirm"); }
$("#confirmNo").onclick = () => closeSheet();
$("#confirmYes").onclick = () => { closeSheet(true); const cb = confirmCb; confirmCb = null; cb && cb(); };

/* ============================ Startseite ============================ */
const show = id => { $$(".screen").forEach(s => s.classList.toggle("hide", s.id !== id)); scrollTo(0, 0); };
const todayKey = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

function renderHome() {
  $("#modes").innerHTML = Object.entries(MODES).map(([k, m]) => `<button class="mode${k === mode ? " on" : ""}" data-m="${k}"><i><svg viewBox="0 0 24 24">${m.icon}</svg></i>${m.name}</button>`).join("");
  $("#modeDesc").textContent = MODES[mode].desc;
  $("#genreList").innerHTML = GENRES.map((g, i) => {
    const best = store.get("mq-best-" + g.id, 0);
    const c = g.colors ? `style="--c1:${g.colors[0]};--c2:${g.colors[1]}"` : "";
    return `<button class="genre${g.live ? " live" : ""}" data-i="${i}" ${c}><div class="disc"></div><div><b>${esc(g.name)}</b><small>${esc(g.tagline)}</small></div>${best && !g.live ? `<span class="rec">★ ${best}</span>` : ""}</button>`;
  }).join("");
  const d = store.get("mq-daily-" + todayKey(), null);
  $("#daily").classList.toggle("done", !!d);
  $("#dailySub").textContent = d ? `Heute geschafft: ${d.score} Punkte. Morgen gibt es neue Songs.` : "5 Songs aus allen Genres. Nur der erste Versuch zählt.";
  $("#dailyGo").textContent = d ? "Üben" : "Los";
}
$("#modes").onclick = e => { const b = e.target.closest(".mode"); if (!b) return; SFX.tap(); mode = b.dataset.m; store.set("mq-mode", mode); renderHome(); };
$("#genreList").onclick = e => { const b = e.target.closest(".genre"); if (b) { SFX.tap(); openSetup(GENRES[+b.dataset.i]); } };
$("#daily").onclick = () => { SFX.tap(); startDaily(); };

/* ============================ Setup-Sheet ============================ */
let setupGenre = null, players = store.get("mq-players", ["", ""]);
const groupOf = (g, s) => g.groupBy === "year" ? s[2][s[2].length - 1] : Math.floor(s[2][0] / 10) * 10;
async function openSetup(g) {
  setupGenre = g;
  setDiscColors($("#setupDisc"), g);
  $("#setupName").textContent = g.name; $("#setupTag").textContent = g.tagline;
  $("#partyWrap").classList.toggle("hide", mode !== "party");
  renderPlayers(); renderSetupSummary(); renderFame(g);
  $("#start").disabled = false;
  if (g.live) {
    $("#setupFilterWrap").classList.add("hide");
    openSheet("setup");
    if (!g.songs.length) {
      $("#start").disabled = true; $("#start").textContent = "Lade Charts …";
      try { await loadLiveCharts(); $("#start").disabled = false; $("#start").textContent = "Runde starten"; }
      catch (e) { $("#start").textContent = "Deezer nicht erreichbar"; }
    }
    return;
  }
  $("#start").textContent = "Runde starten";
  $("#setupFilterWrap").classList.remove("hide");
  if (g.dz) {
    $("#setupTag").textContent = g._extra ? `${g.tagline} · ${g.songs.length + g._extra.length} Songs` : `${g.tagline} · lade mehr Songs von Deezer …`;
    g._extraP = g._extraP || loadExtra(g).catch(() => []);
    g._extraP.then(x => { if (setupGenre === g) $("#setupTag").textContent = `${g.tagline} · ${g.songs.length + x.length} Songs`; });
  }
  const groups = [...new Set(g.songs.map(s => groupOf(g, s)))].sort();
  $("#setupFilterLbl").textContent = g.groupBy === "year" ? "Jahre" : "Jahrzehnte";
  $("#setupFilter").innerHTML = groups.map(d => `<button class="chip on" data-v="${d}">${g.groupBy === "year" ? d : (d < 2000 ? String(d).slice(2) : d) + "er"}</button>`).join("");
  $("#setupFilterWrap").classList.toggle("hide", groups.length < 2);
  if (g.dynamic) { $("#start").disabled = true; $("#start").textContent = "Lade Songs …"; g._extraP.then(x => { if (setupGenre !== g) return; $("#start").disabled = !x.length; $("#start").textContent = x.length ? "Runde starten" : "Deezer nicht erreichbar"; }); }
  openSheet("setup");
}
/* Bekanntheit: bekannte Hits, Mischung oder Geheimtipps (nach Deezer-Popularität) */
let fame = store.get("mq-fame", "mix");
const FAME_NOTE = { known: "Nur die großen Hits, die fast jeder kennt.", mix: "Große Hits und weniger bekannte Songs gemischt.", deep: "Weniger bekannte Songs aus dem Genre – für Kenner." };
function renderFame(g) {
  $("#fameWrap").classList.toggle("hide", !!g.live || !g.dz);
  $$("#fame button").forEach(b => b.classList.toggle("on", b.dataset.f === fame));
  $("#fameNote").textContent = FAME_NOTE[fame];
}
$("#fame").onclick = e => { const b = e.target.closest("button"); if (!b) return; SFX.tap(); fame = b.dataset.f; store.set("mq-fame", fame); renderFame(setupGenre); };
function byFame(curated, extra) {
  if (fame === "mix" || !extra.length) return curated.concat(extra);
  const ranks = extra.map(s => (s[3] && s[3].rank) || 0).sort((x, y) => y - x);
  if (fame === "known") { const hi = ranks[Math.floor(ranks.length * .35)] || 0; return curated.concat(extra.filter(s => ((s[3] && s[3].rank) || 0) >= hi)); }
  const lo = ranks[Math.floor(ranks.length * .45)] || 0, deep = extra.filter(s => ((s[3] && s[3].rank) || 0) < lo);
  return deep.length >= 8 ? deep : curated.concat(extra);
}
$("#setupFilter").onclick = e => { const b = e.target.closest(".chip"); if (!b) return; b.classList.toggle("on"); SFX.tap(); $("#start").disabled = !$("#setupFilter .on"); };
function renderPlayers() {
  $("#players").innerHTML = players.map((p, i) => `<div class="player-row"><input value="${esc(p)}" data-i="${i}" placeholder="Spieler ${i + 1}" maxlength="16">${players.length > 2 ? `<button data-x="${i}" aria-label="Entfernen">×</button>` : ""}</div>`).join("");
  $("#addPlayer").classList.toggle("hide", players.length >= 6);
}
$("#players").oninput = e => { if (e.target.dataset.i != null) { players[+e.target.dataset.i] = e.target.value; store.set("mq-players", players); } };
$("#players").onclick = e => { const x = e.target.dataset.x; if (x != null) { players.splice(+x, 1); store.set("mq-players", players); renderPlayers(); } };
$("#addPlayer").onclick = () => { players.push(""); store.set("mq-players", players); renderPlayers(); const ins = $$("#players input"); ins[ins.length - 1].focus(); };
function renderSetupSummary() {
  const listen = mode === "intro" ? "2 s, verlängerbar" : S.listen + " s";
  const count = mode === "sudden" ? "endlos" : S.count + " Songs";
  const cover = mode === "intro" || !S.cover ? "aus" : "nach " + S.cover + " s";
  $("#setupSummary").innerHTML = `<b>${MODES[mode].name}</b> · ${count} · Hören ${listen} · Cover ${cover} · Tipps ${S.hints ? "an" : "aus"}<br><span style="color:var(--lilac)">Einstellungen ändern</span>`;
}
$("#start").onclick = async () => {
  const g = setupGenre; let songs = g.songs, allowed = null;
  if (g._extraP && !g._extra) { $("#start").disabled = true; $("#start").textContent = "Lade Songs …"; await Promise.race([g._extraP, new Promise(r => setTimeout(r, 6000))]); $("#start").disabled = false; $("#start").textContent = "Runde starten"; }
  if (!g.live) {
    const chips = $$("#setupFilter .chip"), sel = $$("#setupFilter .on").map(b => +b.dataset.v);
    songs = songs.filter(s => sel.includes(groupOf(g, s)));
    if (chips.length > 1 && sel.length < chips.length) allowed = new Set(sel);
    songs = byFame(songs, g._extra || []);
    if (fame === "deep" && songs.length && !(g._extra || []).includes(songs[0])) toast("Zu wenige Geheimtipps geladen – es gibt eine Mischung");
  }
  closeSheet(true);
  startRound({ genre: g, songs, mode, allowed });
};

/* ============================ Tages-Challenge ============================ */
function seeded(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
  return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; }; }
function startDaily() {
  const all = GENRES.filter(g => !g.live).flatMap(g => g.songs.map(s => s));
  const rnd = seeded("mq" + todayKey());
  const songs = shuffle(all.slice().sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1])), rnd);
  const done = !!store.get("mq-daily-" + todayKey(), null);
  startRound({ genre: { id: "daily", name: "Tages-Challenge", colors: ["#b9a4ff", "#ffb38a"] }, songs, mode: "classic", daily: true, practice: done, keepOrder: true });
}

/* ============================ Deck: Wiedergabe, Scratch & DJ-Mixer ============================ */
// Bevorzugt Web Audio (Song wird dekodiert -> echtes Scratchen, EQ, Filter, Beat-FX).
// Falls der Song nicht dekodiert werden kann, spielt ein <audio>-Element ("Lite"-Modus).
const audio = new Audio(); audio.preload = "auto"; audio.setAttribute("playsinline", "");
audio.preservesPitch = false; audio.webkitPreservesPitch = false;
try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {} // iPhone: auch im Lautlos-Modus hörbar
const MIX_DEFAULT = { vol: 85, tempo: 0, hi: 0, mid: 0, low: 0, filter: 0, fx: "echo", wet: 55, fxOn: false };
const MIX = Object.assign({}, MIX_DEFAULT);
let WAVE = null; // Wellenform des aktuellen Songs
let graph = null, loadToken = 0, noiseBuf = null;

function makeImpulse(c, sec = 2.8, decay = 3.2) {
  const n = c.sampleRate * sec | 0, b = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
  return b;
}
function makeDrive(c, k = 6) {
  const ws = c.createWaveShaper(), n = 2048, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; curve[i] = Math.tanh(k * x) / Math.tanh(k); }
  ws.curve = curve; ws.oversample = "2x"; return ws;
}
function getNoise(c) {
  if (noiseBuf) return noiseBuf;
  noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate); const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}
function getGraph() {
  const c = ac(); if (!c) return null; if (graph) return graph;
  const G = { c };
  G.input = c.createGain();
  G.low = c.createBiquadFilter(); G.low.type = "lowshelf"; G.low.frequency.value = 180;
  G.mid = c.createBiquadFilter(); G.mid.type = "peaking"; G.mid.frequency.value = 1000; G.mid.Q.value = .7;
  G.hi = c.createBiquadFilter(); G.hi.type = "highshelf"; G.hi.frequency.value = 4500;
  G.filt = c.createBiquadFilter();
  G.gate = c.createGain();
  G.vol = c.createGain();
  G.master = c.createGain();
  G.limit = c.createDynamicsCompressor();
  G.limit.threshold.value = -10; G.limit.knee.value = 2; G.limit.ratio.value = 20; G.limit.attack.value = .001; G.limit.release.value = .1;
  G.post = c.createGain(); G.post.gain.value = 1.6; // laut machen …
  G.clip = c.createWaveShaper(); { const n = 4096, cv = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1, ax = Math.abs(x); cv[i] = Math.sign(x) * (ax <= .8 ? ax : .8 + .19 * Math.tanh((ax - .8) / .19)); } G.clip.curve = cv; } // … und Spitzen weich abfangen
  G.split = c.createChannelSplitter(2); G.anL = c.createAnalyser(); G.anR = c.createAnalyser(); G.anL.fftSize = G.anR.fftSize = 512;
  G.input.connect(G.low).connect(G.mid).connect(G.hi).connect(G.filt).connect(G.gate).connect(G.vol).connect(G.master);
  G.master.connect(G.limit).connect(G.post).connect(G.clip).connect(c.destination);
  G.clip.connect(G.split); G.split.connect(G.anL, 0); G.split.connect(G.anR, 1);
  // Beat-FX (Send nach dem Kanalfader, Ausklingen nach dem Ausschalten)
  G.send = c.createGain(); G.send.gain.value = 0; G.vol.connect(G.send);
  G.wet = c.createGain(); G.wet.connect(G.master);
  const d = c.createDelay(2); d.delayTime.value = .375; const fb = c.createGain(); fb.gain.value = .5;
  const ehp = c.createBiquadFilter(); ehp.type = "highpass"; ehp.frequency.value = 280; d.connect(ehp).connect(fb).connect(d);
  G.echo = { in: d, out: ehp };
  const cv = c.createConvolver(); cv.buffer = makeImpulse(c); G.reverb = { in: cv, out: cv };
  const fd = c.createDelay(.05); fd.delayTime.value = .004; const lfo = c.createOscillator(); lfo.frequency.value = .25;
  const lg = c.createGain(); lg.gain.value = .0032; lfo.connect(lg).connect(fd.delayTime); lfo.start();
  const ffb = c.createGain(); ffb.gain.value = .72; fd.connect(ffb).connect(fd); G.flanger = { in: fd, out: fd };
  ["echo", "reverb", "flanger"].forEach(k => G[k].out.connect(G.wet));
  const tl = c.createOscillator(); tl.type = "square"; tl.frequency.value = 8; G.transDepth = c.createGain(); G.transDepth.gain.value = 0;
  tl.connect(G.transDepth).connect(G.gate.gain); tl.start();
  // Sampler-Bus: eigene Sättigung, etwas Echo-Fahne, durch den Limiter
  G.sampler = c.createGain(); G.sampler.gain.value = 1; G.sampler.connect(G.master);
  G.sDelay = c.createDelay(1); G.sDelay.delayTime.value = .25; const sfb = c.createGain(); sfb.gain.value = .32;
  const slp = c.createBiquadFilter(); slp.type = "lowpass"; slp.frequency.value = 3200;
  G.sDelay.connect(slp).connect(sfb).connect(G.sDelay); G.sEcho = c.createGain(); G.sEcho.gain.value = .55; slp.connect(G.sEcho).connect(G.master);
  graph = G; routeFx(); applyMix(); return G;
}
function routeFx() {
  const G = graph; if (!G) return;
  try { G.send.disconnect(); } catch (e) {}
  if (G[MIX.fx]) G.send.connect(G[MIX.fx].in);
}
function applyMix() {
  const r = 1 + MIX.tempo / 100;
  audio.volume = Math.min(1, MIX.vol / 100); audio.playbackRate = r;
  const G = graph;
  if (G) {
    const t = G.c.currentTime, tc = .03;
    G.vol.gain.setTargetAtTime(Math.pow(MIX.vol / 100, 1.6) * 1.15, t, tc);
    const eq = v => v < 0 ? v / 100 * 32 : v / 100 * 9;
    G.low.gain.setTargetAtTime(eq(MIX.low), t, tc); G.mid.gain.setTargetAtTime(eq(MIX.mid), t, tc); G.hi.gain.setTargetAtTime(eq(MIX.hi), t, tc);
    const f = MIX.filter / 100, F = G.filt;
    if (Math.abs(f) < .04) { F.type = "lowpass"; F.frequency.setTargetAtTime(22000, t, tc); F.Q.value = .7; }
    else if (f < 0) { F.type = "lowpass"; F.frequency.setTargetAtTime(19000 * Math.pow(180 / 19000, -f), t, tc); F.Q.value = 9; }
    else { F.type = "highpass"; F.frequency.setTargetAtTime(25 * Math.pow(6000 / 25, f), t, tc); F.Q.value = 9; }
    const w = MIX.wet / 100, trans = MIX.fx === "trans";
    G.send.gain.setTargetAtTime(MIX.fxOn && !trans ? 1 : 0, t, .01);
    G.wet.gain.setTargetAtTime(w * 1.3, t, tc);
    G.transDepth.gain.setTargetAtTime(MIX.fxOn && trans ? w * .5 : 0, t, .005);
    G.gate.gain.setTargetAtTime(MIX.fxOn && trans ? 1 - w * .5 : 1, t, .005);
  }
  deck.setRate();
}
// Wellenform wie in Rekordbox: Höhe = Lautstärke, Farbe = Klang (rot = Bass, blau = Höhen)
function computeWave(b, bins = 900) {
  const d = b.getChannelData(0), step = Math.floor(d.length / bins), amp = new Float32Array(bins), hue = new Float32Array(bins);
  for (let i = 0; i < bins; i++) {
    let pk = 0, zc = 0, prev = 0;
    for (let j = i * step, e = j + step; j < e; j += 2) { const v = d[j]; const av = v < 0 ? -v : v; if (av > pk) pk = av; if ((v >= 0) !== (prev >= 0)) zc++; prev = v; }
    amp[i] = pk; hue[i] = Math.min(1, zc / (step / 2) * 9);
  }
  return { amp, hue, dur: b.duration };
}
function fakeWave(seed) {
  const r = seeded(String(seed)), bins = 900, amp = new Float32Array(bins), hue = new Float32Array(bins);
  for (let i = 0; i < bins; i++) { amp[i] = .25 + .6 * Math.abs(Math.sin(i / 7)) * r(); hue[i] = r(); }
  return { amp, hue, dur: PREVIEW, fake: true };
}
const decodeBuf = (c, ab) => new Promise((res, rej) => { const p = c.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); });
function reverseBuf(c, b) {
  const r = c.createBuffer(b.numberOfChannels, b.length, b.sampleRate);
  for (let ch = 0; ch < b.numberOfChannels; ch++) { const s = b.getChannelData(ch), d = r.getChannelData(ch); for (let i = 0, n = s.length; i < n; i++) d[i] = s[n - 1 - i]; }
  return r;
}
const BRAKE = 1.1;
const deck = {
  mode: "none", buf: null, rbuf: null, src: null, t0: 0, off: 0, playing: false, rate: 1, brake: null,
  dur() { return this.mode === "buf" ? this.buf.duration : (isFinite(audio.duration) ? audio.duration : PREVIEW); },
  time() {
    if (this.mode === "el") return audio.currentTime;
    if (!this.playing || !graph) return this.off;
    const e = graph.c.currentTime - this.t0;
    if (this.brake) { const k = Math.min(e, BRAKE); return this.off + this.rate * (k - k * k / (2 * BRAKE)); }
    return Math.min(this.dur(), this.off + e * this.rate);
  },
  async load(url) {
    this.stop(); this.mode = "none"; this.buf = null; audio.removeAttribute("src");
    const my = ++loadToken;
    try {
      const g = getGraph(); if (!g) throw 0;
      const r = await fetch(url, { mode: "cors" }); if (!r.ok) throw 0;
      const b = await decodeBuf(g.c, await r.arrayBuffer());
      if (my !== loadToken) return false;
      this.buf = b; this.rbuf = reverseBuf(g.c, b); this.mode = "buf"; this.off = 0; WAVE = computeWave(b);
    } catch (e) {
      if (my !== loadToken) return false;
      WAVE = fakeWave(url);
      this.mode = "el"; audio.src = url; try { audio.load(); } catch (e2) {}
    }
    applyMix(); renderMixer(); return true;
  },
  play() {
    this.brake = null;
    if (this.mode === "buf") {
      const g = getGraph(); this._kill();
      const s = g.c.createBufferSource(); s.buffer = this.buf; this.rate = 1 + MIX.tempo / 100; s.playbackRate.value = this.rate;
      s.connect(g.input); s.start(0, clamp(this.off, 0, this.dur() - .01)); this.t0 = g.c.currentTime; this.src = s; this.playing = true;
      s.onended = () => { if (this.src === s) { this.off = this.time(); this.playing = false; this.src = null; stop(); } };
      return Promise.resolve();
    }
    if (this.mode === "el") { audio.playbackRate = 1 + MIX.tempo / 100; this.playing = true; return audio.play() || Promise.resolve(); }
    return Promise.reject(new Error("kein Song"));
  },
  pause() {
    if (this.mode === "buf") { if (this.playing) this.off = this.time(); this._kill(); }
    else if (this.mode === "el") audio.pause();
    this.playing = false; this.brake = null;
  },
  _kill() { if (this.src) { const s = this.src; this.src = null; s.onended = null; try { s.stop(); } catch (e) {} s.disconnect(); } },
  seek(t) {
    t = clamp(t, 0, Math.max(0, this.dur() - .01));
    if (this.mode === "el") { if (audio.readyState >= 1) audio.currentTime = t; else if (P) P.seek = t; return; }
    const was = this.playing; this.pause(); this.off = t; if (was) this.play();
  },
  setRate() {
    const r = 1 + MIX.tempo / 100;
    if (this.mode === "buf" && this.playing && this.src && !this.brake) { this.off = this.time(); this.t0 = graph.c.currentTime; this.rate = r; this.src.playbackRate.setValueAtTime(r, graph.c.currentTime); }
    else if (!this.brake) this.rate = r;
  },
  stop() { this.pause(); this.off = 0; },
};
function rateNow() { if (!deck.playing) return 0; if (deck.brake) return Math.max(0, deck.rate * (1 - (performance.now() - deck.brake) / 1000 / BRAKE)); return deck.rate; }

/* ---------- Scratch ---------- */
const scr = { src: null, g: null, dir: 0, last: 0, noise: null, nf: null, ng: null };
function noiseInit() {
  const G = getGraph(); if (!G || scr.noise) return;
  const s = G.c.createBufferSource(); s.buffer = getNoise(G.c); s.loop = true;
  scr.nf = G.c.createBiquadFilter(); scr.nf.type = "bandpass"; scr.nf.Q.value = 2.5;
  scr.ng = G.c.createGain(); scr.ng.gain.value = 0;
  s.connect(scr.nf).connect(scr.ng).connect(G.vol); s.start(); scr.noise = s;
}
function scratchStart(force) {
  if (!S.scratch && !force) return; const G = getGraph(); if (!G) return;
  if (deck.mode === "buf") { scr.g = G.c.createGain(); scr.g.gain.value = 0; scr.g.connect(G.input); scr.dir = 0; }
  noiseInit(); scr.on = true;
}
function scratchMove(t, v) {
  if (!scr.on || !graph || !isFinite(v) || !isFinite(t)) return;
  const c = graph.c, now = c.currentTime, sp = Math.min(4, Math.abs(v));
  scr.last = performance.now();
  if (scr.ng) { scr.ng.gain.setTargetAtTime(deck.mode === "buf" ? Math.min(.06, sp * .025) : Math.min(.5, sp * .2), now, .012); scr.nf.frequency.setTargetAtTime(250 + sp * 1100, now, .015); }
  if (deck.mode !== "buf" || !scr.g) return;
  const dir = v >= 0 ? 1 : -1;
  if (dir !== scr.dir || !scr.src) {
    if (scr.src) { const o = scr.src; try { o.stop(now + .008); } catch (e) {} }
    const s = c.createBufferSource(); s.buffer = dir > 0 ? deck.buf : deck.rbuf; s.connect(scr.g);
    s.playbackRate.value = Math.max(.02, sp);
    s.start(0, clamp(dir > 0 ? t : deck.dur() - t, 0, deck.dur() - .01)); scr.src = s; scr.dir = dir;
  } else scr.src.playbackRate.setTargetAtTime(Math.max(.02, sp), now, .01);
  scr.g.gain.setTargetAtTime(sp < .04 ? 0 : Math.min(1.3, .45 + sp * .45), now, .008);
}
function scratchIdle() {
  if (!graph || !scr.on || performance.now() - scr.last < 60) return;
  const now = graph.c.currentTime;
  if (scr.g) scr.g.gain.setTargetAtTime(0, now, .015);
  if (scr.src) scr.src.playbackRate.setTargetAtTime(.02, now, .02);
  if (scr.ng) scr.ng.gain.setTargetAtTime(0, now, .02);
}
function scratchEnd() {
  scr.on = false; if (!graph) return; const now = graph.c.currentTime;
  if (scr.g) { scr.g.gain.setTargetAtTime(0, now, .01); const s = scr.src, g = scr.g; setTimeout(() => { try { s && s.stop(); } catch (e) {} g.disconnect(); }, 120); }
  if (scr.ng) scr.ng.gain.setTargetAtTime(0, now, .02);
  scr.src = null; scr.g = null; scr.dir = 0;
}

/* ---------- Sampler: laute Club-Sounds ---------- */
function env(g, t, a, peak, hold, rel) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(.0001, t + a + hold + rel); }
function osc(c, type, f, dest, t, len) { const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.connect(dest); o.start(t); o.stop(t + len); return o; }
function noiseSrc(c, dest, t, len) { const s = c.createBufferSource(); s.buffer = getNoise(c); s.loop = true; s.connect(dest); s.start(t); s.stop(t + len); return s; }
const SAMPLES = {
  horn() { // Reggae-Airhorn: da-da-da daaaa
    const G = getGraph(); if (!G) return; const c = G.c, T = c.currentTime + .01;
    const pre = c.createGain(); pre.gain.value = .35; const dr = makeDrive(c, 4);
    const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 220;
    const pk = c.createBiquadFilter(); pk.type = "peaking"; pk.frequency.value = 1800; pk.gain.value = 6;
    const post = c.createGain(); post.gain.value = .55;
    pre.connect(dr).connect(hp).connect(pk).connect(post).connect(G.sampler);
    [[0, .12], [.16, .12], [.32, .12], [.48, .9]].forEach(([d, len], i) => {
      const g = c.createGain(); g.connect(pre); env(g, T + d, .012, 1, len - .05, .09);
      [1, 1.007, .993, 1.498, 2.004].forEach(m => {
        const o = osc(c, "sawtooth", 466 * m * .9, g, T + d, len + .15);
        o.frequency.exponentialRampToValueAtTime(466 * m, T + d + .035);
        if (i === 3) o.frequency.setTargetAtTime(466 * m * .86, T + d + len - .2, .1);
      });
    });
  },
  siren() { // Dub-Siren mit Echo
    const G = getGraph(); if (!G) return; const c = G.c, T = c.currentTime + .01, L = 2.4;
    const g = c.createGain(); env(g, T, .02, .32, L - .3, .3);
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3200; g.connect(lp).connect(G.sampler);
    const e = c.createGain(); e.gain.value = .5; lp.connect(e).connect(G.sDelay);
    const o = osc(c, "square", 520, g, T, L);
    o.frequency.linearRampToValueAtTime(980, T + L);
    const l = c.createOscillator(); l.frequency.setValueAtTime(3, T); l.frequency.linearRampToValueAtTime(9, T + L);
    const lg = c.createGain(); lg.gain.value = 260; l.connect(lg).connect(o.frequency); l.start(T); l.stop(T + L);
  },
  laser() { // pew pew pew
    const G = getGraph(); if (!G) return; const c = G.c, T = c.currentTime + .01;
    const dr = makeDrive(c, 4), out = c.createGain(); out.gain.value = .6; dr.connect(out).connect(G.sampler);
    const e = c.createGain(); e.gain.value = .35; out.connect(e).connect(G.sDelay);
    [0, .14, .28, .42].forEach((d, i) => {
      const g = c.createGain(); g.connect(dr); env(g, T + d, .004, .9, .02, .2);
      const o = osc(c, i % 2 ? "sawtooth" : "square", 3200 - i * 300, g, T + d, .3);
      o.frequency.exponentialRampToValueAtTime(90, T + d + .24);
    });
  },
  drop() { // Bass-Drop mit Impact
    const G = getGraph(); if (!G) return; const c = G.c, T = c.currentTime + .01;
    const dr = makeDrive(c, 3.5), out = c.createGain(); out.gain.value = 1; dr.connect(out).connect(G.sampler);
    const g = c.createGain(); g.connect(dr); env(g, T, .005, 1, .25, 2.3);
    const o = osc(c, "sine", 170, g, T, 2.8); o.frequency.exponentialRampToValueAtTime(34, T + 1.6);
    const o2 = osc(c, "triangle", 85, g, T, 2.8); o2.frequency.exponentialRampToValueAtTime(30, T + 1.6);
    const nf = c.createBiquadFilter(); nf.type = "lowpass"; nf.frequency.setValueAtTime(6000, T); nf.frequency.exponentialRampToValueAtTime(120, T + .6);
    const ng = c.createGain(); env(ng, T, .002, .6, .02, .45); nf.connect(ng).connect(G.sampler); noiseSrc(c, nf, T, .9);
    const rv = c.createGain(); rv.gain.value = .18; ng.connect(rv).connect(G.reverb.in); G.reverb.out.connect(G.master);
    setTimeout(() => { try { G.reverb.out.disconnect(G.master); } catch (e) {} G.reverb.out.connect(G.wet); }, 3500);
  },
  riser() { // Build-up: Rauschen und Synth steigen, Song wird mitgefiltert
    const G = getGraph(); if (!G) return; const c = G.c, T = c.currentTime + .01, L = 3.2;
    const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 3; bp.frequency.setValueAtTime(300, T); bp.frequency.exponentialRampToValueAtTime(9000, T + L);
    const ng = c.createGain(); ng.gain.setValueAtTime(.02, T); ng.gain.exponentialRampToValueAtTime(.9, T + L); ng.gain.setValueAtTime(.0001, T + L + .02);
    bp.connect(ng).connect(G.sampler); noiseSrc(c, bp, T, L + .05);
    const sg = c.createGain(); sg.gain.setValueAtTime(.02, T); sg.gain.exponentialRampToValueAtTime(.25, T + L); sg.gain.setValueAtTime(.0001, T + L + .02); sg.connect(G.sampler);
    [1, 1.01].forEach(m => { const o = osc(c, "sawtooth", 110 * m, sg, T, L + .05); o.frequency.exponentialRampToValueAtTime(1320 * m, T + L); });
    const F = G.filt; F.type = "highpass"; F.Q.value = 6; F.frequency.cancelScheduledValues(T); F.frequency.setValueAtTime(30, T); F.frequency.exponentialRampToValueAtTime(2200, T + L);
    setTimeout(() => { applyMix(); SAMPLES.drop(); }, L * 1000);
  },
  scratch() { autoScratch(); },
  rewind() { rewind(); },
  brake() { brake(); },
};
function autoScratch() {
  if (!P || !P.ready || P.spinning) return;
  const pos = deck.time(), was = deck.playing; deck.pause(); scratchStart(true);
  const strokes = [1, -1, 1, -1, 1, 1, -1, -1, 1, -1], len = .11, t0 = performance.now(), r0 = P.rot;
  let p = pos; P.spinning = true; let last = t0;
  (function f(now) {
    const e = Math.max(0, now - t0) / 1000, i = Math.floor(e / len);
    if (i >= strokes.length) { scratchEnd(); P.spinning = false; P.rot = r0; deck.seek(pos); if (was) startPlay(); return; }
    const ph = (e % len) / len, v = strokes[i] * 2.6 * Math.sin(Math.PI * ph);
    const dt = Math.max(0, now - last) / 1000; last = Math.max(last, now); p = clamp(p + v * dt, 0, deck.dur() - .05);
    scratchMove(p, v); P.rot += v * dt * DPS; setRing(p);
    requestAnimationFrame(f);
  })(t0);
}
function rewind() {
  if (!P || !P.ready || P.spinning) return;
  const t = deck.time(); if (t < .3) { deck.seek(0); return; }
  deck.pause(); scratchStart(true);
  const dur = Math.min(1, .35 + t * .05), v = -t / dur, t0 = performance.now(), r0 = P.rot;
  P.spinning = true;
  (function f(now) {
    const k = clamp((now - t0) / 1000 / dur, 0, 1), pos = t * (1 - k);
    P.rot = r0 - t * DPS * k; setRing(pos);
    if (k < 1) { scratchMove(pos, v); requestAnimationFrame(f); }
    else { scratchEnd(); P.spinning = false; deck.seek(0); startPlay(); }
  })(t0);
}
function brake() {
  if (!deck.playing) return;
  if (deck.mode === "buf" && deck.src) {
    deck.off = deck.time(); deck.t0 = graph.c.currentTime;
    const p = deck.src.playbackRate; p.cancelScheduledValues(deck.t0); p.setValueAtTime(deck.rate, deck.t0); p.linearRampToValueAtTime(.001, deck.t0 + BRAKE);
  }
  deck.brake = performance.now();
  setTimeout(() => { if (deck.brake) { const off = deck.time(); deck.pause(); deck.off = off; if (deck.mode === "el") audio.playbackRate = 1 + MIX.tempo / 100; stop(); } }, BRAKE * 1000);
}

/* ============================ Runde ============================ */
let R = null, P = null, playing = false, dragging = false, lastTs = 0;

function startRound(o) {
  getGraph();
  // Gerade gespielte Songs kommen erst wieder, wenn alle anderen dran waren
  const seenKey = "mq-seen-" + o.genre.id, sk = s => s[0] + "|" + s[1];
  let seen = new Set(store.get(seenKey, []));
  const fresh = o.songs.filter(s => !seen.has(sk(s)));
  if (!o.keepOrder && fresh.length < Math.min(S.count, o.songs.length)) { seen = new Set(); store.set(seenKey, []); }
  const pool = o.keepOrder ? o.songs.slice() : [...shuffle(o.songs.filter(s => !seen.has(sk(s)))), ...shuffle(o.songs.filter(s => seen.has(sk(s))))];
  const n = o.daily ? 5 : o.mode === "sudden" ? pool.length : Math.min(S.count, pool.length);
  const pl = o.mode === "party" ? players.map((p, i) => ({ name: p.trim() || "Spieler " + (i + 1), score: 0 })) : [{ name: S.name.trim() || "Du", score: 0 }];
  R = { genre: o.genre, mode: o.mode, daily: !!o.daily, practice: !!o.practice, items: pool.splice(0, n).map(s => ({ song: s })), pool, idx: 0,
    players: pl, results: [], streak: 0, over: false, allowed: o.allowed || null, choice: o.mode === "choice" || S.answer === "choice",
    listen: o.daily ? 30 : S.listen, cover: o.mode === "intro" ? 0 : (o.daily ? 20 : S.cover), hints: o.daily ? true : S.hints };
  setDiscColors($("#stage"), o.genre);
  $("#score").textContent = "0";
  $("#playerChip").classList.toggle("hide", R.mode !== "party");
  $("#lives").classList.toggle("hide", R.mode !== "sudden");
  $("#blitzBar").classList.toggle("hide", R.mode !== "blitz");
  $("#hintBtn").classList.toggle("hide", !R.hints);
  $("#mixer").classList.toggle("hide", !S.mixer);
  resetMixer(); setTimeout(sizeWave, 50);
  show("game");
  loadSong();
}
const curPlayer = () => R.players[R.mode === "party" ? R.idx % R.players.length : 0];
const limit = () => R.mode === "intro" ? INTRO_STAGES[P.stage] : R.listen;

function renderTop() {
  if (R.mode === "sudden") { $("#dots").className = "dots endless"; $("#dots").textContent = `Song ${R.idx + 1}`; }
  else { $("#dots").className = "dots"; $("#dots").innerHTML = R.items.map((r, i) => `<i class="${i < R.results.length ? R.results[i].cls : i === R.idx ? "now" : ""}"></i>`).join(""); }
  const pl = curPlayer();
  $("#score").textContent = R.mode === "party" ? pl.score : R.players[0].score;
  $("#playerChip").textContent = pl.name + " ist dran";
  $("#lives").textContent = "♥ Ein Leben";
  $("#streak").textContent = R.mode !== "party" && R.streak >= 2 ? `${R.streak}er-Serie${R.streak >= 3 ? " · +1 pro Song" : ""}` : "";
}

async function loadSong() {
  stop(); deck.stop(); loadToken++; resetMixer(); WAVE = null;
  P = { refs: [], slot: null, mc: null, struck: [], hints: [], played: 0, coverShown: false, stage: 0, blitzStart: null, seek: 0, rot: 0, dz: null, done: false, ready: false };
  $("#coverWrap").className = "cover"; $("#cover").style.backgroundImage = ""; $("#cover").style.filter = "";
  $("#guess").classList.remove("hide"); $("#reveal").classList.add("hide");
  $("#gTitle").value = ""; $("#gArtist").value = ""; $("#gYear").value = ""; $("#mcTitle").innerHTML = ""; $("#mcArtist").innerHTML = "";
  $("#typeFields").classList.toggle("hide", R.choice); $("#choiceFields").classList.toggle("hide", !R.choice); $("#usedHints").innerHTML = ""; $("#years").innerHTML = "";
  $("#hintBtn").disabled = false;
  $("#more").classList.toggle("hide", R.mode !== "intro"); $("#more").disabled = false; $("#more").innerHTML = `Länger hören <em>−1</em>`;
  $("#blitzFill").style.transform = "scaleX(1)";
  setRing(0);
  renderTop();
  const handoff = R.mode === "party" && R.players.length > 1;
  if (handoff) { $("#handName").textContent = curPlayer().name; $("#handoff").classList.remove("hide"); }
  $("#status").textContent = "Song wird gesucht …";
  let dz = null; const myP = P;
  while (!dz && R.idx < R.items.length) {
    const s = R.items[R.idx].song, pr = await prepare(s);
    if (myP !== P) return;
    if (pr && (!R.allowed || R.allowed.has(groupOf(R.genre, [s[0], s[1], pr.years])))) { dz = pr.dz; R.items[R.idx].song = [s[0], s[1], pr.years, pr.dz]; break; }
    const spare = R.pool.shift(); if (spare) R.items[R.idx] = { song: spare }; else R.items.splice(R.idx, 1);
  }
  if (!dz) { $("#status").textContent = "Deezer ist gerade nicht erreichbar. Prüfe die Internetverbindung und starte die Runde neu."; return; }
  const it = R.items[R.idx]; P.dz = dz;
  P.refs = makeRefs(it.song[2]); renderYears();
  if (R.choice) { P.mc = { title: mcOptions(it.song[1], 1, false), artist: mcOptions(it.song[0], 0, true), tPick: null, aPick: null, tStruck: [], aStruck: [] }; renderMC(); }
  if (dz.cover) $("#cover").style.backgroundImage = `url("${dz.cover}")`;
  $("#status").textContent = "Song wird geladen …";
  const ok = await deck.load(dz.preview);
  if (!ok || myP !== P) return;
  P.ready = true;
  if (!R.daily && !R.genre.live) { const k = "mq-seen-" + R.genre.id, l = store.get(k, []); l.push(it.song[0] + "|" + it.song[1]); store.set(k, l.slice(-400)); }
  renderTop(); setRing(0);
  [1, 2].forEach(d => { const nx = R.items[R.idx + d]; if (nx) prepare(nx.song); });
  if (S.autoplay && !(handoff && !$("#handoff").classList.contains("hide"))) startPlay();
  else $("#status").textContent = "Tippe auf Start. Zum Spulen die Platte drehen.";
}
$("#handGo").onclick = () => { SFX.tap(); getGraph(); $("#handoff").classList.add("hide"); if (S.autoplay && P && P.ready && !playing) startPlay(); };

/* ---------- Abspielen, Ring & Scrubbing ---------- */
function setIcon(p) { $("#stage").classList.toggle("playing", p); setRing(P && P.ready ? deck.time() : 0);
  $("#ico").innerHTML = p ? '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>' : '<path d="M8 5v14l11-7z"/>'; }
function stop() { deck.pause(); playing = false; setIcon(false); }
function setRing(t) {
  $("#ring").style.width = clamp(t, 0, PREVIEW) / PREVIEW * 100 + "%";
  const lim = P && !P.done ? limit() : PREVIEW;
  $("#ringLim").style.width = lim / PREVIEW * 100 + "%";
  const arm = playing || dragging ? 30 + 14 * clamp(t / PREVIEW, 0, 1) : 0; $("#stage").style.setProperty("--arm", arm + "deg");
  $("#tNow").textContent = fmt(t); $("#tMax").textContent = fmt(lim);
}
function startPlay() {
  if (!P || !P.ready) { $("#status").textContent = "Der Song lädt noch …"; return; }
  if (deck.time() >= limit() - .05 && !P.done) deck.seek(0);
  playing = true; setIcon(true); lastTs = performance.now();
  if (R.mode === "blitz" && !P.blitzStart && !P.done) P.blitzStart = performance.now();
  $("#status").textContent = "";
  deck.play().then(() => { if (deck.mode === "el" && P.seek && Math.abs(audio.currentTime - P.seek) > .3) audio.currentTime = P.seek; P.seek = 0; })
    .catch(() => { stop(); $("#status").textContent = "Tippe auf Play, um zu starten."; });
}
$("#play").onclick = () => { getGraph(); if (playing) stop(); else startPlay(); };
audio.addEventListener("ended", stop);

const stage = $("#stage"); let aPrev = 0, want = 0, tickAcc = 0, moveT = 0, wasPlaying = false;
const angleAt = e => { const r = $("#disc").getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI; };
stage.addEventListener("pointerdown", e => {
  if (!e.target.closest("#disc") || !P || !P.ready || P.spinning) return;
  getGraph();
  dragging = true; stage.classList.add("drag"); stage.setPointerCapture(e.pointerId);
  wasPlaying = playing; want = deck.time(); deck.pause();
  aPrev = angleAt(e); tickAcc = 0; moveT = performance.now();
  scratchStart();
});
stage.addEventListener("pointermove", e => {
  if (!dragging) return;
  const now = performance.now(), a = angleAt(e); let d = a - aPrev; if (d > 180) d -= 360; if (d < -180) d += 360; aPrev = a;
  const lim = P.done ? PREVIEW : limit(), before = want;
  want = clamp(want + d / DPS, 0, lim - .05);
  const dtR = Math.max(.008, (now - moveT) / 1000); moveT = now;
  scratchMove(want, (want - before) / dtR);
  P.rot += d;
  if (!S.scratch) { tickAcc += Math.abs(d); if (tickAcc > 24) { tickAcc = 0; SFX.tick(); } }
  if (deck.mode === "el") { if (audio.readyState >= 1) audio.currentTime = want; else P.seek = want; }
  setRing(want);
});
const endDrag = () => {
  if (!dragging) return; dragging = false; stage.classList.remove("drag");
  scratchEnd(); deck.seek(want);
  const lim = P.done ? PREVIEW : limit();
  if (wasPlaying && want < lim - .1) startPlay(); else { playing = false; setIcon(false); }
};
stage.addEventListener("pointerup", endDrag); stage.addEventListener("pointercancel", endDrag);

(function loop(now) {
  if (R && P && $("#game").offsetParent !== null) {
    const dt = (now - lastTs) / 1000; lastTs = now;
    if (dragging) scratchIdle();
    else if (playing && !P.spinning) {
      const r = rateNow();
      P.played += dt * Math.min(1, r); P.rot += dt * 200 * r; // 33⅓ U/min
      if (deck.mode === "el" && deck.brake) audio.playbackRate = Math.max(.1, r);
      const t = deck.time();
      if (!P.done && t >= limit()) { stop(); deck.seek(limit()); if (R.mode === "intro" && P.stage < INTRO_STAGES.length - 1) $("#status").textContent = "Noch keine Ahnung? Hör etwas länger."; }
      setRing(Math.min(t, P.done ? PREVIEW : limit()));
    }
    $("#disc").style.transform = `rotate(${P.rot}deg)`;
    stage.classList.toggle("playing", playing);
    stage.style.setProperty("--pitch", .5 - MIX.tempo / 32);
    if (R.cover && !P.coverShown && !P.done && P.played >= R.cover && P.dz && P.dz.cover) showCover(false);
    if (R.mode === "blitz" && P.blitzStart && !P.done) {
      const left = BLITZ_SEC - (now - P.blitzStart) / 1000;
      $("#blitzFill").style.transform = `scaleX(${clamp(left / BLITZ_SEC, 0, 1)})`;
      if (left <= 0) submit(true);
    }
  } else lastTs = now;
  requestAnimationFrame(loop);
})(performance.now());

function showCover(paid) {
  P.coverShown = true;
  $("#cover").style.filter = paid ? "none" : "blur(14px) saturate(1.2)"; $("#coverWrap").classList.add("on");
  if (!paid) { toast("Cover-Hinweis aufgedeckt"); SFX.hint(); }
}

/* ---------- DJ-Mixer: Bedienung ---------- */
const KNOBS = { hi: [-100, 100, 0], mid: [-100, 100, 0], low: [-100, 100, 0], filter: [-100, 100, 0], wet: [0, 100, 55] };
const FADERS = { vol: [0, 100, 85], tempo: [-16, 16, 0] };
const PADS = [["horn", "Horn"], ["siren", "Siren"], ["laser", "Laser"], ["drop", "Drop"], ["riser", "Riser"], ["scratch", "Scratch"], ["rewind", "Rewind"], ["brake", "Brake"]];
const FXS = [["echo", "Echo"], ["reverb", "Reverb"], ["flanger", "Flanger"], ["trans", "Trans"]];
let lcdUntil = 0, lcdMsg = "";
const lcd = m => { lcdMsg = m; lcdUntil = performance.now() + 1500; };
const fmtVal = k => {
  const v = MIX[k];
  if (k === "hi" || k === "mid" || k === "low") return k.toUpperCase() + " " + (v <= -97 ? "KILL" : (v === 0 ? "0" : (v > 0 ? "+" : "") + (v < 0 ? v / 100 * 32 : v / 100 * 9).toFixed(1)) + " dB");
  if (k === "filter") { if (Math.abs(v) < 4) return "FILTER OFF"; const f = v < 0 ? 19000 * Math.pow(180 / 19000, -v / 100) : 25 * Math.pow(6000 / 25, v / 100); return (v < 0 ? "LPF " : "HPF ") + (f >= 1000 ? (f / 1000).toFixed(1) + "k" : Math.round(f)) + " Hz"; }
  if (k === "wet") return "FX LEVEL " + v + "%";
  if (k === "vol") return "CH VOL " + v;
  if (k === "tempo") return "TEMPO " + (v > 0 ? "+" : "") + v.toFixed(1) + "%";
  return "";
};
function buildMixer() {
  const knob = (k, l, cls = "") => `<div class="knob ${cls}" data-k="${k}"><div class="kring"></div><div class="kcap"><i></i></div><span>${l}</span></div>`;
  const leds = n => Array.from({ length: n }, (_, i) => `<i class="${i >= n - 2 ? "lr" : i >= n - 5 ? "ly" : "lg"}"></i>`).join("");
  $("#mixer").innerHTML = `
    <div class="mx-screen">
      <canvas id="wave"></canvas><canvas id="wavemini"></canvas>
      <div class="mx-ov"><span id="lcd"></span><span id="lcdR"></span></div>
    </div>
    <div class="mx-body">
      <div class="mx-eq eqfx">${knob("hi", "Hi")}${knob("mid", "Mid")}${knob("low", "Low")}${knob("filter", "Filter", "color")}</div>
      <div class="mx-ch">
        <div class="vu" id="vu"><div>${leds(15)}</div><div>${leds(15)}</div></div>
        <div class="fader" data-k="vol"><div class="slot"></div><div class="cap"></div><span>Vol</span></div>
        <div class="fader tempo" data-k="tempo"><div class="slot"></div><div class="cap"></div><span>Tempo</span></div>
      </div>
      <div class="mx-fx eqfx">
        <span class="mx-lbl">Beat FX</span>
        <div class="fxsel">${FXS.map(([k, l]) => `<button data-fx="${k}">${l}</button>`).join("")}</div>
        <div class="fx-row">${knob("wet", "Level", "small")}<button class="fxon" id="fxOn">On</button></div>
      </div>
    </div>
    <div class="pads">${PADS.map(([k, l]) => `<button class="pad pad-${k}" data-pad="${k}"><b>${l}</b></button>`).join("")}</div>`;
  sizeWave(); renderMixer();
}
function sizeWave() { ["#wave", "#wavemini"].forEach(s => { const c = $(s); if (!c) return; const r = c.getBoundingClientRect(); c.width = Math.max(1, r.width * devicePixelRatio); c.height = Math.max(1, r.height * devicePixelRatio); }); }
addEventListener("resize", sizeWave);
const waveCol = (h, a) => { const r = Math.round(255 * (1 - h) + 40 * h), g = Math.round(90 + 120 * Math.sin(h * Math.PI)), b = Math.round(60 + 195 * h); return `rgba(${r},${g},${b},${a})`; };
function drawWave() {
  const c = $("#wave"), m = $("#wavemini"); if (!c || !c.width) return;
  const x = c.getContext("2d"), W = c.width, H = c.height, dpr = devicePixelRatio;
  x.clearRect(0, 0, W, H);
  const t = P && P.ready ? deck.time() : 0, lim = P && !P.done ? limit() : PREVIEW;
  if (WAVE) {
    const n = WAVE.amp.length, sec = 7, pps = W / sec, bw = Math.max(1, W / (sec * n / WAVE.dur));
    for (let i = 0; i < n; i++) {
      const ts = i / n * WAVE.dur, px = W / 2 + (ts - t) * pps; if (px < -bw || px > W + bw) continue;
      const a = WAVE.amp[i] * (WAVE.fake ? .8 : 1), hh = Math.max(dpr, a * H * .46), past = ts < t, locked = ts > lim;
      x.fillStyle = waveCol(WAVE.hue[i], locked ? .18 : past ? .55 : 1);
      x.fillRect(px, H / 2 - hh, bw + .5, hh * 2);
    }
  }
  x.fillStyle = "#fff"; x.fillRect(W / 2 - dpr, 0, 2 * dpr, H);
  x.fillStyle = "#ff3d5a"; x.beginPath(); x.moveTo(W / 2 - 5 * dpr, 0); x.lineTo(W / 2 + 5 * dpr, 0); x.lineTo(W / 2, 6 * dpr); x.fill();
  if (!m || !m.width) return;
  const y = m.getContext("2d"), w = m.width, h = m.height; y.clearRect(0, 0, w, h);
  if (WAVE) { const n = WAVE.amp.length; for (let i = 0; i < n; i += 2) { const px = i / n * w, ts = i / n * WAVE.dur, a = WAVE.amp[i] * h * .9; y.fillStyle = waveCol(WAVE.hue[i], ts > lim ? .15 : ts < t ? .9 : .45); y.fillRect(px, h - a, w / n * 2 + .5, a); } }
  y.fillStyle = "#fff"; y.fillRect(t / PREVIEW * w, 0, 1.5 * dpr, h);
}
function renderMixer() {
  if (!$("#lcd")) return;
  $$("#mixer .knob").forEach(el => {
    const k = el.dataset.k, [mn, mx] = KNOBS[k], v = MIX[k], a = -135 + (v - mn) / (mx - mn) * 270;
    el.querySelector(".kcap").style.transform = `rotate(${a}deg)`;
    const from = mn < 0 ? Math.min(0, a) : -135, span = Math.max(1.5, (mn < 0 ? Math.max(0, a) : a) - from);
    el.querySelector(".kring").style.background = `conic-gradient(from ${from}deg, var(--led) 0deg ${span}deg, transparent ${span}deg), conic-gradient(from -135deg, #ffffff16 0deg 270deg, transparent 270deg)`;
  });
  $$("#mixer .fader").forEach(el => { const k = el.dataset.k, [mn, mx] = FADERS[k]; el.querySelector(".cap").style.setProperty("--p", `calc((100% - 1.65rem) * ${1 - (MIX[k] - mn) / (mx - mn)})`); });
  $$("#mixer [data-fx]").forEach(b => { b.classList.toggle("on", b.dataset.fx === MIX.fx); b.classList.toggle("live", b.dataset.fx === MIX.fx && MIX.fxOn); });
  $$("#mixer .knob").forEach(el => el.classList.toggle("moved", MIX[el.dataset.k] !== KNOBS[el.dataset.k][2]));
  $("#fxOn").classList.toggle("on", MIX.fxOn);
  $("#mixer").classList.toggle("lite", deck.mode === "el");
}
function setMix(k, v) { MIX[k] = v; applyMix(); renderMixer(); lcd(fmtVal(k)); }
function resetMixer() { Object.assign(MIX, MIX_DEFAULT); if (graph) { routeFx(); } applyMix(); renderMixer(); }

// Drehregler & Fader: ziehen, Doppeltipp setzt zurück
let ctl = null, lastTap = { k: null, t: 0 };
$("#mixer").addEventListener("pointerdown", e => {
  const el = e.target.closest(".knob,.fader"); if (!el) return;
  e.preventDefault(); getGraph();
  const k = el.dataset.k, isK = el.classList.contains("knob"), [mn, mx, def] = (isK ? KNOBS : FADERS)[k];
  const now = performance.now();
  if (lastTap.k === k && now - lastTap.t < 320) { setMix(k, def); lastTap.k = null; return; }
  lastTap = { k, t: now };
  el.setPointerCapture(e.pointerId);
  ctl = { el, k, isK, mn, mx, y0: e.clientY, v0: MIX[k] };
  if (!isK) { const r = el.querySelector(".slot").getBoundingClientRect(); setMix(k, snap(k, mn + (1 - clamp((e.clientY - r.top) / r.height, 0, 1)) * (mx - mn))); }
});
const snap = (k, v) => k === "tempo" ? (Math.abs(v) < .6 ? 0 : Math.round(v * 10) / 10) : k === "filter" ? (Math.abs(v) < 5 ? 0 : Math.round(v)) : Math.round(v);
$("#mixer").addEventListener("pointermove", e => {
  if (!ctl) return;
  if (ctl.isK) setMix(ctl.k, snap(ctl.k, clamp(ctl.v0 + (ctl.y0 - e.clientY) / 160 * (ctl.mx - ctl.mn), ctl.mn, ctl.mx)));
  else { const r = ctl.el.querySelector(".slot").getBoundingClientRect(); setMix(ctl.k, snap(ctl.k, ctl.mn + (1 - clamp((e.clientY - r.top) / r.height, 0, 1)) * (ctl.mx - ctl.mn))); }
});
["pointerup", "pointercancel"].forEach(ev => $("#mixer").addEventListener(ev, () => { ctl = null; }));
$("#mixer").addEventListener("click", e => {
  const fx = e.target.closest("[data-fx]");
  if (fx) { getGraph(); const same = MIX.fx === fx.dataset.fx; MIX.fx = fx.dataset.fx; MIX.fxOn = same ? !MIX.fxOn : true; routeFx(); applyMix(); renderMixer(); lcd(MIX.fx.toUpperCase() + (MIX.fxOn ? " ON" : " OFF")); return; }
  if (e.target.closest("#fxOn")) { getGraph(); MIX.fxOn = !MIX.fxOn; routeFx(); applyMix(); renderMixer(); lcd(MIX.fx.toUpperCase() + (MIX.fxOn ? " ON" : " OFF")); return; }
  const p = e.target.closest("[data-pad]"); if (!p) return;
  getGraph(); p.classList.remove("hit"); void p.offsetWidth; p.classList.add("hit");
  lcd(p.textContent.trim().toUpperCase() + "!"); SAMPLES[p.dataset.pad]();
});

// VU-Meter & Display
const vuBuf = new Float32Array(512); let vuPeak = [0, 0];
(function vuLoop() {
  requestAnimationFrame(vuLoop);
  const m = $("#mixer"); if (!m || !R || m.offsetParent === null) return;
  const lv = [0, 0];
  if (graph) [graph.anL, graph.anR].forEach((an, i) => {
    an.getFloatTimeDomainData(vuBuf); let s = 0; for (let j = 0; j < vuBuf.length; j++) s += vuBuf[j] * vuBuf[j];
    const db = 20 * Math.log10(Math.sqrt(s / vuBuf.length) + 1e-6); lv[i] = clamp((db + 42) / 42, 0, 1);
  });
  if (deck.mode === "el" && deck.playing) { const f = .55 + Math.random() * .25; lv[0] = Math.max(lv[0], f * MIX.vol / 100); lv[1] = Math.max(lv[1], (f + (Math.random() - .5) * .08) * MIX.vol / 100); }
  $$("#vu > div").forEach((col, i) => {
    vuPeak[i] = Math.max(lv[i], vuPeak[i] - .012);
    const n = Math.round(lv[i] * 14), pk = Math.round(vuPeak[i] * 14) - 1;
    [...col.children].forEach((led, j) => led.classList.toggle("on", j < n || j === pk));
  });
  const el = $("#lcd"), t = P && P.ready ? deck.time() : 0;
  el.textContent = performance.now() < lcdUntil ? lcdMsg : deck.mode === "el" ? "LITE-MODUS · EQ & FX AUS" : MIX.fxOn ? MIX.fx.toUpperCase() + " ON" : "DECK A";
  $("#lcdR").textContent = `${fmt(t)}  ${MIX.tempo >= 0 ? "+" : ""}${MIX.tempo.toFixed(1)}%`;
  drawWave();
})();
buildMixer();

/* ---------- Jahr: auf dem Zeitstrahl einordnen ---------- */
// Drei Jahreszahlen als Orientierung; der Song liegt davor, dazwischen oder danach.
function makeRefs(years) {
  const y = years[Math.random() * years.length | 0], bad = r => years.includes(r) || r > THIS_YEAR || r < 1950;
  const gap = () => S.yearLevel === "leicht" ? 4 + (Math.random() * 5 | 0) : S.yearLevel === "schwer" ? 1 + (Math.random() * 2 | 0) : 2 + (Math.random() * 4 | 0);
  for (let tries = 0; tries < 60; tries++) {
    const k = Math.random() * 4 | 0, a = gap(), b = gap(), c = gap(); let r;
    if (k === 0) r = [y + a, y + a + b, y + a + b + c];
    else if (k === 1) r = [y - a, y + b, y + b + c];
    else if (k === 2) r = [y - a - c, y - a, y + b];
    else r = [y - a - b - c, y - a - b, y - a];
    if (!r.some(bad) && !years.some(v => r.includes(v))) return r;
  }
  return [y - 6, y - 2, y + 3].map(r => Math.min(r, THIS_YEAR));
}
const slotOf = (refs, y) => y < refs[0] ? 0 : y < refs[1] ? 1 : y < refs[2] ? 2 : 3;
const slotOk = (refs, slot, years) => years.some(y => !refs.includes(y) && slotOf(refs, y) === slot);
const slotName = (r, i) => i === 0 ? `vor ${r[0]}` : i === 3 ? `nach ${r[2]}` : `${r[i - 1]}–${r[i]}`;
function renderYears() {
  const r = P.refs;
  $("#years").innerHTML = [0, 1, 2, 3].map(i => `<button type="button" class="slot${P.slot === i ? " on" : ""}${P.struck.includes(i) ? " out" : ""}" data-s="${i}">${i === 0 ? "davor" : i === 3 ? "danach" : "zwischen"}</button>`).join("")
    + r.map((y, i) => `<span class="tick" style="left:${(i + 1) * 25}%">${y}</span>`).join("");
}
$("#years").onclick = e => { const b = e.target.closest(".slot"); if (!b) return; SFX.tap(); const s = +b.dataset.s; P.slot = P.slot === s ? null : s; renderYears(); };
$("#gYear").oninput = e => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); e.target.value = v; if (v.length === 4 && P && P.refs.length) { const y = +v; if (!P.refs.includes(y)) { P.slot = slotOf(P.refs, y); renderYears(); } } };

/* ---------- Multiple Choice ---------- */
function mcOptions(correct, field, isArtist, n = 4) {
  const src = [...R.items.map(i => i.song), ...R.pool, ...(R.genre.songs || []), ...(R.genre._extra || [])];
  const seen = new Set([norm(correct)]), out = [];
  shuffle(src.map(s => s[field])).forEach(v => {
    if (out.length >= n - 1 || !v) return; const k = norm(v);
    if (seen.has(k) || matches(v, correct, isArtist, "normal") || matches(correct, v, isArtist, "normal")) return;
    seen.add(k); out.push(v);
  });
  return shuffle([correct, ...out]);
}
function renderMC() {
  const m = P.mc; if (!m) return;
  const btn = (v, pick, struck, f) => `<button type="button" class="mco${pick === v ? " on" : ""}${struck.includes(v) ? " out" : ""}" data-f="${f}" data-v="${esc(v)}">${esc(v)}</button>`;
  $("#mcTitle").innerHTML = m.title.map(v => btn(v, m.tPick, m.tStruck, "t")).join("");
  $("#mcArtist").innerHTML = m.artist.map(v => btn(v, m.aPick, m.aStruck, "a")).join("");
}
$("#choiceFields").onclick = e => { const b = e.target.closest(".mco"); if (!b || !P.mc) return; SFX.tap(); const k = b.dataset.f === "t" ? "tPick" : "aPick"; P.mc[k] = P.mc[k] === b.dataset.v ? null : b.dataset.v; renderMC(); };

/* ---------- Tipps ---------- */
const ICONS = {
  artist: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  title: '<path d="M5 6h14M12 6v13M9 19h6"/>',
  year: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  cover: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
};
const mask = s => s.replace(/\(.*?\)/g, "").trim().split(/\s+/).map(w => w.replace(/^([^\p{L}\p{N}]*)(.)(.*)$/u, (m, p, f, r) => p + f + r.replace(/[\p{L}\p{N}]/gu, "_"))).join("  ");
const HINTS = [
  { id: "artist", name: "Interpret anspielen", desc: () => R.choice ? "Zwei falsche Interpreten fliegen raus" : "Anfangsbuchstaben und Länge des Namens",
    run: s => R.choice ? (P.mc.aStruck = shuffle(P.mc.artist.filter(v => v !== s[0] && v !== P.mc.aPick)).slice(0, 2), renderMC(), { k: "Interpret", v: "Zwei falsche Interpreten gestrichen" }) : { k: "Interpret", v: mask(s[0]), code: true } },
  { id: "title", name: "Titel anspielen", desc: () => R.choice ? "Zwei falsche Titel fliegen raus" : "Anfangsbuchstaben und Länge des Titels",
    run: s => R.choice ? (P.mc.tStruck = shuffle(P.mc.title.filter(v => v !== s[1] && v !== P.mc.tPick)).slice(0, 2), renderMC(), { k: "Titel", v: "Zwei falsche Titel gestrichen" }) : { k: "Titel", v: mask(s[1]), code: true } },
  { id: "year", name: "Jahr eingrenzen", desc: "Zwei falsche Bereiche fliegen raus", ok: s => [0, 1, 2, 3].filter(i => !slotOk(P.refs, i, s[2]) && i !== P.slot).length >= 2,
    run: s => { P.struck = shuffle([0, 1, 2, 3].filter(i => !slotOk(P.refs, i, s[2]) && i !== P.slot)).slice(0, 2); renderYears(); return { k: "Jahr", v: "Zwei falsche Bereiche sind gestrichen" }; } },
  { id: "cover", name: "Cover zeigen", desc: "Das Albumcover, gut erkennbar", ok: () => P.dz && P.dz.cover && !P.coverShown,
    run: () => { showCover(true); return { k: "Cover", v: "Schau auf die Platte" }; } },
];
$("#hintBtn").onclick = () => {
  if (!P || !P.dz) return; SFX.tap();
  const s = R.items[R.idx].song;
  $("#hintGrid").innerHTML = HINTS.map(h => {
    const used = P.hints.includes(h.id), dis = used || (h.ok && !h.ok(s));
    return `<button class="hcard" data-h="${h.id}" ${dis ? "disabled" : ""}><span class="cost">${used ? "genutzt" : "−1"}</span><span class="hi"><svg viewBox="0 0 24 24">${ICONS[h.id]}</svg></span><b>${h.name}</b><small>${typeof h.desc === "function" ? h.desc() : h.desc}</small></button>`;
  }).join("");
  openSheet("hints");
};
$("#hintGrid").onclick = e => {
  const b = e.target.closest(".hcard"); if (!b || b.disabled) return;
  const h = HINTS.find(x => x.id === b.dataset.h), s = R.items[R.idx].song;
  P.hints.push(h.id); const r = h.run(s); SFX.hint();
  const el = document.createElement("div"); el.className = "uh";
  el.innerHTML = `<svg viewBox="0 0 24 24">${ICONS[h.id]}</svg><div><small>${r.k} · −1</small>${r.code ? `<code>${esc(r.v)}</code>` : `<span>${esc(r.v)}</span>`}</div>`;
  $("#usedHints").appendChild(el);
  $("#hintBtn").disabled = P.hints.length >= HINTS.length;
  closeSheet(true);
};
$("#more").onclick = () => {
  if (P.stage >= INTRO_STAGES.length - 1) return;
  P.stage++; SFX.hint(); setRing(deck.time());
  $("#more").innerHTML = P.stage >= INTRO_STAGES.length - 1 ? "Volle Länge" : `Länger hören <em>−1</em>`;
  $("#more").disabled = P.stage >= INTRO_STAGES.length - 1;
  $("#status").textContent = `Jetzt ${INTRO_STAGES[P.stage]} Sekunden. Kostet ${P.stage} ${P.stage > 1 ? "Punkte" : "Punkt"}.`;
  if (!playing) startPlay();
};

/* ---------- Auflösen ---------- */
$("#guess").onsubmit = e => { e.preventDefault(); submit(false); };
function submit(timeout) {
  if (!P || !P.dz || P.done) return;
  P.done = true; stop(); document.activeElement && document.activeElement.blur && document.activeElement.blur();
  const it = R.items[R.idx], [artist, title, years] = it.song, pl = curPlayer();
  const gt = R.choice ? (P.mc.tPick || "") : $("#gTitle").value.trim(), ga = R.choice ? (P.mc.aPick || "") : $("#gArtist").value.trim();
  const tOk = R.choice ? gt === title : matches(gt, title), aOk = R.choice ? ga === artist : matches(ga, artist, true);
  const exact = /^\d{4}$/.test($("#gYear").value) ? +$("#gYear").value : null;
  if (P.slot == null && exact && !P.refs.includes(exact)) P.slot = slotOf(P.refs, exact);
  const yP = P.slot != null && slotOk(P.refs, P.slot, years) ? 3 : 0, exOk = exact != null && years.includes(exact);
  const raw = (tOk ? 2 : 0) + (aOk ? 2 : 0) + yP + (exOk ? 1 : 0);
  const cost = P.hints.length + (R.mode === "intro" ? P.stage : 0);
  let pts = Math.max(0, raw - cost);
  const rows = [];
  rows.push(["Titel", gt, tOk ? 2 : 0, 2], ["Interpret", ga, aOk ? 2 : 0, 2], ["Jahr", P.slot != null ? slotName(P.refs, P.slot) : "", yP, 3]);
  if (exact != null) rows.push(["Genaues Jahr (Bonus)", exact, exOk ? 1 : 0, 1]);
  const extra = [];
  if (cost && raw) extra.push([R.mode === "intro" && P.stage ? "Tipps & Verlängerung" : P.hints.length > 1 ? `${P.hints.length} Tipps` : "Tipp", -Math.min(cost, raw)]);
  if (R.mode === "blitz" && !timeout && raw > 0) { const el = (performance.now() - P.blitzStart) / 1000; const b = P.blitzStart ? (el <= 8 ? 2 : el <= 14 ? 1 : 0) : 0; if (b) { pts += b; extra.push([`Blitz-Bonus (${el.toFixed(1)} s)`, b]); } }
  if (R.mode !== "party") { R.streak = pts >= 4 ? R.streak + 1 : 0; if (R.streak >= 3) { pts += 1; extra.push([`${R.streak}er-Serie`, 1]); } }
  if (timeout) extra.push(["Zeit abgelaufen", 0]);
  const before = pl.score; pl.score += pts;
  const cls = raw >= 7 && !cost ? "ok" : pts > 0 ? "part" : "miss";
  R.results.push({ song: it.song, pts, cls, player: pl.name });
  if (R.mode === "sudden" && !tOk && !aOk) R.over = true;

  // Anzeige
  $("#aT").textContent = title; $("#aA").textContent = artist; $("#aY").textContent = years.join(" / ");
  let html = rows.map(([k, you, p, max], i) => `<div class="r" style="animation-delay:${.08 * i}s"><div>${k}<small>${you != null && you !== "" ? esc(you) : "keine Angabe"}</small></div><div class="p ${p === max ? "ok" : p > 0 ? "part" : "miss"}">+${p}</div></div>`).join("");
  html += extra.map(([k, v], i) => `<div class="r" style="animation-delay:${.24 + .08 * i}s"><div>${esc(k)}</div><div class="p ${v > 0 ? "ok" : "miss"}">${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v)}</div></div>`).join("");
  html += `<div class="total"><span>${R.mode === "party" ? esc(pl.name) : "Dieser Song"}</span><span>+${pts}</span></div>`;
  $("#rows").innerHTML = html;
  const c = $("#cover"); c.style.filter = "none"; if (P.dz.cover) $("#coverWrap").classList.add("on");
  const dzl = $("#dz"); if (P.dz.link) { dzl.href = P.dz.link; dzl.classList.remove("hide"); } else dzl.classList.add("hide");
  $("#guess").classList.add("hide"); $("#reveal").classList.remove("hide");
  $("#status").textContent = "Dreh die Platte, um weiterzuhören."; setRing(deck.time());
  $("#more").classList.add("hide");
  const last = R.over || R.idx + 1 >= R.items.length;
  $("#next").textContent = R.over ? "Game over – zum Ergebnis" : last ? "Zum Ergebnis" : R.mode === "party" ? `Weiter: ${R.players[(R.idx + 1) % R.players.length].name}` : "Nächster Song";
  renderTop(); countUp($("#score"), before, pl.score);
  $("#score").classList.add("bump"); setTimeout(() => $("#score").classList.remove("bump"), 350);
  if (cls === "ok") { SFX.good(); confetti(90); } else if (pts > 0) SFX.mid(); else SFX.bad();
  if (innerWidth < 740) setTimeout(() => scrollTo({ top: 0, behavior: "smooth" }), 60);
}
$("#next").onclick = () => {
  SFX.tap();
  if (R.over || R.idx + 1 >= R.items.length) return finish();
  R.idx++; P.rot = 0; scrollTo(0, 0); loadSong();
};
$("#quit").onclick = () => confirmBox("Runde beenden?", "Dein Punktestand dieser Runde geht verloren.", "Beenden", () => { stop(); R = null; renderHome(); show("home"); });

/* ============================ Ende ============================ */
function finish() {
  stop(); show("end");
  const party = R.mode === "party";
  const total = party ? Math.max(...R.players.map(p => p.score)) : R.players[0].score;
  const max = Math.max(1, R.results.length * 7);
  $("#fN").textContent = "0"; countUp($("#fN"), 0, party ? total : R.players[0].score, 1100);
  const pct = R.players[0].score / max;
  if (party) {
    const sorted = R.players.slice().sort((a, b) => b.score - a.score);
    $("#fV").textContent = `${sorted[0].name} gewinnt!`; $("#fH").textContent = "Punkte des Siegers";
    $("#podium").innerHTML = sorted.map((p, i) => `<div class="pod"><span class="rk">${["🥇", "🥈", "🥉"][i] || i + 1}</span><b>${esc(p.name)}</b><span class="p">${p.score}</span></div>`).join("");
    $("#podium").classList.remove("hide");
  } else {
    $("#podium").classList.add("hide");
    $("#fV").textContent = R.mode === "sudden" ? `${R.results.length - (R.over ? 1 : 0)} Songs überlebt` :
      pct >= .8 ? "Absolute Legende." : pct >= .6 ? "Starke Runde – du kennst dich aus." : pct >= .35 ? "Solide. Da geht noch was." : "Aufwärmrunde. Nochmal?";
  }
  // Rekorde & Bestenliste
  let newRec = false;
  if (!R.practice) {
    const key = "mq-best-" + R.genre.id, best = store.get(key, 0);
    if (!party && R.players[0].score > best) { store.set(key, R.players[0].score); newRec = best > 0 || R.players[0].score > 0; }
    if (!party) $("#fH").textContent = newRec ? (best ? `Neuer Rekord! Vorher ${best}` : "Dein erster Rekord in diesem Genre") : `Rekord in diesem Genre: ${best}`;
    const board = store.get("mq-board", []);
    R.players.filter(p => p.score > 0).forEach(p => board.push({ n: p.name, s: p.score, m: R.daily ? "daily" : R.mode, g: R.genre.name, d: Date.now(), c: R.results.length }));
    board.sort((a, b) => b.s - a.s); store.set("mq-board", board.slice(0, 200));
    if (R.daily) store.set("mq-daily-" + todayKey(), { score: R.players[0].score });
  } else $("#fH").textContent = "Übungsrunde – zählt nicht für die Bestenliste";
  $("#summary").innerHTML = R.results.map(r => `<div><span><b>${esc(r.song[1])}</b> · ${esc(r.song[0])}${party ? ` <em style="opacity:.6">(${esc(r.player)})</em>` : ""}</span><span class="p ${r.cls}">+${r.pts}</span></div>`).join("");
  setTimeout(() => { if (newRec || pct >= .7 || party) { SFX.win(); confetti(180); } }, 500);
}
$("#again").onclick = () => { SFX.tap(); const g = R.genre; if (R.daily) return startDaily(); if (g.id === "daily") return startDaily(); openSetup(g); };
$("#toHome").onclick = () => { renderHome(); show("home"); };
$("#share").onclick = async () => {
  const em = R.results.map(r => r.cls === "ok" ? "🟩" : r.cls === "part" ? "🟨" : "🟥").join("");
  const who = R.mode === "party" ? R.players.slice().sort((a, b) => b.score - a.score).map(p => `${p.name}: ${p.score}`).join(", ") : `${R.players[0].score} Punkte`;
  const text = `Music Quiz · ${R.genre.name} · ${R.daily ? "Tages-Challenge " + todayKey() : MODES[R.mode].name}\n${em}\n${who}`;
  try { if (navigator.share) { await navigator.share({ text, url: location.href.split("#")[0] }); return; } } catch (e) { return; }
  try { await navigator.clipboard.writeText(text + "\n" + location.href.split("#")[0]); toast("Ergebnis kopiert"); } catch (e) { toast("Teilen ist hier nicht möglich"); }
};

/* ============================ Einstellungen-Sheet ============================ */
function renderSettings() {
  $("#setList").innerHTML = SETTINGS.map(s => `<div class="set"><label>${s.label}</label>${s.desc ? `<p>${s.desc}</p>` : ""}${s.type === "text"
    ? `<input type="text" data-k="${s.key}" value="${esc(S[s.key])}" placeholder="z. B. Alex" maxlength="16">`
    : `<div class="seg" data-k="${s.key}">${s.opts.map(([v, l], i) => `<button data-i="${i}" class="${S[s.key] === v ? "on" : ""}">${l}</button>`).join("")}</div>`}</div>`).join("");
}
$("#setList").onclick = e => {
  const b = e.target.closest(".seg button"); if (!b) return;
  const k = b.parentElement.dataset.k, def = SETTINGS.find(s => s.key === k);
  S[k] = def.opts[+b.dataset.i][0]; saveSettings(); SFX.tap(); renderSettings(); if (k === "theme") applyTheme();
};
$("#setList").oninput = e => { const k = e.target.dataset.k; if (k) { S[k] = e.target.value; saveSettings(); } };
$("#resetBoard").onclick = () => confirmBox("Bestenliste löschen?", "Alle Einträge und Rekorde auf diesem Gerät werden entfernt.", "Löschen", () => {
  store.set("mq-board", []); GENRES.forEach(g => store.set("mq-best-" + g.id, 0)); renderHome(); toast("Bestenliste gelöscht");
});

/* ============================ Bestenliste ============================ */
let boardMode = "all";
function renderBoard() {
  const tabs = [["all", "Alle"], ["daily", "Tages-Challenge"], ...Object.entries(MODES).map(([k, m]) => [k, m.name])];
  $("#boardFilter").innerHTML = tabs.map(([k, l]) => `<button class="chip${k === boardMode ? " on" : ""}" data-b="${k}">${l}</button>`).join("");
  const list = store.get("mq-board", []).filter(e => boardMode === "all" || e.m === boardMode).slice(0, 30);
  $("#board").innerHTML = list.length ? list.map((e, i) => `<li><span class="rk">${i + 1}</span><span class="who"><b>${esc(e.n)}</b><small>${e.m === "daily" ? "Tages-Challenge" : esc(e.g) + " · " + (MODES[e.m] ? MODES[e.m].name : "")} · ${new Date(e.d).toLocaleDateString("de-DE")}</small></span><span class="pts">${e.s}</span></li>`).join("")
    : `<li class="empty">Noch keine Einträge. Spiel eine Runde und trag dich ein.</li>`;
}
$("#boardFilter").onclick = e => { const b = e.target.closest(".chip"); if (b) { boardMode = b.dataset.b; renderBoard(); } };

/* ============================ Updates ============================ */
// Home-Bildschirm-Apps auf iOS halten alte Dateien fest. Beim Start und beim Zurückkehren
// in die App wird version.json ohne Cache geladen; ist eine neue Version da, lädt die App neu.
let updating = false;
async function checkUpdate() {
  if (updating || location.protocol === "file:") return;
  try {
    const r = await fetch("version.json?t=" + Date.now(), { cache: "no-store" });
    const { v } = await r.json();
    if (v && v !== window.APP_V && !(R && $("#game").offsetParent)) {
      updating = true; toast("Neue Version wird geladen …");
      setTimeout(() => location.replace(location.pathname + "?v=" + encodeURIComponent(v)), 700);
    }
  } catch (e) {}
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkUpdate(); });
$("#ver").textContent = window.APP_V || "–";

/* ============================ Design ============================ */
const THEME_BG = { original: "#110a24", glass: "#0d0b1f", pop: "#ffe94d", retro: "#1a0630" };
function applyTheme() {
  document.documentElement.dataset.theme = S.theme;
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = THEME_BG[S.theme] || THEME_BG.original;
}
applyTheme();

/* ============================ Start ============================ */
renderHome();
checkUpdate();
