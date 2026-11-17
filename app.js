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
const RING = 301.6, PREVIEW = 30, DPS = 60; // Grad pro Sekunde: eine CD-Umdrehung = 6 s

/* iPad erkennen (auch iPadOS, das sich als Mac ausgibt) */
const isIPad = /iPad/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
if (isIPad) document.documentElement.classList.add("ipad");

/* ============================ Einstellungen ============================ */
const DEFAULTS = { name: "", listen: 30, count: 10, cover: 20, hints: true, strict: "locker", yearLevel: "normal", sfx: true };
const S = Object.assign({}, DEFAULTS, store.get("mq-settings", {}));
const saveSettings = () => store.set("mq-settings", S);

const SETTINGS = [
  { key: "name", label: "Dein Name", desc: "Steht in der Bestenliste.", type: "text" },
  { key: "listen", label: "Hördauer", desc: "Wie lange der Ausschnitt laufen darf.", opts: [[10, "10 s"], [20, "20 s"], [30, "30 s"]] },
  { key: "count", label: "Songs pro Runde", opts: [[5, "5"], [10, "10"], [15, "15"], [20, "20"]] },
  { key: "cover", label: "Verschwommenes Cover", desc: "Taucht nach dieser Hörzeit als Hilfe auf der CD auf.", opts: [[0, "Aus"], [10, "nach 10 s"], [20, "nach 20 s"]] },
  { key: "hints", label: "Tipps", desc: "Tipps kosten je einen Punkt.", opts: [[true, "Erlaubt"], [false, "Aus"]] },
  { key: "strict", label: "Schreibweise", desc: "Wie genau Titel und Interpret stimmen müssen.", opts: [["locker", "Locker"], ["normal", "Normal"], ["streng", "Streng"]] },
  { key: "yearLevel", label: "Jahres-Auswahl", desc: "Wie nah die falschen Jahre am richtigen liegen.", opts: [["leicht", "Leicht"], ["normal", "Normal"], ["schwer", "Schwer"]] },
  { key: "sfx", label: "Soundeffekte", opts: [[true, "An"], [false, "Aus"]] },
];

/* ============================ Modi ============================ */
const MODES = {
  classic: { name: "Klassisch", icon: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>', desc: "Hören, raten, auflösen. Titel 2, Interpret 2, Jahr 3 Punkte." },
  blitz:   { name: "Blitz", icon: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>', desc: "20 Sekunden pro Song, ab dem ersten Ton. Wer schneller auflöst, kassiert bis zu 2 Bonuspunkte." },
  intro:   { name: "Intro-Profi", icon: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>', desc: "Nur 2 Sekunden Musik. Jede Verlängerung kostet einen Punkt – erkennst du es früh, gewinnst du." },
  sudden:  { name: "Sudden Death", icon: '<path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z"/>', desc: "Endlos-Runde. Sobald du Titel und Interpret verpasst, ist Schluss." },
  party:   { name: "Party", icon: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M14 20a4.5 4.5 0 0 1 7-3.7"/>', desc: "2 bis 6 Leute, ein Gerät. Ihr seid abwechselnd dran, am Ende gibt es ein Treppchen." },
};
let mode = store.get("mq-mode", "classic");
const INTRO_STAGES = [2, 5, 10, 20, 30];
const BLITZ_SEC = 20;

/* ============================ Live-Charts-Genre ============================ */
window.GENRES = window.GENRES || [];
GENRES.splice(1, 0, { id: "live", name: "Live-Charts", tagline: "Was gerade läuft: die aktuellen Top 100 bei Deezer", colors: ["#ff7b9c", "#7ff3e6"], live: true, songs: [] });

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
const LV = { locker: { sim: .7, tok: .5, loose: true }, normal: { sim: .8, tok: .6, loose: false }, streng: { sim: .9, tok: 9, loose: false } };
const tol = len => len <= 3 ? 0 : len <= 5 ? 1 : len <= 8 ? 2 : 3;
function similar(g, a, L) {
  if (!g || !a) return false;
  if (g === a) return true;
  const gc = g.replace(/ /g, ""), ac = a.replace(/ /g, "");
  if (gc === ac) return true;
  if (1 - lev(gc, ac) / Math.max(gc.length, ac.length) >= L.sim) return true;
  if (L.tok > 1) return false;
  if (ac.length >= 3 && gc.includes(ac)) return true;
  if (L.loose && gc.length >= 4 && ac.includes(gc) && gc.length / ac.length >= .4) return true;
  const at = a.split(" ").filter(w => w.length > 1 || /\d/.test(w)), gt = g.split(" ");
  if (!at.length) return false;
  const hit = at.filter(w => gt.some(x => x === w || (w.length > 3 && lev(x, w) <= tol(w.length))));
  if (hit.length / at.length >= L.tok && hit.some(w => w.length >= 3)) return true;
  return L.loose && (hit.some(w => w.length >= 5) || (hit.length / at.length >= .34 && hit.some(w => w.length >= 4)));
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
const dzOf = f => ({ preview: f.preview, cover: f.album && (f.album.cover_xl || f.album.cover_big), link: f.link, albumId: f.album && f.album.id });
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
    return `<button class="genre${g.live ? " live" : ""}" data-i="${i}"><div class="disc" ${c}></div><div><b>${esc(g.name)}</b><small>${esc(g.tagline)}</small></div>${best && !g.live ? `<span class="rec">★ ${best}</span>` : ""}</button>`;
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
  renderPlayers(); renderSetupSummary();
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
  const groups = [...new Set(g.songs.map(s => groupOf(g, s)))].sort();
  $("#setupFilterLbl").textContent = g.groupBy === "year" ? "Jahre" : "Jahrzehnte";
  $("#setupFilter").innerHTML = groups.map(d => `<button class="chip on" data-v="${d}">${g.groupBy === "year" ? d : (d < 2000 ? String(d).slice(2) : d) + "er"}</button>`).join("");
  $("#setupFilterWrap").classList.toggle("hide", groups.length < 2);
  openSheet("setup");
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
$("#start").onclick = () => {
  const g = setupGenre; let songs = g.songs;
  if (!g.live) { const sel = $$("#setupFilter .on").map(b => +b.dataset.v); songs = songs.filter(s => sel.includes(groupOf(g, s))); }
  closeSheet(true);
  startRound({ genre: g, songs, mode });
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

/* ============================ Runde ============================ */
const audio = new Audio(); audio.preload = "auto"; audio.setAttribute("playsinline", "");
let R = null, P = null, playing = false, dragging = false, lastTs = 0;

function startRound(o) {
  const pool = o.keepOrder ? o.songs.slice() : shuffle(o.songs.slice());
  const n = o.daily ? 5 : o.mode === "sudden" ? pool.length : Math.min(S.count, pool.length);
  const pl = o.mode === "party" ? players.map((p, i) => ({ name: p.trim() || "Spieler " + (i + 1), score: 0 })) : [{ name: S.name.trim() || "Du", score: 0 }];
  R = { genre: o.genre, mode: o.mode, daily: !!o.daily, practice: !!o.practice, items: pool.splice(0, n).map(s => ({ song: s })), pool, idx: 0,
    players: pl, results: [], streak: 0, over: false,
    listen: o.daily ? 30 : S.listen, cover: o.mode === "intro" ? 0 : (o.daily ? 20 : S.cover), hints: o.daily ? true : S.hints };
  setDiscColors($("#stage"), o.genre);
  $("#score").textContent = "0";
  $("#playerChip").classList.toggle("hide", R.mode !== "party");
  $("#lives").classList.toggle("hide", R.mode !== "sudden");
  $("#blitzBar").classList.toggle("hide", R.mode !== "blitz");
  $("#hintBtn").classList.toggle("hide", !R.hints);
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
  stop(); audio.removeAttribute("src"); try { audio.load(); } catch (e) {}
  P = { yearOpts: [], yearPick: null, struck: [], hints: [], played: 0, coverShown: false, stage: 0, blitzStart: null, seek: 0, rot: 0, dz: null, done: false };
  $("#coverWrap").className = "cover"; $("#cover").style.backgroundImage = ""; $("#cover").style.filter = "";
  $("#guess").classList.remove("hide"); $("#reveal").classList.add("hide");
  $("#gTitle").value = ""; $("#gArtist").value = ""; $("#usedHints").innerHTML = ""; $("#years").innerHTML = "";
  $("#hintBtn").disabled = false;
  $("#more").classList.toggle("hide", R.mode !== "intro");
  $("#blitzFill").style.transform = "scaleX(1)";
  setRing(0);
  renderTop();
  if (R.mode === "party" && R.players.length > 1) { $("#handName").textContent = curPlayer().name; $("#handoff").classList.remove("hide"); }
  $("#status").textContent = "Song wird gesucht …";
  let dz = null;
  while (!dz && R.idx < R.items.length) {
    dz = await lookup(R.items[R.idx].song);
    if (!dz) { const spare = R.pool.shift(); if (spare) R.items[R.idx] = { song: spare }; else R.items.splice(R.idx, 1); }
  }
  if (!dz) { $("#status").textContent = "Deezer ist gerade nicht erreichbar. Prüfe die Internetverbindung und starte die Runde neu."; return; }
  const it = R.items[R.idx]; P.dz = dz;
  if (!it.song[2]) { const y = dz.albumId && await yearOfAlbum(dz.albumId); it.song = [it.song[0], it.song[1], [y || THIS_YEAR], dz]; }
  P.yearOpts = makeYears(it.song[2]); renderYears();
  if (dz.cover) $("#cover").style.backgroundImage = `url("${dz.cover}")`;
  audio.src = dz.preview;
  $("#status").textContent = "Tippe auf Play. Zum Spulen die CD drehen.";
  renderTop(); setRing(0);
  const nx = R.items[R.idx + 1]; if (nx) lookup(nx.song);
}
$("#handGo").onclick = () => { SFX.tap(); $("#handoff").classList.add("hide"); };

/* ---------- Abspielen, Ring & Scrubbing ---------- */
function setIcon(p) { $("#ico").innerHTML = p ? '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>' : '<path d="M8 5v14l11-7z"/>'; }
function stop() { audio.pause(); playing = false; setIcon(false); }
function setRing(t) {
  $("#ring").style.strokeDashoffset = RING * (1 - clamp(t, 0, PREVIEW) / PREVIEW);
  const lim = P && !P.done ? limit() : PREVIEW;
  $("#ringLim").style.strokeDashoffset = RING * (1 - lim / PREVIEW);
  $("#tNow").textContent = fmt(t); $("#tMax").textContent = fmt(lim);
}
$("#play").onclick = () => {
  if (!P || P.done && !audio.src) return;
  if (playing) { stop(); return; }
  if (!audio.src) { $("#status").textContent = "Der Song lädt noch …"; return; }
  if (audio.currentTime >= limit() - .05 && !P.done) audio.currentTime = 0;
  const pr = audio.play();
  playing = true; setIcon(true); lastTs = performance.now();
  if (R.mode === "blitz" && !P.blitzStart && !P.done) P.blitzStart = performance.now();
  $("#status").textContent = "";
  if (pr && pr.then) pr.then(() => { if (P.seek && Math.abs(audio.currentTime - P.seek) > .3) audio.currentTime = P.seek; P.seek = 0; })
    .catch(() => { stop(); $("#status").textContent = "Abspielen blockiert. Tippe noch einmal auf Play."; });
};
audio.addEventListener("ended", stop);

const stage = $("#stage"); let aPrev = 0, want = 0, tickAcc = 0;
const angleAt = e => { const r = stage.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI; };
stage.addEventListener("pointerdown", e => {
  if (e.target.closest("#play") || !P || !P.dz) return;
  dragging = true; stage.classList.add("drag"); stage.setPointerCapture(e.pointerId);
  aPrev = angleAt(e); want = audio.currentTime || P.seek || 0; tickAcc = 0;
});
stage.addEventListener("pointermove", e => {
  if (!dragging) return;
  const a = angleAt(e); let d = a - aPrev; if (d > 180) d -= 360; if (d < -180) d += 360; aPrev = a;
  const lim = P.done ? PREVIEW : limit();
  want = clamp(want + d / DPS, 0, lim - .05);
  P.rot += d;
  tickAcc += Math.abs(d); if (tickAcc > 24) { tickAcc = 0; SFX.tick(); }
  if (audio.readyState >= 1) audio.currentTime = want; else P.seek = want;
  setRing(want);
});
const endDrag = () => { if (!dragging) return; dragging = false; stage.classList.remove("drag"); };
stage.addEventListener("pointerup", endDrag); stage.addEventListener("pointercancel", endDrag);

(function loop(now) {
  if (R && P && $("#game").offsetParent !== null) {
    const dt = (now - lastTs) / 1000; lastTs = now;
    if (playing && !dragging) {
      P.played += dt; P.rot += dt * DPS;
      if (!P.done && audio.currentTime >= limit()) { stop(); audio.currentTime = limit(); if (R.mode === "intro" && P.stage < INTRO_STAGES.length - 1) $("#status").textContent = "Noch keine Ahnung? Hör etwas länger."; }
      setRing(audio.currentTime);
    }
    $("#disc").style.transform = `rotate(${P.rot}deg)`;
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
  const c = $("#cover"); c.style.filter = "blur(14px) saturate(1.2)"; $("#coverWrap").classList.add("on");
  if (!paid) { toast("Cover-Hinweis aufgedeckt"); SFX.hint(); }
}

/* ---------- Jahre ---------- */
function makeYears(years) {
  const correct = years[Math.random() * years.length | 0];
  const ok = y => !years.includes(y) && y <= THIS_YEAR && y >= 1950;
  const range = (a, b) => { const r = []; for (let d = a; d <= b; d++) { if (ok(correct - d)) r.push(correct - d); if (ok(correct + d)) r.push(correct + d); } return r; };
  const opts = new Set([correct]);
  const plan = S.yearLevel === "leicht" ? [[3, 10, 4]] : S.yearLevel === "schwer" ? [[1, 3, 4]] : [[1, 2, 2], [3, 7, 2]];
  plan.forEach(([a, b, k]) => shuffle(range(a, b)).slice(0, k).forEach(y => opts.add(y)));
  shuffle(range(1, 15)).forEach(y => { if (opts.size < 5) opts.add(y); });
  return [...opts].slice(0, 5).sort((a, b) => a - b);
}
function renderYears() {
  $("#years").innerHTML = P.yearOpts.map(y => `<button type="button" class="year${y === P.yearPick ? " on" : ""}${P.struck.includes(y) ? " out" : ""}" data-y="${y}">${y}</button>`).join("");
}
$("#years").onclick = e => { const b = e.target.closest(".year"); if (!b) return; SFX.tap(); const y = +b.dataset.y; P.yearPick = P.yearPick === y ? null : y; renderYears(); };

/* ---------- Tipps ---------- */
const ICONS = {
  artist: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  title: '<path d="M5 6h14M12 6v13M9 19h6"/>',
  year: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  cover: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
};
const mask = s => s.replace(/\(.*?\)/g, "").trim().split(/\s+/).map(w => w.replace(/^([^\p{L}\p{N}]*)(.)(.*)$/u, (m, p, f, r) => p + f + r.replace(/[\p{L}\p{N}]/gu, "_"))).join("  ");
const HINTS = [
  { id: "artist", name: "Interpret anspielen", desc: "Anfangsbuchstaben und Länge des Namens", run: s => ({ k: "Interpret", v: mask(s[0]), code: true }) },
  { id: "title", name: "Titel anspielen", desc: "Anfangsbuchstaben und Länge des Titels", run: s => ({ k: "Titel", v: mask(s[1]), code: true }) },
  { id: "year", name: "50:50 beim Jahr", desc: "Zwei falsche Jahre fliegen raus", ok: s => P.yearOpts.filter(y => !s[2].includes(y) && y !== P.yearPick).length >= 2,
    run: s => { P.struck = shuffle(P.yearOpts.filter(y => !s[2].includes(y) && y !== P.yearPick)).slice(0, 2); renderYears(); return { k: "Jahr", v: "Zwei falsche Jahre sind gestrichen" }; } },
  { id: "cover", name: "Cover zeigen", desc: "Das Albumcover, leicht verschwommen", ok: () => P.dz && P.dz.cover && !P.coverShown,
    run: () => { showCover(true); return { k: "Cover", v: "Schau auf die CD" }; } },
];
$("#hintBtn").onclick = () => {
  if (!P || !P.dz) return; SFX.tap();
  const s = R.items[R.idx].song;
  $("#hintGrid").innerHTML = HINTS.map(h => {
    const used = P.hints.includes(h.id), dis = used || (h.ok && !h.ok(s));
    return `<button class="hcard" data-h="${h.id}" ${dis ? "disabled" : ""}><span class="cost">${used ? "genutzt" : "−1"}</span><span class="hi"><svg viewBox="0 0 24 24">${ICONS[h.id]}</svg></span><b>${h.name}</b><small>${h.desc}</small></button>`;
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
  P.stage++; SFX.hint(); setRing(audio.currentTime);
  $("#more").innerHTML = P.stage >= INTRO_STAGES.length - 1 ? "Volle Länge" : `Länger hören <em>−1</em>`;
  $("#more").disabled = P.stage >= INTRO_STAGES.length - 1;
  $("#status").textContent = `Jetzt ${INTRO_STAGES[P.stage]} Sekunden. Kostet ${P.stage} ${P.stage > 1 ? "Punkte" : "Punkt"}.`;
  if (!playing) $("#play").click();
};

/* ---------- Auflösen ---------- */
$("#guess").onsubmit = e => { e.preventDefault(); submit(false); };
function submit(timeout) {
  if (!P || !P.dz || P.done) return;
  P.done = true; stop(); document.activeElement && document.activeElement.blur && document.activeElement.blur();
  const it = R.items[R.idx], [artist, title, years] = it.song, pl = curPlayer();
  const gt = $("#gTitle").value.trim(), ga = $("#gArtist").value.trim();
  const tOk = matches(gt, title), aOk = matches(ga, artist, true);
  let yP = 0; if (P.yearPick != null) { const d = Math.min(...years.map(y => Math.abs(y - P.yearPick))); yP = d === 0 ? 3 : d === 1 ? 1 : 0; }
  const raw = (tOk ? 2 : 0) + (aOk ? 2 : 0) + yP;
  const cost = P.hints.length + (R.mode === "intro" ? P.stage : 0);
  let pts = Math.max(0, raw - cost);
  const rows = [];
  rows.push(["Titel", gt, tOk ? 2 : 0, 2], ["Interpret", ga, aOk ? 2 : 0, 2], ["Jahr", P.yearPick, yP, 3]);
  const extra = [];
  if (cost && raw) extra.push([R.mode === "intro" && P.stage ? "Tipps & Verlängerung" : P.hints.length > 1 ? `${P.hints.length} Tipps` : "Tipp", -Math.min(cost, raw)]);
  if (R.mode === "blitz" && !timeout && raw > 0) { const el = (performance.now() - P.blitzStart) / 1000; const b = P.blitzStart ? (el <= 8 ? 2 : el <= 14 ? 1 : 0) : 0; if (b) { pts += b; extra.push([`Blitz-Bonus (${el.toFixed(1)} s)`, b]); } }
  if (R.mode !== "party") { R.streak = pts >= 4 ? R.streak + 1 : 0; if (R.streak >= 3) { pts += 1; extra.push([`${R.streak}er-Serie`, 1]); } }
  if (timeout) extra.push(["Zeit abgelaufen", 0]);
  const before = pl.score; pl.score += pts;
  const cls = raw === 7 && !cost ? "ok" : pts > 0 ? "part" : "miss";
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
  $("#status").textContent = "Dreh die CD, um weiterzuhören."; setRing(audio.currentTime);
  $("#more").classList.add("hide");
  const last = R.over || R.idx + 1 >= R.items.length;
  $("#next").textContent = R.over ? "Game over – zum Ergebnis" : last ? "Zum Ergebnis" : R.mode === "party" ? `Weiter: ${R.players[(R.idx + 1) % R.players.length].name}` : "Nächster Song";
  renderTop(); countUp($("#score"), before, pl.score);
  $("#score").classList.add("bump"); setTimeout(() => $("#score").classList.remove("bump"), 350);
  if (cls === "ok") { SFX.good(); confetti(90); } else if (pts > 0) SFX.mid(); else SFX.bad();
  if (innerWidth < 740) setTimeout(() => $("#reveal").scrollIntoView({ behavior: "smooth", block: "start" }), 60);
}
$("#next").onclick = () => {
  SFX.tap();
  if (R.over || R.idx + 1 >= R.items.length) return finish();
  R.idx++; P.rot = 0; loadSong(); scrollTo({ top: 0, behavior: "smooth" });
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
  S[k] = def.opts[+b.dataset.i][0]; saveSettings(); SFX.tap(); renderSettings();
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

/* ============================ Start ============================ */
renderHome();
