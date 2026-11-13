import { DurableObject } from "cloudflare:workers";
import { ITEMS, RARITY, DROP_CHANCE, rollItem, PATCHES, patchGoal, patchName, unlocked, SHAPES, EYES, MOUTHS, TITLES, SLOTS, SETS,
  EPIC_BOSSES, isBound, GIFT_MIN_KILLS, GIFTS_PER_DAY, GOALS, SHIP_KILLS, DAY_KILLS,
  SPIN_CD, HOTFIX_NOTES, SECRETS, LAUNCH, LAUNCH_CROWD, patchShare, helpersNeeded, BAR_MIN_KILLS, A2_DROP, SKILLS, skillAt, swingMs, spinCd, dashCd, SCAV_MAX, scavNeed, gatherMs, NODE_REQ, NODE_YIELD, NODE_XP, NODE_HP, RES, BUILD_AT, resGoal, NODE_NAMES, NODES, LEVEL_CAP, dmgAt, gearOf, UPG_MAX, upgSpares, upgCost } from "../public/items.js";
import { isBad, cleanChat, isReserved } from "./filter.js";

// One shared world for everyone. The browser connects to /ws; everything else is the static page.
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      if (req.headers.get("Upgrade") !== "websocket") return new Response("expected websocket", { status: 426 });
      const stub = env.WORLD.get(env.WORLD.idFromName("world-1"));
      return stub.fetch(req); // Cloudflare adds CF-Connecting-IP; the world uses it only to stop tab floods and one-person report gangs
    }
    if (url.pathname === "/status") return env.WORLD.get(env.WORLD.idFromName("world-1")).fetch(req); // the landing screen's live numbers
    return env.ASSETS.fetch(req);
  },
};

const W = 2400, H = 1200, SPAWN = { x: 800, y: 600 };
const FENCE_X = 1560;        // the Area 2 fence. Everything right of it is Area 2.
const AREA2_OPEN_MS = 300000; // how long the hole stays open
const TODO = 98;             // kind index for Area 2's enemy
const SAFE = 110;            // safe radius around spawn
const BOSS_LEASH = 330;      // bosses never come closer to spawn than this
const TICK = 100;            // ms
const MAX_PLAYERS = 60;
const SPEED = 170;           // px/s
const REACH = 46;            // attack distance (edge to edge-ish)
const SLIME_NAMES = ["SLIME_FINAL", "SLIME_FINAL_v2", "SLIME_FINAL_v2_ACTUAL", "slime (placeholder)", "slime_copy(3)", "SLIME_DO_NOT_SHIP"];
const BOSS = 99;             // kind index for the boss
const BOSS2 = 97;            // the second boss, FINAL_BOSS_v0.1; bosses take turns
const FAST = 10, BIG = 11, LAG = 12; // special slimes
const RELEASE = 96;          // RELEASE_CANDIDATE_1.0: the launch boss. Needs a crowd.
const isBoss = (k) => k === BOSS || k === BOSS2 || k === RELEASE;
// per kind: hp, size, bite damage, hop speed (wander, chase), xp
const KIND = {
  normal: { hp: 3, r: 16, dmg: 1, sp: [85, 120], xp: 1 },
  [FAST]: { hp: 2, r: 11, dmg: 1, sp: [150, 230], xp: 1 },
  [BIG]: { hp: 9, r: 27, dmg: 2, sp: [50, 75], xp: 3 },
  [LAG]: { hp: 4, r: 16, dmg: 1, sp: [85, 120], xp: 2 },
  [TODO]: { hp: 8, r: 20, dmg: 2, sp: [85, 120], xp: 3 },
  [BOSS]: { r: 42, dmg: 2, sp: [70, 110], xp: 6 },
  [BOSS2]: { r: 46, dmg: 2, sp: [55, 80], xp: 6 },
  [RELEASE]: { r: 54, dmg: 3, sp: [50, 75], xp: 10 },
};
const kindOf = (k) => KIND[k] || KIND.normal;
// danger rings: the farther from spawn, the tougher the slimes and the better the rewards. Area 2 is the outermost ring.
const RING_R = [380, 720];
const ringOf = (x, y) => x > FENCE_X ? 3 : Math.hypot(x - SPAWN.x, y - SPAWN.y) < RING_R[0] ? 0 : Math.hypot(x - SPAWN.x, y - SPAWN.y) < RING_R[1] ? 1 : 2;
// going farther pays more per minute, not just per kill: rewards grow faster than slime HP, and rarer loot only drops out there
const TIER = [{ hp: 1, dmg: 0, xp: 1, drop: 0.6, maxR: 0 }, { hp: 2, dmg: 0, xp: 3, drop: 1, maxR: 1 }, { hp: 4, dmg: 1, xp: 8, drop: 1.5, maxR: 2 }, { hp: 1.5, dmg: 0, xp: 4, drop: 1.2, maxR: 2 }];
const BOSS_EVERY = 40;       // all-time kills between bosses
const BUG = 13;              // Bug Bounty event target: runs away, drops Rare+ for everyone who hits it
KIND[BUG] = { hp: 25, r: 14, dmg: 0, sp: [160, 210], xp: 4 };
const SHOP_AT = { x: 1030, y: 580 }, FOUNTAIN_AT = { x: 1000, y: 380 }, NPC_AT = { x: 560, y: 520 };
const BOT_NAMES = ["NPC_Player_01", "NPC_Player_02"];
const BOT_LINES = ["is this game finished?", "lvl 5 is max?? lol", "anyone wanna trade. i have nothing", "brb",
  "i'm a bot btw. the devs added me so the server looks busy", "when area 2", "this slime has the same face as me",
  "gg", "i paid for early access for this", "patch notes say 'bug fixes'. which bugs", "nice hat"];
const EMOTES = 5;            // wave, dance, T-pose, sit, cry
const KEY_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DAY = 86400000;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const xpFor = (lvl) => lvl * lvl * 8; // xp needed to leave this level: Lv 5 in ~10 minutes near spawn, Lv 15 takes a couple of hours out in the rings

export class World extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // SOLO_TEST=1 only ever comes from PLAY-ON-MY-PC.bat: one person can ship patches alone to test them. The live game never sets it.
    this.solo = !!(env && env.SOLO_TEST === "1");
    this.players = new Map();
    this.slimes = new Map();
    this.active = new Map(); // account -> last time it really helped kill something (sizes the patch crowd)
    this.nextId = 1;
    this.events = [];
    this.total = 0;
    this.dirty = false;
    this.timer = null;
    this.lastSave = 0;
    this.fence = { hp: 150, max: 150, openUntil: 0 };
    this.event = null;           // hotfix double loot: { kind, until }
    this.bots = new Map();       // placeholder players while the server is quiet
    this.nodeHp = NODES.map((n) => NODE_HP[n.tier]); this.nodeBack = NODES.map(() => 0); // trees and rocks: uses left, and when a used-up one grows back
    ctx.blockConcurrencyWhile(async () => {
      this.total = (await ctx.storage.get("total")) || 0;
      this.patch = (await ctx.storage.get("patch")) || 0;          // patches shipped so far
      this.patchKills = (await ctx.storage.get("patchKills")) || 0; // kills toward the next one
      this.hof = (await ctx.storage.get("hof")) || {};               // Hall of Fame
      this.finCount = (await ctx.storage.get("finCount")) || {};     // how many people have earned each Finished item
      this.patchBy = (await ctx.storage.get("patchBy")) || {};       // bar kills per player for the patch being built
      this.patchNext = (await ctx.storage.get("patchNext")) || {};   // kills banked toward the NEXT patch by players whose share is full
      this.patchNames = (await ctx.storage.get("patchNames")) || {}; // display names of this patch's helpers (for the credits)
      this.plaques = (await ctx.storage.get("plaques")) || {};
      this.patchRes = (await ctx.storage.get("patchRes")) || { poly: 0, vert: 0 }; // materials delivered to the build site for this patch
      this.resBy = (await ctx.storage.get("resBy")) || {};                         // materials per player for this patch
      if (await ctx.storage.get("a2perm")) { this.fence.hp = 0; this.fence.openUntil = 8.64e15; this.fence.perm = true; }
      // (plaques: patch number -> top 3 helpers, shown on a plaque in that zone)
    });
  }

  async fetch(req) {
    if (new URL(req.url).pathname === "/status") {
      const online = [...this.players.values()].filter((p) => p.named && !p.bot).length;
      return new Response(JSON.stringify({ online, patch: this.patch, kills: this.patchKills, goal: patchGoal(this.patch), total: this.total, plaques: this.plaques, a2: this.fence.perm ? 1 : 0, res: [this.patchRes.poly, resGoal(this.patch).poly, this.patchRes.vert, resGoal(this.patch).vert] }),
        { headers: { "content-type": "application/json", "cache-control": "no-store" } });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    const ip = req.headers.get("CF-Connecting-IP") || "";
    const ipTag = ip ? (await sha("ip:" + ip)).slice(0, 12) : "";
    // stop one person opening dozens of tabs to fill the server (10 per address leaves room for families and schools)
    if (ipTag && [...this.players.values()].filter((q) => q.ipTag === ipTag).length >= 10) {
      server.send(JSON.stringify({ t: "full", why: "too many tabs from one place" }));
      server.close(1013, "too many");
      return new Response(null, { status: 101, webSocket: client });
    }
    if (this.humans() + [...this.players.values()].filter((q) => !q.named && !q.bot).length >= MAX_PLAYERS) {
      server.send(JSON.stringify({ t: "full" }));
      server.close(1013, "full");
      return new Response(null, { status: 101, webSocket: client });
    }
    this.join(server, ipTag);
    return new Response(null, { status: 101, webSocket: client });
  }

  join(ws, ipTag = "") {
    const id = this.nextId++;
    const p = {
      id, ws, name: "Player_" + (1000 + Math.floor(Math.random() * 9000)), hue: Math.floor(Math.random() * 360),
      x: SPAWN.x + (Math.random() - 0.5) * 100, y: SPAWN.y + 10 + Math.random() * 40, tx: null, ty: null,
      target: null, hp: 10, max: 10, lvl: 1, xp: 0, kills: 0, lastHit: 0, lastHurt: 0, lastRegen: 0,
      deadUntil: 0, lastSay: 0, named: false, wear: [-1, -1, -1, -1, -1], look: [0, 0, 0, 0], combo: 0, bucket: 0, bucketAt: Date.now(),
      acct: null, keyHash: null, ipTag, emote: -1, emoteAt: 0, lastEmote: 0, lastRename: 0, loading: false,
    };
    this.players.set(id, p);
    ws.send(JSON.stringify({ t: "you", id, total: this.total, w: W, h: H, plaques: this.plaques }));
    if (this.solo) ws.send(JSON.stringify({ t: "err", text: "SOLO TEST MODE (your PC only): you can ship patches alone. The real game needs 3+ people per patch." }));
    // a socket that never says hi doesn't get to hold a slot
    setTimeout(() => { if (this.players.get(id) === p && !p.named && !p.loading) { try { ws.close(4001, "no hi"); } catch {} this.leave(p); } }, 10000);
    ws.addEventListener("message", (ev) => this.onMsg(p, ev.data));
    const bye = () => this.leave(p);
    ws.addEventListener("close", bye);
    ws.addEventListener("error", bye);
    if (!this.timer) this.timer = setInterval(() => this.tick(), TICK);
  }

  leave(p) {
    if (!this.players.has(p.id)) return;
    this.players.delete(p.id);
    if (p.acct) this.saveAcct(p);
    if (p.named && !p.bot) this.events.push({ e: "sys", text: `${p.name} left. Their progress is saved. (It actually is now.)` });
    if (this.humans() === 0) for (const b of [...this.players.values()]) if (b.bot) this.players.delete(b.id);
    if (this.players.size === 0 && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.save(true);
    }
  }

  onMsg(p, raw) {
    try { this.handle(p, raw); } catch (err) { console.log("message error", err && err.stack); }
  }

  handle(p, raw) {
    // simple flood guard: 25 messages per second per player
    const now = Date.now();
    if (now - p.bucketAt > 1000) { p.bucket = 0; p.bucketAt = now; }
    if (++p.bucket > 25) return;
    if (typeof raw !== "string" || raw.length > 300) return;
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.t !== "string") return;
    if (m.t === "hi") {
      if (p.named || p.loading) return;
      p.loading = true;
      this.login(p, m).catch(() => {}).finally(() => { p.loading = false; });
      return;
    }
    if (!p.acct) return; // everything below needs a loaded character
    if (m.t === "look") {
      const a = p.acct;
      if (Number.isFinite(m.hue) && (m.hue < 360 || this.statsOf(a).lvl >= LEVEL_CAP)) a.hue = p.hue = Math.floor(clamp(m.hue, 0, 360)); // 360 = rainbow, earned at max level
      if (Array.isArray(m.look)) {
        const lim = [SHAPES.length, EYES.length, MOUTHS.length, TITLES.length];
        const l = lim.map((n, i) => (Number.isInteger(m.look[i]) && m.look[i] >= 0 && m.look[i] < n ? m.look[i] : 0));
        if (!this.hasTitle(a, l[3])) l[3] = 0; // titles are earned, checked here
        a.look = p.look = l;
      }
      p.dirty = true;
    } else if (m.t === "rename") {
      if (now - p.lastRename < 5000) return this.tell(p, { t: "err", text: "Slow down. Renaming has a cooldown, like everything here." });
      p.lastRename = now;
      this.rename(p, m.name).catch(() => {});
    } else if (m.t === "wear") {
      const slot = SLOTS.indexOf(m.slot);
      if (slot < 0) return;
      if (m.item === null || m.item === -1) { p.wear[slot] = -1; delete p.acct.wear[m.slot]; }
      else {
        const it = ITEMS[m.item];
        if (!it || it.slot !== m.slot || !(p.acct.bag[it.id] > 0)) return; // you can only wear what you own
        p.wear[slot] = m.item; p.acct.wear[m.slot] = it.id;
      }
      const full = this.fullSets(p);
      if (full > (p.acct.stats.sets || 0)) { p.acct.stats.sets = full; this.checkTitles(p); }
      p.dirty = true;
    } else if (m.t === "go") {
      if (!Number.isFinite(m.x) || !Number.isFinite(m.y)) return;
      p.tx = clamp(m.x, 20, W - 20); p.ty = clamp(m.y, 20, H - 20); p.target = null; p.gather = null;
    } else if (m.t === "gather") {
      const nd = NODES[m.id];
      if (!nd || !p.acct) return;
      const lv = this.scavLvl(p);
      if (lv < NODE_REQ[nd.tier]) return this.tell(p, { t: "err", text: `${NODE_NAMES[nd.k][nd.tier]} needs Scavenging level ${NODE_REQ[nd.tier]}. You're level ${lv}. Closer trees and rocks first.` });
      p.gather = nd.id; p.target = null; p.tx = null; p.lastGather = Date.now();
    } else if (m.t === "atk") {
      p.gather = null;
      if (m.id === "fence" && !this.fence.openUntil && unlocked(this.patch, "fence")) { p.target = "fence"; p.tx = null; }
      else if (m.id === "fence") this.tell(p, { t: "err", text: "The fence is invulnerable. HP wasn't implemented yet. (It ships in a patch.)" });
      else if (this.slimes.has(m.id)) { p.target = m.id; p.tx = null; }
    } else if (m.t === "say") {
      if (typeof m.text !== "string") return;
      let text = m.text.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 80);
      if (!text || now - p.lastSay < 1200) return;
      p.lastSay = now;
      if (p.acct.mutedUntil > now) return this.tell(p, { t: "err", text: "You've been muted for a while after reports from other players." });
      text = cleanChat(text);
      this.events.push({ e: "say", id: p.id, text });
    } else if (m.t === "emote") {
      if (!Number.isInteger(m.k) || m.k < 0 || m.k >= EMOTES || now - p.lastEmote < 1000) return;
      p.lastEmote = now; p.emote = m.k; p.emoteAt = now;
      this.events.push({ e: "emote", id: p.id, k: m.k });
    } else if (m.t === "report") {
      this.report(p, m.id).catch(() => {});
    } else if (m.t === "give") {
      this.give(p, m.to, m.item);
    } else if (m.t === "me") {
      if (now - (p.lastMe || 0) > 1000) { p.lastMe = now; this.sendMe(p); }
    } else if (m.t === "spin") {
      this.spin(p, now);
    } else if (m.t === "dash") {
      this.dash(p, now, m);
    } else if (m.t === "upgrade") {
      if (Number.isInteger(m.item)) this.upgrade(p, m.item);
    } else if (m.t === "hof") {
      if (now - (p.lastHof || 0) > 2000) { p.lastHof = now; this.tell(p, { t: "hof", hof: Object.fromEntries(Object.entries(this.hof).map(([k, l]) => [k, l.map((e) => [e[0], e[1]])])), me: p.acct.name }); }
    }
  }

  // ---------- characters: claimed names, secret save codes, saved progress ----------
  humans() { let n = 0; for (const q of this.players.values()) if (q.named && !q.bot) n++; return n; }
  tell(p, o) { if (p.ws) try { p.ws.send(JSON.stringify(o)); } catch {} }

  async login(p, m) {
    const st = this.ctx.storage;
    let key = typeof m.key === "string" ? m.key.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20) : "";
    let acct = null, h = null;
    if (key) { h = await sha(key); acct = (this.fresh && this.fresh.get(h)) || await st.get("a:" + h); if (!acct) this.tell(p, { t: "err", text: "That save code wasn't found. Starting a new character." }); }
    if (acct) {
      // the same character can only be online once: the older tab gets kicked
      for (const q of this.players.values()) if (q !== p && q.keyHash === h) { this.tell(q, { t: "kicked" }); try { q.ws.close(4000, "opened elsewhere"); } catch {} this.leave(q); }
    } else {
      key = ""; for (let i = 0; i < 15; i++) key += KEY_CHARS[Math.floor(Math.random() * KEY_CHARS.length)];
      h = await sha(key);
      let name = cleanName(m.name);
      const online = (n) => [...this.players.values()].some((q) => q.acct && q.acct.name.toLowerCase() === n.toLowerCase());
      if (!name || isBad(name) || isReserved(name) || online(name) || (await st.get("n:" + name.toLowerCase()))) {
        do { name = "Player_" + (1000 + Math.floor(Math.random() * 9000)); } while (online(name) || (await st.get("n:" + name.toLowerCase())));
        if (cleanName(m.name)) this.tell(p, { t: "err", text: `That name is taken or not allowed. You're ${name} for now. Change it in 🎨 Me.` });
      }
      const look = Array.isArray(m.look) ? m.look.slice(0, 3).map((v, i) => (Number.isInteger(v) && v >= 0 && v < [SHAPES.length, EYES.length, MOUTHS.length][i] ? v : 0)).concat([0]) : [0, 0, 0, 0];
      acct = { name, hue: Number.isFinite(m.hue) ? Math.floor(clamp(m.hue, 0, 359)) : Math.floor(Math.random() * 360), look,
        bag: {}, wear: {}, lvl: 1, xp: 0, coins: 0, stats: { kills: 0, deaths: 0, fence: 0, combo: 0, boss: 0, sets: 0, lvl: 1, days: 0, ships: 0, ot: 0 },
        seen: [], otxp: 0, tu: [0], quest: null, mutedUntil: 0, created: Date.now() };
      acct.fresh = true; // not written to storage until the first kill, so drive-by visits don't fill the database
      (this.fresh = this.fresh || new Map()).set(h, acct); // ...but a quick reconnect still finds it
      if (this.fresh.size > 500) this.fresh.delete(this.fresh.keys().next().value);
      this.tell(p, { t: "key", key });
    }
    // fill in anything an older save is missing, so a schema change never breaks old characters
    acct.bag = acct.bag || {}; acct.wear = acct.wear || {}; acct.tu = acct.tu || [0]; acct.coins = acct.coins || 0;
    acct.stats = Object.assign({ kills: 0, deaths: 0, fence: 0, combo: 0, boss: 0, sets: 0, lvl: 1, days: 0, ships: 0, ot: 0 }, acct.stats || {});
    acct.seen = Array.isArray(acct.seen) ? acct.seen : Object.keys(acct.bag); acct.otxp = acct.otxp || 0;
    if (!acct.pid) { acct.pid = ""; for (let i = 0; i < 8; i++) acct.pid += KEY_CHARS[Math.floor(Math.random() * KEY_CHARS.length)]; } // public id, for muting an account (not a name)
    acct.look = Array.isArray(acct.look) ? acct.look : [0, 0, 0, 0]; acct.lvl = acct.lvl || 1; acct.xp = acct.xp || 0;
    if (!this.players.has(p.id)) return; // they left while we were loading
    p.acct = acct; p.keyHash = h; p.name = acct.name; p.hue = acct.hue; p.look = acct.look;
    p.lvl = acct.lvl; p.xp = acct.xp; p.kills = acct.stats.kills || 0; p.max = 10 + 2 * (acct.lvl - 1); p.hp = p.max;
    p.wear = SLOTS.map((sl) => { const id = acct.wear[sl]; const i = ITEMS.findIndex((it) => it.id === id); return i >= 0 && acct.bag[id] > 0 ? i : -1; });
    p.named = true;
    this.creditShip(p); // a patch they helped with may have shipped while they were away
    this.checkTitles(p);
    this.sendMe(p);
    const alone = this.humans() === 1;
    this.events.push({ e: "sys", text: alone
      ? `${p.name} joined. You're the only one here. Very realistic MMO launch.`
      : `${p.name} joined. Welcome to the tutorial. It's also the endgame.` });
  }

  sendMe(p) {
    const a = p.acct;
    const today = Math.floor(Date.now() / DAY);
    this.tell(p, { t: "me", name: a.name, hue: a.hue, look: a.look, bag: a.bag, wear: a.wear, stats: this.statsOf(a), titles: a.tu,
      muted: a.mutedUntil > Date.now(), seen: a.seen,
      dayk: a.dk && a.dk.d === today ? a.dk.k : 0,
      sk: this.skills(p), up: a.up || {}, res: a.res || {}, scav: a.scav || { lvl: 1, xp: 0 }, resGiven: this.resBy[p.keyHash] || {}, resShare: this.resShare(this.patch), shipk: this.patchBy[p.keyHash] || 0, share: this.shareOf(this.patch) });
  }

  async rename(p, raw) {
    const st = this.ctx.storage, name = cleanName(raw);
    if (!name) return this.tell(p, { t: "err", text: "Names need 2 to 16 letters or numbers." });
    if (isBad(name)) return this.tell(p, { t: "err", text: "QA rejected that name. Try another." });
    if (isReserved(name)) return this.tell(p, { t: "err", text: "That name sounds official or belongs to the game. Pick another." });
    const old = p.acct.name;
    if (name === old) return;
    const owner = await st.get("n:" + name.toLowerCase());
    if (owner && owner !== p.keyHash) return this.tell(p, { t: "err", text: `"${name}" is already claimed by someone else.` });
    if (old.toLowerCase() !== name.toLowerCase()) await st.delete("n:" + old.toLowerCase());
    p.acct.name = p.name = name; delete p.acct.fresh;
    await st.put({ ["n:" + name.toLowerCase()]: p.keyHash, ["a:" + p.keyHash]: p.acct });
    this.events.push({ e: "sys", text: `${old} is now called ${name}.` });
    this.sendMe(p);
  }

  saveAcct(p) {
    const a = p.acct;
    if (!a || !p.keyHash) return;
    a.lvl = p.lvl; a.xp = p.xp; p.dirty = false;
    if (a.fresh) {
      if (!(a.stats.kills > 0)) return; // nothing worth saving yet
      delete a.fresh;
      this.ctx.storage.get("n:" + a.name.toLowerCase()).then((owner) => {
        if (owner && owner !== p.keyHash) a.name = p.name = "Player_" + (1000 + Math.floor(Math.random() * 9000));
        this.ctx.storage.put({ ["a:" + p.keyHash]: a, ["n:" + a.name.toLowerCase()]: p.keyHash });
      });
    } else this.ctx.storage.put("a:" + p.keyHash, a);
    this.rankHof(p);
  }

  // Hall of Fame: top 10 per category, by lifetime numbers
  rankHof(p) {
    const a = p.acct, s = this.statsOf(a);
    const vals = { kills: s.kills || 0, boss: s.boss || 0, fin: s.fin || 0 };
    for (const [k, v] of Object.entries(vals)) {
      if (!v) continue;
      const list = (this.hof[k] = (this.hof[k] || []).filter((e) => e[2] !== p.keyHash));
      list.push([a.name, v, p.keyHash]); list.sort((x, y) => y[1] - x[1]); list.length = Math.min(list.length, 10);
    }
    this.hofDirty = true;
  }

  // lifetime stats used by titles and goals. "found" only counts items you got yourself, never gifts.
  statsOf(a) {
    const fin = ITEMS.filter((it) => it.r === 4 && a.bag[it.id] > 0).length;
    return { ...a.stats, found: a.seen.length, fin, lvl: Math.max(a.stats.lvl || 1, a.lvl) };
  }

  hasTitle(a, i) {
    const t = TITLES[i]; if (!t || t.cut) return false; if (!t.need) return true;
    const s = this.statsOf(a);
    return Object.entries(t.need).every(([k, v]) => (s[k] || 0) >= v);
  }

  checkTitles(p) {
    const a = p.acct; if (!a) return;
    // Finished items: earned by long goals, never dropped
    const s = this.statsOf(a);
    for (const [id, g] of Object.entries(GOALS)) {
      a.goals = a.goals || {};
      if (a.goals[id] || a.bag[id] > 0 || (s[g.k] || 0) < g.n) continue;
      a.goals[id] = 1; // once per account, ever (this check runs on every title check)
      this.grant(p, ITEMS.findIndex((it) => it.id === id), p, "goal");
    }
    let fresh = false;
    for (let i = 0; i < TITLES.length; i++) if (!a.tu.includes(i) && this.hasTitle(a, i)) {
      a.tu.push(i); this.tell(p, { t: "title", i }); p.dirty = true; fresh = true;
    }
    if (fresh) this.sendMe(p);
  }

  // patches you helped ship (SHIP_KILLS+ kills while it was the next patch)
  creditShip(p) {
    const a = p.acct; if (!a || !a.pk) return;
    if (a.pk.p < this.patch) {
      const ok = a.pk.k >= (a.pk.need || SHIP_KILLS); a.pk = null; p.dirty = true;
      if (ok) { a.stats.ships = (a.stats.ships || 0) + 1; this.tell(p, { t: "err", text: `You helped ship a patch. Patches shipped with your help: ${a.stats.ships}.` }); this.checkTitles(p); }
    }
  }

  stat(p, k, add, max) {
    const a = p.acct; if (!a) return;
    if (max != null) a.stats[k] = Math.max(a.stats[k] || 0, max); else a.stats[k] = (a.stats[k] || 0) + add;
    p.dirty = true; this.checkTitles(p);
  }

  g(p) { const up = (p.acct && p.acct.up) || {}, key = p.wear.join() + JSON.stringify(up); if (!p.gear || p.gearKey !== key) { p.gear = gearOf(p.wear, up); p.gearKey = key; } return p.gear; }

  fullSets(p) {
    const worn = new Set(p.wear.filter((i) => i >= 0).map((i) => ITEMS[i].id));
    return SETS.filter((st) => st.items.every((id) => worn.has(id))).length;
  }

  async report(p, id) {
    const q = this.players.get(id);
    if (!q || !q.acct || q === p || q.bot) return;
    const st = this.ctx.storage, k = "r:" + q.keyHash, now = Date.now();
    const r = (await st.get(k)) || { by: {} };
    r.by[p.keyHash] = [now, p.ipTag || "?"];
    for (const [who, v] of Object.entries(r.by)) if (now - (Array.isArray(v) ? v[0] : v) > DAY) delete r.by[who];
    await st.put(k, r);
    // a mute needs reports from 3 different internet addresses, so one person with spare accounts can't do it
    const addrs = new Set(Object.values(r.by).map((v) => (Array.isArray(v) ? v[1] : "?")));
    this.tell(p, { t: "err", text: `Reported ${q.name}. Thanks. If 3 different players report someone, they're muted for a day.` });
    if (Object.keys(r.by).length >= 3 && addrs.size >= 3 && !(q.acct.mutedUntil > now)) {
      q.acct.mutedUntil = now + DAY; q.dirty = true;
      this.tell(q, { t: "err", text: "You've been muted for a day after reports from several players." });
    }
  }

  give(p, to, item) {
    const q = this.players.get(to), it = ITEMS[item];
    if (!q || !q.acct || q === p || !it || !(p.acct.bag[it.id] > 0)) return;
    if (isBound(it)) return this.tell(p, { t: "err", text: "Trading this wasn't coded. It's bound to you. You earned it, so it stays." });
    if (dist(p, q) > 220) return this.tell(p, { t: "err", text: "Stand closer to give something. Shipping isn't implemented." });
    // one Rare per day to the same person (stops a farm account feeding one main; friends can still trade freely)
    const today = Math.floor(Date.now() / DAY);
    if (it.r === 2) {
      if (!p.acct.rg || p.acct.rg.d !== today) p.acct.rg = { d: today, to: [] };
      if (p.acct.rg.to.includes(q.keyHash)) return this.tell(p, { t: "err", text: `You already gave ${q.name} a Rare today. One Rare per person per day. Commons and Uncommons are unlimited.` });
      p.acct.rg.to.push(q.keyHash);
    }
    p.acct.bag[it.id]--;
    if (p.acct.bag[it.id] <= 0) {
      delete p.acct.bag[it.id];
      const sl = SLOTS.indexOf(it.slot); if (p.wear[sl] === item) { p.wear[sl] = -1; delete p.acct.wear[it.slot]; }
    }
    q.acct.bag[it.id] = (q.acct.bag[it.id] || 0) + 1;
    p.dirty = q.dirty = true;
    this.tell(q, { t: "loot", item, x: Math.round(p.x), y: Math.round(p.y), from: p.name });
    this.events.push({ e: "sys", text: `${p.name} gave ${q.name} ${it.name}. Trading works. Nobody knows why.` });
    this.events.push({ e: "give", from: p.id, to: q.id, item });
    this.sendMe(p); this.sendMe(q); this.checkTitles(q);
  }

  grant(p, item, from, why) {
    const it = ITEMS[item];
    p.acct.bag[it.id] = (p.acct.bag[it.id] || 0) + 1; p.dirty = true;
    if (why !== "goal" && !p.acct.seen.includes(it.id)) p.acct.seen.push(it.id); // found from a drop yourself (not bought, wished or gifted)
    this.tell(p, { t: "loot", item, x: Math.round(from.x), y: Math.round(from.y), why });
    if (it.r >= 2 && why !== "shop" && why !== "gift") this.events.push({ e: "beam", x: Math.round(from.x), y: Math.round(from.y), r: it.r });
    if (it.r >= 2) this.events.push({ e: "sys", text: it.r === 4
      ? `${p.name} EARNED ${it.name}. It's FINISHED. Fully. Everyone stop and look.`
      : it.r === 3 ? `${p.name} found ${it.name} (Unfinished). It doesn't exist. They're wearing it anyway.`
      : `${p.name} found ${it.name} (${RARITY[it.r].name}).` });
    if (it.r === 4) {
      const n = this.finCount[it.id] = (this.finCount[it.id] || 0) + 1; this.dirty = true;
      const ord = n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
      this.events.push({ e: "finished", id: p.id, item, n });
      this.events.push({ e: "sys", text: `${p.name} is the ${ord} player ever to earn ${it.name}.` });
      p.acct.serial = Object.assign(p.acct.serial || {}, { [it.id]: n });
    }
    this.sendMe(p); this.checkTitles(p);
  }

  // how many different people a patch needs: up to 10, but never more than have actually played this past hour
  // (minimum 3, so nobody ever ships one alone). Quiet servers still move; busy ones need a crowd.
  needed(n) {
    const cut = Date.now() - 3600000; let active = 0;
    for (const [k, t] of this.active) { if (t < cut) this.active.delete(k); else active++; }
    if (this.solo) return 1;
    return Math.min(helpersNeeded(n), Math.max(3, active));
  }
  shareOf(n) { return Math.ceil(patchGoal(n) / this.needed(n)); }
  resShare(n) { const g = resGoal(n), k = this.needed(n); return { poly: Math.ceil(g.poly / k), vert: Math.ceil(g.vert / k) }; }
  resDone() { const g = resGoal(this.patch); return this.patchRes.poly >= g.poly && this.patchRes.vert >= g.vert; }
  scavLvl(p) { return (p.acct && p.acct.scav && p.acct.scav.lvl) || 1; }

  // one swing at a tree or rock: a chance to get materials and scavenging XP
  gatherTick(p, nd, now) {
    const a = p.acct, sc = a.scav = a.scav || { lvl: 1, xp: 0 };
    if (now - (p.lastGather || 0) < gatherMs(sc.lvl)) return;
    p.lastGather = now;
    if (this.nodeHp[nd.id] <= 0) { p.gather = null; return this.tell(p, { t: "err", text: `That ${nd.k} is used up. It grows back in a bit. Find another one.` }); }
    const ok = Math.random() < Math.min(0.95, 0.55 + 0.05 * (sc.lvl - NODE_REQ[nd.tier]));
    const kk = nd.k === "tree" ? "poly" : "vert";
    let gain = 0;
    if (ok) {
      gain = NODE_YIELD[nd.tier]; a.res = a.res || {}; a.res[kk] = (a.res[kk] || 0) + gain;
      sc.xp += NODE_XP[nd.tier]; this.stat(p, "gathered", gain);
      while (sc.lvl < SCAV_MAX && sc.xp >= scavNeed(sc.lvl)) { sc.xp -= scavNeed(sc.lvl); sc.lvl++; this.events.push({ e: "slvl", id: p.id, lvl: sc.lvl }); }
      if (--this.nodeHp[nd.id] <= 0) { this.nodeBack[nd.id] = now + 25000 + Math.random() * 15000; this.events.push({ e: "node", id: nd.id, on: 0 }); p.gather = null; }
      p.dirty = true;
    }
    this.events.push({ e: "gat", id: p.id, n: nd.id, ok: ok ? 1 : 0, k: kk, gain });
    this.tell(p, { t: "res", res: a.res || {}, scav: sc });
  }

  // standing at the build site hands in your materials, up to your share of this patch (the rest stay in your pockets)
  deliver(p) {
    const a = p.acct; if (!a || !a.res || this.patch >= LAUNCH + 1) return;
    const g = resGoal(this.patch), sh = this.resShare(this.patch), mine = this.resBy[p.keyHash] = this.resBy[p.keyHash] || { poly: 0, vert: 0 };
    let moved = 0;
    for (const k of ["poly", "vert"]) {
      const room = Math.min(sh[k] - mine[k], g[k] - this.patchRes[k]), give = Math.min(room, a.res[k] || 0);
      if (give <= 0) continue;
      a.res[k] -= give; mine[k] += give; this.patchRes[k] += give; moved += give;
    }
    if (!moved) { if (Object.keys(this.resBy[p.keyHash]).every((k) => !this.resBy[p.keyHash][k])) delete this.resBy[p.keyHash]; return; }
    this.patchNames[p.keyHash] = p.name; this.dirty = true; p.dirty = true;
    if (!a.pk || a.pk.p !== this.patch) a.pk = { p: this.patch, k: 0, need: Math.ceil(this.shareOf(this.patch) / 2) };
    a.pk.k += moved; // materials count toward "helped ship this patch" like kills do
    this.events.push({ e: "deliver", id: p.id, n: moved });
    this.tell(p, { t: "res", res: a.res, scav: a.scav || { lvl: 1, xp: 0 }, given: mine, share: sh });
    this.tryShip();
  }


  // fighting skills come from your level now (no buying): all four grow together, 0 at Lv 1 to 10 at Lv 15
  sk(p, k) { return p.acct ? skillAt(p.lvl) : 0; }
  skills(p) { const v = skillAt(p.lvl); return { swing: v, spin: v, counter: v, dash: v }; }

  // DEV DESK: spare copies + materials -> a stronger version of a held item's one effect.
  // Materials also build the patches, so every upgrade is a choice: you, or the server.
  upgrade(p, i) {
    const it = ITEMS[i]; if (!it || !it.fx || !p.acct) return;
    if (!unlocked(this.patch, "shop")) return this.tell(p, { t: "err", text: "The DEV DESK isn't built yet. It ships in a patch." });
    if (dist(p, SHOP_AT) > 170) return this.tell(p, { t: "err", text: "Walk over to the DEV DESK first." });
    const a = p.acct; a.up = a.up || {}; a.res = a.res || {}; const lv = a.up[it.id] || 0, have = a.bag[it.id] || 0;
    if (lv >= UPG_MAX) return this.tell(p, { t: "err", text: `${it.name} is at v${lv + 1}. That's the final version. (It isn't.)` });
    const sp = upgSpares(lv), cost = upgCost(it.r, lv);
    if (have < 1 + sp) return this.tell(p, { t: "err", text: `v${lv + 2} needs ${sp} spare ${it.name}${sp > 1 ? "s" : ""} (you have ${Math.max(0, have - 1)}). Keep finding copies.` });
    if ((a.res.poly || 0) < cost.poly || (a.res.vert || 0) < cost.vert) return this.tell(p, { t: "err", text: `v${lv + 2} needs ${cost.poly} ▲ polygons and ${cost.vert} ● vertices. You have ${a.res.poly || 0} and ${a.res.vert || 0}. Trees and rocks.` });
    a.res.poly -= cost.poly; a.res.vert -= cost.vert; a.bag[it.id] = have - sp; a.up[it.id] = lv + 1; p.dirty = true; this.stat(p, "upgrades", 1);
    this.tell(p, { t: "err", text: `${it.name} is now v${lv + 2}. Changelog: it hits different.` });
    this.tell(p, { t: "res", res: a.res, scav: a.scav || { lvl: 1, xp: 0 } });
    this.events.push({ e: "skill", id: p.id });
    this.sendMe(p);
  }

  // the one small thing your held item does (and your set bonus), after a normal hit lands
  gearHit(p, t, dmg, crit, now, G) {
    if (G.knock && !isBoss(t.kind) && t.hp > 0) {
      const d = dist(p, t) || 1, k = 26 * G.knock;
      t.x = clamp(t.x + (t.x - p.x) / d * k, 30, W - 30); t.y = clamp(t.y + (t.y - p.y) / d * k, 30, H - 30);
      t.vx = t.vy = 0; t.hopEnd = 0;
    }
    if (G.stun && crit && t.hp > 0) { t.lastBite = Math.max(t.lastBite || 0, now) + 1000 * G.stun; if (t.wind) t.wind.at += 600; this.events.push({ e: "stun", id: t.id }); }
    if (G.cleave) {
      let best = null, bd = 60;
      for (const o of this.slimes.values()) { if (o === t) continue; const dd = dist(o, t) - o.r; if (dd < bd) { bd = dd; best = o; } }
      if (best) {
        const sd = Math.max(1, Math.floor(dmg * G.cleave));
        best.hp -= sd; best.hitters.add(p.id); best.dmgBy.set(p.id, (best.dmgBy.get(p.id) || 0) + sd); best.lastBy = p.id; best.lastHitAt = now;
        this.events.push({ e: "hit", by: p.id, id: best.id, dmg: sd, crit: false, combo: p.combo, cleave: 1 });
        if (best.hp <= 0) this.kill(best);
      }
    }
  }

  // dash: a quick burst away from what you're fighting (or toward where you point). Dodges bites, keeps your target.
  dash(p, now, m) {
    if (p.deadUntil || now - (p.lastDash || 0) < dashCd(this.sk(p, "dash")) - this.g(p).dash) return;
    p.lastDash = now;
    let ang;
    const t = p.target != null && p.target !== "fence" ? this.slimes.get(p.target) : null;
    if (typeof m.x === "number" && typeof m.y === "number" && Math.hypot(m.x - p.x, m.y - p.y) > 5) ang = Math.atan2(m.y - p.y, m.x - p.x);
    else if (t) ang = Math.atan2(p.y - t.y, p.x - t.x);
    else ang = Math.random() * Math.PI * 2;
    const len = 110 + 10 * this.sk(p, "dash");
    p.dash = { vx: Math.cos(ang) * len / 0.18, vy: Math.sin(ang) * len / 0.18, until: now + 180 };
    this.events.push({ e: "dash", id: p.id, a: Math.round(ang * 100) / 100 });
  }

  // spin attack: hit everything nearby, on a cooldown
  spin(p, now) {
    if (p.deadUntil || this.shipAt || dist(p, SPAWN) < SAFE || now - (p.lastSpin || 0) < spinCd(this.sk(p, "spin"))) return;
    p.lastSpin = now;
    const dmg = dmgAt(p.lvl);
    let hit = 0;
    for (const t of [...this.slimes.values()]) {
      if (dist(p, t) > t.r + 80 + 8 * this.sk(p, "spin") + this.g(p).spin) continue;
      t.hp -= dmg; t.hitters.add(p.id); t.dmgBy.set(p.id, (t.dmgBy.get(p.id) || 0) + dmg); t.lastBy = p.id; t.lastHitAt = now; hit++;
      this.events.push({ e: "hit", by: p.id, id: t.id, dmg, crit: false, combo: p.combo });
      if (t.hp <= 0) this.kill(t);
    }
    this.events.push({ e: "spin", id: p.id, hit });
  }

  spawnSlime(boss = false, todo = false, kind = null, at = null) {
    const id = this.nextId++;
    let x, y;
    const wantRing = boss ? -1 : (() => { const q = Math.random(); return q < 0.4 ? 0 : q < 0.75 ? 1 : 2; })();
    for (let i = 0; i < 40; i++) {
      x = 80 + Math.random() * (FENCE_X - 160); y = 80 + Math.random() * (H - 160);
      if (Math.hypot(x - SPAWN.x, y - SPAWN.y) > (boss ? 300 : 160) && (wantRing < 0 || ringOf(x, y) === wantRing)) break;
    }
    if (todo) { x = FENCE_X + 120 + Math.random() * (W - FENCE_X - 200); y = 80 + Math.random() * (H - 160); }
    if (at) { x = clamp(at.x + (Math.random() - 0.5) * 50, 30, FENCE_X - 30); y = clamp(at.y + (Math.random() - 0.5) * 50, 30, H - 30); }
    const n = Math.max(1, this.humans());
    if (kind == null) {
      if (boss) kind = unlocked(this.patch, "boss2") && Math.floor(this.total / BOSS_EVERY) % 2 === 0 ? BOSS2 : BOSS;
      else if (todo) kind = TODO;
      else {
        // each ring has its own mix: the meadow by spawn is plain slimes; the far ring has the weird ones
        const ring = ringOf(x, y), q = unlocked(this.patch, "enemies") ? Math.random() : 1;
        kind = ring === 1 ? (q < 0.2 ? FAST : q < 0.32 ? BIG : -1) : ring === 2 ? (q < 0.22 ? FAST : q < 0.47 ? BIG : q < 0.67 ? LAG : -1) : -1;
        if (kind === -1) kind = Math.floor(Math.random() * SLIME_NAMES.length);
      }
    }
    const K = kindOf(kind);
    const hp = kind === BOSS ? 100 + 150 * n : kind === BOSS2 ? 120 + 170 * n : kind === RELEASE ? 300 + 220 * n : K.hp;
    const tier = isBoss(kind) || kind === BUG ? 0 : ringOf(x, y), T = TIER[tier];
    const s = { id, x, y, hp: isBoss(kind) ? hp : Math.round(hp * T.hp), kind, r: K.r, dmg: K.dmg + (K.dmg ? T.dmg : 0), tier, hitters: new Set(), dmgBy: new Map() };
    if (kind === BUG) { s.until = Date.now() + 90000; }
    s.max = s.hp; s.hopAt = Date.now() + Math.random() * 1500; s.vx = 0; s.vy = 0; s.hopEnd = 0; s.lastBite = 0;
    s.lagAt = Date.now() + 2000 + Math.random() * 1500; s.slamAt = Date.now() + 3000; s.slam = null; s.wind = null; s.slams = 0; s.lastHitAt = Date.now();
    this.slimes.set(id, s);
    if (kind === BOSS) this.events.push({ e: "sys", text: "MISSING_TEXTURE has spawned. It glitches pink squares onto the ground: step out of them. Team up." });
    if (kind === RELEASE) this.events.push({ e: "sys", text: `RELEASE_CANDIDATE_1.0 has spawned. Version 1.0 only ships if ${LAUNCH_CROWD} or more people really help beat it. Call everyone.` });
    if (kind === BOSS2) this.events.push({ e: "sys", text: "FINAL_BOSS_v0.1 has spawned. It only has one attack. Step out of the red circle." });
    return s;
  }

  tick() {
    try { this.step(); } catch (err) { console.log("tick error", err && err.stack); this.events = []; }
  }

  step() {
    const now = Date.now(), dt = TICK / 1000;
    const alive = [...this.players.values()].filter((p) => p.named);
    // keep the slime population matched to how many people are around
        const want = Math.min(32, 6 + 2 * alive.length);
    let normal = 0, todos = 0;
    for (const s of this.slimes.values()) { if (s.kind === TODO) todos++; else if (!isBoss(s.kind)) normal++; }
    if (normal < want && Math.random() < 0.3) this.spawnSlime();
    this.worldEvents(now);
    if (this.patch === LAUNCH && this.patchKills >= patchGoal(LAUNCH) && this.resDone() && now >= (this.releaseAt || 0) && this.humans() > 0 && ![...this.slimes.values()].some((sl) => sl.kind === RELEASE)) { this.releaseAt = now + 600000; this.spawnSlime(true, false, RELEASE); }
    this.botBrains(now);
    if (this.shipAt && now >= this.shipAt) { this.shipAt = 0; this.doShip(); }
    for (let i = 0; i < NODES.length; i++) if (this.nodeHp[i] <= 0 && now >= this.nodeBack[i]) { this.nodeHp[i] = NODE_HP[NODES[i].tier]; this.events.push({ e: "node", id: i, on: 1 }); }
    const f = this.fence;
    if (f.openUntil) {
      if (todos < Math.min(16, 4 + alive.length) && Math.random() < 0.3) this.spawnSlime(false, true);
      if (now >= f.openUntil) this.closeArea2();
    }

    // players
    for (const p of this.players.values()) {
      if (p.deadUntil) {
        if (now >= p.deadUntil) {
          p.deadUntil = 0; p.hp = p.max; p.x = SPAWN.x + (Math.random() - 0.5) * 100; p.y = SPAWN.y + 10 + Math.random() * 40; p.tx = p.ty = null; p.target = null; p.gather = null;
        }
        continue;
      }
      if (p.dash) {
        if (now >= p.dash.until) p.dash = null;
        else {
          p.x = clamp(p.x + p.dash.vx * dt, 20, W - 20); p.y = clamp(p.y + p.dash.vy * dt, 20, H - 20);
          if (!this.fence.openUntil && p.x > FENCE_X - 16) p.x = FENCE_X - 16;
          continue;
        }
      }
      // walking past the build site hands in your materials
      if (p.acct && !p.bot && p.acct.res && (p.acct.res.poly || p.acct.res.vert) && Math.abs(p.x - BUILD_AT.x) < 70 && Math.abs(p.y - BUILD_AT.y) < 60 && now - (p.lastDeliver || 0) > 500) { p.lastDeliver = now; this.deliver(p); }
      // scavenging: walk up to the tree or rock, then swing at it
      if (p.gather != null && p.target == null && p.tx == null) {
        const nd = NODES[p.gather], d = Math.hypot(nd.x - p.x, nd.y - p.y);
        if (d > 34) { const step = SPEED * dt; p.x += (nd.x - p.x) / d * Math.min(step, d - 30); p.y += (nd.y - p.y) / d * Math.min(step, d - 30); }
        else if (p.acct) this.gatherTick(p, nd, now);
        if (!this.fence.openUntil && p.x > FENCE_X - 16) p.x = FENCE_X - 16;
        if (p.hp < p.max && now - p.lastHurt > 4000 && now - p.lastRegen > 1500) { p.hp++; p.lastRegen = now; }
        continue;
      }
      let gx = p.tx, gy = p.ty;
      const t = p.target === "fence" ? (this.fence.openUntil ? null : { x: FENCE_X, y: clamp(p.y, 40, H - 40), r: 4, fence: true })
        : p.target != null ? this.slimes.get(p.target) : null;
      if (p.target != null && !t) p.target = null;
      if (t) {
        const d = dist(p, t);
        if (d <= t.r + REACH + this.g(p).reach) {
          gx = null;
          // no fighting from inside the tutorial circle: slimes can't bite you there, so you can't hit them either
          if (dist(p, SPAWN) < SAFE) { gx = t.x; gy = t.y; } // keep walking out of the circle toward it, then swing
          else if (!this.shipAt && now - p.lastHit >= swingMs(this.sk(p, "swing")) - this.g(p).quick) {
            const swing = swingMs(this.sk(p, "swing")) - this.g(p).quick;
            // keep swinging without a break to build a combo; every 5th hit in a combo is a crit
            const tid = t.fence ? "fence" : t.id;
            p.combo = now - p.lastHit < 2500 && (p.comboOn === tid || p.comboFree) ? p.combo + 1 : 1;
            p.comboOn = tid; p.comboFree = false;
            // carry the leftover time so swing speed isn't rounded to the 100ms server tick
            p.lastHit = now - p.lastHit < swing + 100 ? p.lastHit + swing : now;
            const counter = p.counterUntil > now; if (counter) p.counterUntil = 0;
            const G = this.g(p), crit = counter || p.combo % 5 === 0 || Math.random() < 0.08 + G.crit;
            const base = dmgAt(p.lvl), dmg = counter ? Math.round(base * 3 * (1 + 0.3 * this.sk(p, "counter"))) : base * (crit ? 2 : 1);
            this.stat(p, "combo", 0, p.combo);
            if (t.fence) {
              this.fence.hp -= dmg; this.stat(p, "fence", 1);
              this.events.push({ e: "fhit", by: p.id, y: Math.round(t.y), dmg, crit, combo: p.combo });
              if (this.fence.hp <= 0) this.openArea2(p);
            } else {
              t.hp -= dmg; t.hitters.add(p.id); t.dmgBy.set(p.id, (t.dmgBy.get(p.id) || 0) + dmg); t.lastBy = p.id; t.lastHitAt = now;
              this.events.push({ e: "hit", by: p.id, id: t.id, dmg, crit, combo: p.combo, counter: counter ? 1 : 0 });
              this.gearHit(p, t, dmg, crit, now, G);
              if (t.hp <= 0) this.kill(t);
            }
          }
        } else { gx = t.x; gy = t.y; }
      }
      if (gx != null) {
        const dx = gx - p.x, dy = gy - p.y, d = Math.hypot(dx, dy), step = SPEED * dt;
        if (d <= step) { p.x = gx; p.y = gy; if (!t) { p.tx = p.ty = null; } }
        else { p.x += (dx / d) * step; p.y += (dy / d) * step; }
      }
      if (!this.fence.openUntil && p.x > FENCE_X - 16) p.x = FENCE_X - 16; // the fence is solid until it breaks
      if (p.acct && !p.bot) for (let i = 0; i < SECRETS.length; i++) {
        const sc = SECRETS[i];
        if (Math.abs(p.x - sc.x) < 45 && Math.abs(p.y - sc.y) < 45 && !(p.acct.found2 || []).includes(i)) {
          (p.acct.found2 = p.acct.found2 || []).push(i);
          this.stat(p, "secrets", 1);
          if (i === 2) { const oi = ITEMS.findIndex((it) => it.id === "oobcone"); if (oi >= 0 && !(p.acct.bag.oobcone > 0)) this.grant(p, oi, sc, "secret"); }
          this.tell(p, { t: "secret", i, n: p.acct.found2.length, of: SECRETS.length });
        }
      }
      if (p.hp < p.max && now - p.lastHurt > 4000 && now - p.lastRegen > 1500) { p.hp++; p.lastRegen = now; }
    }

    // slimes
    for (const s of this.slimes.values()) {
      if (this.shipAt) { s.wind = null; continue; } // everything holds still while a patch deploys
      if (s.wind) { s.hopEnd = 0; s.hopAt = Math.max(s.hopAt, now + 300); } // winding up a bite: it holds still
      else if (now >= s.hopAt) {
        const K = kindOf(s.kind);
        let near = null, nd = isBoss(s.kind) ? 320 : s.kind === FAST ? 240 : 190;
        for (const p of alive) { if (p.deadUntil) continue; const d = dist(p, s); if (d < nd) { nd = d; near = p; } }
        let ang = Math.random() * Math.PI * 2, sp = K.sp[0];
        if (near) { ang = Math.atan2(near.y - s.y, near.x - s.x) + (s.kind === BUG ? Math.PI + (Math.random() - 0.5) : 0); sp = K.sp[1]; }
        s.vx = Math.cos(ang) * sp; s.vy = Math.sin(ang) * sp;
        s.hopEnd = now + 450; s.hopAt = now + (s.kind === FAST || s.kind === BUG ? 550 : near ? 900 : 1400 + Math.random() * 1600);
      }
      // a boss nobody is fighting gets bored and unloads after 2 minutes, so the next one can spawn
      if ((s.kind === BOSS || s.kind === BOSS2) && now - s.lastHitAt > 120000) {
        this.slimes.delete(s.id);
        this.events.push({ e: "sys", text: `${s.kind === BOSS ? "MISSING_TEXTURE" : "FINAL_BOSS_v0.1"} got no attention for 2 minutes and unloaded itself. Memory freed.` });
        this.events.push({ e: "kill", id: s.id, x: Math.round(s.x), y: Math.round(s.y), boss: false, helpers: 0, total: this.total, by: [], xp: 0, escaped: true });
        continue;
      }
      if (s.kind === BUG && now > s.until) {
        this.slimes.delete(s.id);
        this.events.push({ e: "sys", text: "THE BUG escaped to production. It'll be fine." });
        if (this.event && this.event.kind === "bug") this.event = null;
        this.events.push({ e: "kill", id: s.id, x: Math.round(s.x), y: Math.round(s.y), boss: false, helpers: 0, total: this.total, by: [], xp: 0, escaped: true });
        continue;
      }
      // lag_slime rubber-bands: every few seconds it snaps somewhere nearby, like a bad connection
      if (s.kind === LAG && now >= s.lagAt) {
        const a = Math.random() * Math.PI * 2;
        s.x = clamp(s.x + Math.cos(a) * 140, 30, FENCE_X - 30); s.y = clamp(s.y + Math.sin(a) * 140, 30, H - 30);
        s.lagAt = now + 1800 + Math.random() * 1600;
        this.events.push({ e: "lag", id: s.id });
      }
      // FINAL_BOSS_v0.1 has one attack: a slam with a red warning circle you can step out of.
      // ENEMY_TODO in Area 2 does a small version ("AI: TODO, so it just jumps on you").
      if (s.kind === BOSS || s.kind === BOSS2 || s.kind === RELEASE || s.kind === TODO) {
        const small = s.kind === TODO, sq = s.kind === BOSS, R = small ? 60 : sq ? 85 : 105, hurt = small || sq ? 2 : 3;
        if (!s.slam && now >= s.slamAt) {
          let tgt = null, td = small ? 260 : 420;
          for (const p of alive) { if (p.deadUntil || dist(p, SPAWN) < SAFE + 60) continue; const d = dist(p, s); if (d < td) { td = d; tgt = p; } }
          if (tgt) {
            s.slam = { x: Math.round(tgt.x), y: Math.round(tgt.y), at: now + (small ? 900 : 1300) };
            this.events.push({ e: "tele", x: s.slam.x, y: s.slam.y, r: R, ms: small ? 900 : 1300, sq: sq ? 1 : 0 });
            // every third glitch, MISSING_TEXTURE "loads" a ring of half-rendered slimes around itself
            if (sq && ++s.slams % 3 === 0) {
              for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; const c = this.spawnSlime(false, false, Math.floor(Math.random() * SLIME_NAMES.length), { x: s.x + Math.cos(a) * 90, y: s.y + Math.sin(a) * 90 }); c.hp = c.max = 2; }
              if (s.slams === 3) this.events.push({ e: "sys", text: "MISSING_TEXTURE is loading assets. Four of them loaded halfway." });
            }
          }
          s.slamAt = now + (small ? 3500 + Math.random() * 2500 : sq ? 3200 : 3800);
        }
        if (s.slam && now >= s.slam.at) {
          const sl = s.slam; s.slam = null; let hit = 0;
          if (small) { s.x = clamp(sl.x, FENCE_X + 30, W - 30); s.y = clamp(sl.y, 30, H - 30); } // it lands where it aimed
          for (const p of alive) {
            if (p.deadUntil || dist(p, SPAWN) < SAFE || (sq ? Math.max(Math.abs(p.x - sl.x), Math.abs(p.y - sl.y)) > R : Math.hypot(p.x - sl.x, p.y - sl.y) > R)) continue;
            p.hp -= hurt; p.lastHurt = now; p.combo = 0; hit++;
            this.events.push({ e: "ow", id: p.id, dmg: hurt });
            if (p.hp <= 0) { p.hp = 0; p.deadUntil = now + 3000; p.target = null; this.events.push({ e: "die", id: p.id }); this.stat(p, "deaths", 1); }
          }
          this.events.push({ e: "slam", x: sl.x, y: sl.y, r: R, hit });
        }
      }
      if (now < s.hopEnd) {
        // slimes stay on their own side of the fence, open or not
        const lo = s.kind === TODO ? FENCE_X + 30 : 30, hi = s.kind === TODO ? W - 30 : FENCE_X - 30;
        s.x = clamp(s.x + s.vx * dt, lo, hi); s.y = clamp(s.y + s.vy * dt, 30, H - 30);
      }
      // the spawn circle is a safe zone: slimes respect the tutorial
      // bosses are leashed well away from the respawn plaza so people who just died aren't slammed again
      const sd = Math.hypot(s.x - SPAWN.x, s.y - SPAWN.y), keep = (isBoss(s.kind) ? BOSS_LEASH : SAFE + 24) + s.r;
      if (sd < keep) { const k = keep / (sd || 1); s.x = SPAWN.x + (s.x - SPAWN.x) * k; s.y = SPAWN.y + (s.y - SPAWN.y) * k; }
      // biting: a slime squashes and flashes for about half a second first. Step out of reach and it misses,
      // and your next hit is a guaranteed counter crit (your combo stays alive).
      if (s.wind) {
        if (now >= s.wind.at) {
          const p = this.players.get(s.wind.pid), aoe = s.wind.aoe; s.wind = null; s.lastBite = now;
          if (aoe) {
            // SLIME_BIG_PLACEHOLDER's ground pound hits everyone in the ring, not just its target: dash out or spread out
            let hitTarget = false;
            for (const q of alive) {
              if (q.deadUntil || dist(q, SPAWN) < SAFE || dist(q, s) >= aoe) continue;
              if (q === p) hitTarget = true;
              const pd = Math.max(1, s.dmg - this.g(q).armor);
              q.hp -= pd; q.lastHurt = now; q.combo = 0; this.events.push({ e: "ow", id: q.id, dmg: pd });
              if (q.hp <= 0) { q.hp = 0; q.deadUntil = now + 3000; q.target = null; this.events.push({ e: "die", id: q.id }); this.stat(q, "deaths", 1); }
            }
            this.events.push({ e: "pound", id: s.id, r: aoe });
            if (p && !hitTarget && !p.deadUntil && dist(p, SPAWN) >= SAFE) { p.counterUntil = now + this.g(p).counter; this.stat(p, "dodges", 1); this.events.push({ e: "dodge", id: p.id, sid: s.id }); }
          } else if (p && !p.deadUntil && dist(p, SPAWN) >= SAFE && dist(p, s) < s.r + 24) {
            p.hp -= s.dmg; p.lastHurt = now; p.combo = 0;
            this.events.push({ e: "ow", id: p.id, dmg: s.dmg });
            if (p.hp <= 0) {
              p.hp = 0; p.deadUntil = now + 3000; p.target = null;
              this.events.push({ e: "die", id: p.id }); this.stat(p, "deaths", 1);
            }
          } else if (p && !p.deadUntil && dist(p, SPAWN) >= SAFE) { // hiding in the safe circle isn't a dodge
            p.counterUntil = now + this.g(p).counter; this.stat(p, "dodges", 1);
            this.events.push({ e: "dodge", id: p.id, sid: s.id });
          }
        }
      } else if (s.dmg > 0 && now - s.lastBite > 1300) {
        for (const p of alive) {
          if (p.deadUntil || dist(p, SPAWN) < SAFE || dist(p, s) >= s.r + 14) continue;
          const ms = s.kind === FAST ? 450 : s.kind === BIG ? 800 : isBoss(s.kind) ? 650 : 550, aoe = s.kind === BIG ? s.r + 46 : 0;
          s.wind = { at: now + ms, pid: p.id, aoe };
          this.events.push({ e: "wind", id: s.id, pid: p.id, ms, r: aoe || undefined });
          break;
        }
      }
    }

    if (now - this.lastSave > 5000) {
      if (this.dirty) this.save();
      this.lastSave = now;
      for (const q of this.players.values()) if (q.dirty) this.saveAcct(q);
    }
    this.broadcast();
  }

  kill(s) {
    this.slimes.delete(s.id);
    this.total++; this.dirty = true;
    const today = Math.floor(Date.now() / DAY);
    // count this kill toward the patch being built and toward today's play, for everyone who hit it
    // who really earned this kill: a real share of the damage (40% of a slime, or a fair share of a boss). Single taps get XP only.
    const humanHitters = [...s.hitters].filter((pid) => { const q = this.players.get(pid); return q && !q.bot; }).length || 1;
    const need = isBoss(s.kind) || s.kind === BUG ? Math.max(1, Math.ceil(s.max * Math.min(0.1, 0.6 / humanHitters))) : Math.ceil(s.max * 0.4);
    // teammates still attacking it when it dies keep the kill; only tap-and-run players miss out
    const big = isBoss(s.kind) || s.kind === BUG;
    const earned = (pid) => (s.dmgBy.get(pid) || 0) >= need || (!big && this.players.get(pid) && this.players.get(pid).target === s.id);
    for (const pid of s.hitters) {
      if (!earned(pid)) continue;
      const a = this.players.get(pid) && this.players.get(pid).acct; if (!a) continue;
      if (!this.players.get(pid).bot && (a.stats.kills || 0) >= BAR_MIN_KILLS) this.active.set(this.players.get(pid).keyHash, Date.now());
      if (!a.dk || a.dk.d !== today) a.dk = { d: today, k: 0 };
      if (++a.dk.k === DAY_KILLS) { a.stats.days = (a.stats.days || 0) + 1; }
    }
    // the patch bar: each kill moves it once, credited to the biggest helper who still has share left.
    // Nobody can fill more than their share, so a patch always needs several different people. Bots never count.
    const goal = patchGoal(this.patch), share = this.shareOf(this.patch);
    const nextShare = this.shareOf(this.patch + 1);
    if (this.patchKills < goal) {
      let capped = null, credited = false; const warms = [];
      for (const pid of [...s.hitters].filter(earned).sort((x, y) => (s.dmgBy.get(y) || 0) - (s.dmgBy.get(x) || 0))) {
        const p = this.players.get(pid); if (!p || !p.acct || p.bot) continue;
        if ((p.acct.stats.kills || 0) < BAR_MIN_KILLS) { warms.push(p); continue; }
        const c = this.patchBy[p.keyHash] || 0;
        if (c >= share) { capped = capped || p; continue; }
        this.patchBy[p.keyHash] = c + 1; this.patchKills++; credited = true; this.patchNames[p.keyHash] = p.name;
        if (!p.acct.pk || p.acct.pk.p !== this.patch) p.acct.pk = { p: this.patch, k: 0, need: Math.ceil(share / 2) };
        p.acct.pk.k++;
        this.tell(p, { t: "bar", x: Math.round(s.x), y: Math.round(s.y), mine: c + 1, share });
        break;
      }
      if (!credited && capped) {
        // your share is full: extra kills are banked for the next patch, so no kill is wasted
        const b = this.patchNext[capped.keyHash] || 0;
        if (b < nextShare) this.patchNext[capped.keyHash] = b + 1;
        this.patchNames[capped.keyHash] = capped.name;
        this.tell(capped, { t: "bar", x: Math.round(s.x), y: Math.round(s.y), mine: share, share, banked: Math.min(nextShare, b + 1), nextShare });
        if (capped.barCapTold !== this.patch) {
          capped.barCapTold = this.patch;
          this.tell(capped, { t: "err", text: `Your part of this patch is done (${share} kills). It needs ${this.needed(this.patch)} people, so nobody ships one alone. Your extra kills now count toward the NEXT patch.` });
        }
      }
      // new players see their warm-up count on every kill, even when someone else got the bar credit
      for (const w of warms) this.tell(w, { t: "bar", x: Math.round(s.x), y: Math.round(s.y), warm: w.acct.stats.kills || 0, need: BAR_MIN_KILLS });
    }
    this.tryShip();
    const boss = isBoss(s.kind);
    this.killRewards(s, big, need, earned, boss);
  }

  // a patch ships when its kills AND its materials are all in
  tryShip() {
    if (this.shipAt) return;
    if (this.patchKills >= patchGoal(this.patch) && this.resDone() && this.patch !== LAUNCH) {
      // patch day: a 5 second countdown where the whole server stops to watch it deploy
      this.shipAt = Date.now() + 5000;
      this.events.push({ e: "deploy", name: patchName(this.patch), ms: 5000 });
    }
  }

  doShip() {
    {
      const n = this.patch;
      const score = { ...this.patchBy };
      for (const [k, v] of Object.entries(this.resBy)) score[k] = (score[k] || 0) + (v.poly || 0) + (v.vert || 0);
      const credits = Object.entries(score).sort((x, y) => y[1] - x[1]).map(([k, c]) => [this.patchNames[k] || "someone", c]);
      this.plaques[n] = credits.slice(0, 3).map((c) => c[0]);
      this.patchKills = 0; this.patch++; this.patchBy = {}; this.patchNames = {}; this.patchRes = { poly: 0, vert: 0 }; this.resBy = {};
      // banked kills from players whose share was full move into the new patch (still capped by its share)
      const ns = this.shareOf(this.patch);
      for (const [k, v] of Object.entries(this.patchNext)) {
        const c = Math.min(v, ns); this.patchBy[k] = c; this.patchKills += c;
        // banked kills count as helping ship this patch too
        for (const q of this.players.values()) if (q.acct && q.keyHash === k) { q.acct.pk = { p: this.patch, k: c, need: Math.ceil(ns / 2) }; q.dirty = true; }
      }
      this.patchNext = {};
      const note = PATCHES[n] ? PATCHES[n].note : HOTFIX_NOTES[(n - PATCHES.length) % HOTFIX_NOTES.length];
      if (!PATCHES[n] && !this.event) { this.event = { kind: "hotfix", until: Date.now() + 300000 }; this.events.push({ e: "event", kind: "hotfix", ms: 300000 }); }
      this.events.push({ e: "patch", n: this.patch, name: patchName(n), note, credits: credits.slice(0, 14), helpers: credits.length, plaque: this.plaques[n] });
      this.events.push({ e: "sys", text: `Patch ${patchName(n)} shipped. ${note}` });
      for (const q of this.players.values()) this.creditShip(q);
    }
  }

  killRewards(s, big, need, earned, boss) {
    const T = TIER[s.tier || 0], xp = kindOf(s.kind).xp * T.xp;
    for (const pid of s.hitters) {
      const p = this.players.get(pid);
      if (!p) continue;
      if (p.comboOn === s.id) p.comboFree = true; // finishing a slime keeps your combo going into the next one
      const helped = earned(pid);
      if (helped) p.kills++;
      if (p.acct && !helped && !big) { /* a drive-by tap on a normal slime: XP only */ }
      else if (p.acct) {
        const G = this.g(p);
        if (helped && G.heal && !p.deadUntil) p.hp = Math.min(p.max, p.hp + G.heal);
        // Greedy items: some kills drop a polygon, so fighters help build too
        if (helped && G.coin && Math.random() < 0.25 * G.coin) { const r = p.acct.res = p.acct.res || {}; r.poly = (r.poly || 0) + 1; p.dirty = true; this.tell(p, { t: "res", res: r, scav: p.acct.scav || { lvl: 1, xp: 0 }, drop: 1, x: Math.round(s.x), y: Math.round(s.y) }); }
        if (helped) { this.stat(p, "kills", 1); }
        if (boss && helped) { this.stat(p, "boss", 1); }
        const evx = this.event && (this.event.kind === "hotfix") ? 2 : 1;
        if (big && !helped) this.tell(p, { t: "err", text: `You barely touched it, so you got XP only. Do at least ${need} damage for real loot.` });
        else if (s.kind === TODO && Math.random() < A2_DROP) { const pool = ITEMS.map((it, i) => i).filter((i) => ITEMS[i].a2); this.grant(p, pool[Math.floor(Math.random() * pool.length)], s, "area2"); }
        else if (s.kind === TODO && (p.acct.stats.boss || 0) >= EPIC_BOSSES && Math.random() < 0.03) this.grant(p, (() => { const pool = ITEMS.map((it, i) => i).filter((i) => ITEMS[i].r === 3); return pool[Math.floor(Math.random() * pool.length)]; })(), s, "area2");
        else this.loot(p, big || (s.tier === 2 && Math.random() < 0.08), Math.min(0.9, evx * T.drop * (s.kind === TODO ? 0.5 : (s.kind === BIG || s.kind === LAG) ? 0.35 : DROP_CHANCE)), s, T.maxR);
      }
      if (p.lvl >= LEVEL_CAP) continue; // max level: nothing more to earn here but loot and patches
      p.xp += xp;
      while (p.lvl < LEVEL_CAP && p.xp >= xpFor(p.lvl)) {
        p.xp -= xpFor(p.lvl); p.lvl++; p.max += 2; p.hp = p.max; this.stat(p, "lvl", 0, p.lvl);
        this.events.push({ e: "lvl", id: p.id, lvl: p.lvl, cap: p.lvl >= LEVEL_CAP });
      }
    }
    this.events.push({ e: "kill", id: s.id, x: Math.round(s.x), y: Math.round(s.y), boss, helpers: s.hitters.size, total: this.total, by: [...s.hitters], xp });
    if (s.kind === BIG) {
      // split() was never implemented. It splits anyway.
      for (let i = 0; i < 3; i++) { const c = this.spawnSlime(false, false, Math.floor(Math.random() * SLIME_NAMES.length), s); c.hp = c.max = 2; }
    }
    if (s.kind === BUG) {
      this.events.push({ e: "sys", text: `THE BUG was squashed by ${s.hitters.size} ${s.hitters.size === 1 ? "person" : "people"}. Everyone who really helped got boss loot (a good shot at Rare). Marked as fixed.` });
      if (this.event && this.event.kind === "bug") this.event = null;
    } else if (s.kind === RELEASE) {
      const crowd = [...s.hitters].filter((pid) => { const q = this.players.get(pid); return q && q.acct && !q.bot && earned(pid); });
      const places = new Set(crowd.map((pid) => this.players.get(pid).ipTag || pid)).size;
      if ((this.solo || (crowd.length >= LAUNCH_CROWD && places >= 3)) && this.patch === LAUNCH) {
        this.plaques[LAUNCH] = crowd.slice(0, 3).map((pid) => this.players.get(pid).name);
        this.patch++; this.patchKills = 0; this.patchBy = {}; this.patchNext = {}; this.patchNames = {}; this.patchRes = { poly: 0, vert: 0 }; this.resBy = {}; this.dirty = true;
        this.events.push({ e: "patch", n: this.patch, name: "1.0", note: "VERSION 1.0 IS OUT. The game is finished. (It is not. But it shipped.)", launch: true, credits: crowd.map((pid) => [this.players.get(pid).name, 1]), helpers: crowd.length, plaque: this.plaques[LAUNCH] });
        this.events.push({ e: "sys", text: `${crowd.length} people beat RELEASE_CANDIDATE_1.0 together. VERSION 1.0 HAS SHIPPED. Everyone who helped is now a Day One player.` });
        for (const pid of crowd) { const q = this.players.get(pid); this.stat(q, "launch", 1); }
        for (const q of this.players.values()) this.creditShip(q);
      } else {
        this.releaseAt = Date.now() + 600000;
        this.events.push({ e: "sys", text: `RELEASE_CANDIDATE_1.0 went down, but only ${crowd.length} of ${LAUNCH_CROWD} people really helped${crowd.length >= LAUNCH_CROWD ? " (from too few different places)" : ""}. Launch delayed. It comes back in 10 minutes. Bring more people.` });
      }
    } else if (s.kind === BOSS2) {
      this.events.push({ e: "sys", text: `FINAL_BOSS_v0.1 defeated by ${s.hitters.size} ${s.hitters.size === 1 ? "person" : "people"}. The real final boss is in the sequel. Everyone who really helped got boss loot (a good shot at Rare).` });
    } else if (boss) {
      this.events.push({ e: "sys", text: `MISSING_TEXTURE defeated by ${s.hitters.size} ${s.hitters.size === 1 ? "person" : "people"}. Everyone who really helped got boss loot (a good shot at Rare). Some of it isn't finished.` });
    } else if (this.total % 100 === 0) {
      this.events.push({ e: "sys", text: `Everyone together has now killed ${this.total} slimes. New areas added by the devs: 0.` });
    }
    let hasBoss = false;
    for (const o of this.slimes.values()) if (isBoss(o.kind)) hasBoss = true;
    if (!hasBoss && this.total % BOSS_EVERY === 0) this.spawnSlime(true);
  }

  loot(p, boss, chance, s, maxR = 2) {
    if (!boss && Math.random() >= chance) return;
    this.grant(p, rollItem(Math.random, boss, boss && (p.acct.stats.boss || 0) >= EPIC_BOSSES, maxR), s);
  }

  // the only timed event left: a hotfix's double loot after a patch ships past the list
  worldEvents(now) {
    const ev = this.event;
    if (ev && now >= ev.until) {
      this.event = null;
      if (ev.kind === "hotfix") this.events.push({ e: "sys", text: "The hotfix was rolled back. Loot odds are back to normal." });
    }
  }

  // ---------- placeholder players: when fewer than 3 people are on, up to 2 bots wander and fight ----------
  botBrains(now) {
    const humans = this.humans(), want = humans === 0 ? 0 : Math.max(0, Math.min(2, 3 - humans));
    let bots = [...this.players.values()].filter((q) => q.bot);
    while (bots.length > want) { const b = bots.pop(); this.players.delete(b.id); }
    while (bots.length < want) {
      const name = BOT_NAMES.find((n) => !bots.some((b) => b.name === n + " (bot)")) || "NPC_Player_99";
      const b = { id: this.nextId++, ws: null, bot: true, name: name + " (bot)", hue: Math.floor(Math.random() * 360),
        x: SPAWN.x + (Math.random() - 0.5) * 140, y: SPAWN.y + 30, tx: null, ty: null, target: null, hp: 10, max: 10, lvl: 1, xp: 0, kills: 0,
        lastHit: 0, lastHurt: 0, lastRegen: 0, deadUntil: 0, named: true, wear: [Math.floor(Math.random() * 3), -1, -1, -1, -1],
        look: [Math.floor(Math.random() * SHAPES.length), 5, 0, 0], combo: 0, emote: -1, emoteAt: 0, acct: null, thinkAt: 0, chatAt: now + 20000 + Math.random() * 40000 };
      this.players.set(b.id, b); bots.push(b);
    }
    for (const b of bots) {
      if (b.deadUntil || now < b.thinkAt) continue;
      b.thinkAt = now + 800 + Math.random() * 1200;
      if (b.target == null || !this.slimes.has(b.target)) {
        let best = null, bd = 420;
        for (const s of this.slimes.values()) { if (s.kind === TODO || isBoss(s.kind) && this.humans() < 2) continue; const d = dist(b, s); if (d < bd) { bd = d; best = s; } }
        if (best && Math.random() < 0.8) { b.target = best.id; b.tx = null; }
        else { b.target = null; b.tx = clamp(b.x + (Math.random() - 0.5) * 400, 60, FENCE_X - 60); b.ty = clamp(b.y + (Math.random() - 0.5) * 400, 60, H - 60); }
      }
      if (now > b.chatAt) { b.chatAt = now + 45000 + Math.random() * 60000; this.events.push({ e: "say", id: b.id, text: BOT_LINES[Math.floor(Math.random() * BOT_LINES.length)] }); }
      if (Math.random() < 0.03) { b.emote = Math.floor(Math.random() * EMOTES); b.emoteAt = now; this.events.push({ e: "emote", id: b.id, k: b.emote }); }
    }
  }

  openArea2(p) {
    const f = this.fence;
    f.hp = 0; f.openUntil = 8.64e15; f.perm = true; this.dirty = true; // once the server breaks it, it stays broken
    this.ctx.storage.put("a2perm", true);
    for (const q of this.players.values()) if (q.target === "fence") q.target = null;
    this.events.push({ e: "area2", open: true, by: p.id });
    this.events.push({ e: "sys", text: `${p.name} landed the last hit. The fence is down. AREA 2 is open FOR GOOD. The devs gave up on the fence. Its slimes are tough and drop better loot.` });
  }

  closeArea2() {
    const f = this.fence;
    const n = Math.max(1, this.humans());
    f.max = 120 + 40 * n; f.hp = f.max; f.openUntil = 0;
    let sent = 0;
    for (const q of this.players.values()) if (q.x > FENCE_X - 16) {
      q.x = SPAWN.x + (Math.random() - 0.5) * 140; q.y = SPAWN.y + 20 + Math.random() * 60; q.tx = q.ty = null; q.target = null; sent++;
    }
    for (const [id, s] of this.slimes) if (s.kind === TODO) this.slimes.delete(id);
    this.events.push({ e: "area2", open: false });
    this.events.push({ e: "sys", text: `The devs found the hole and rebuilt the fence.${sent ? ` ${sent} ${sent === 1 ? "person was" : "people were"} sent back to the tutorial.` : ""} It has more HP now.` });
  }

  save(force = false) {
    if (!this.dirty && !force) return;
    this.dirty = false; this.lastSave = Date.now();
    const put = { total: this.total, patch: this.patch, patchKills: this.patchKills, finCount: this.finCount, patchBy: this.patchBy, patchNext: this.patchNext, patchNames: this.patchNames, plaques: this.plaques, patchRes: this.patchRes, resBy: this.resBy };
    if (this.hofDirty) { put.hof = this.hof; this.hofDirty = false; }
    this.ctx.storage.put(put);
  }

  broadcast() {
    const p = [], m = [];
    let online = 0;
    for (const q of this.players.values()) {
      if (!q.named) continue;
      if (!q.bot) online++;
      p.push([q.id, Math.round(q.x), Math.round(q.y), q.hp, q.max, q.lvl, q.deadUntil ? 1 : 0, q.name, q.hue, q.lvl >= LEVEL_CAP ? 1 : q.xp, q.lvl >= LEVEL_CAP ? 1 : xpFor(q.lvl), q.kills, q.wear, q.look, q.bot ? 1 : 0, 0, q.acct ? q.acct.pid : ""]);
    }
    for (const s of this.slimes.values()) m.push([s.id, Math.round(s.x), Math.round(s.y), s.hp, s.max, s.kind, s.tier || 0]);
    const ev = this.event ? [this.event.kind, Math.ceil((this.event.until - Date.now()) / 1000)] : null;
    const msg = JSON.stringify({ t: "s", p, m, e: this.events, n: online, total: this.total, pa: [this.patch, this.patchKills, patchGoal(this.patch), Object.keys(this.patchBy).filter((k) => !k.startsWith("ip:")).length, this.needed(this.patch), this.patchRes.poly, resGoal(this.patch).poly, this.patchRes.vert, resGoal(this.patch).vert], nd: this.nodeHp.map((h, i) => h > 0 ? -1 : i).filter((i) => i >= 0), ev,
      fz: [this.fence.hp, this.fence.max, this.fence.perm ? 99999 : this.fence.openUntil ? Math.ceil((this.fence.openUntil - Date.now()) / 1000) : 0] });
    this.events = [];
    for (const q of [...this.players.values()]) {
      if (!q.ws) continue;
      try { q.ws.send(msg); } catch { this.leave(q); }
    }
  }
}

function cleanName(n) {
  if (typeof n !== "string") return null;
  const s = n.replace(/[^\p{L}\p{N} _.\-]/gu, "").trim().slice(0, 16);
  return s.length >= 2 ? s : null;
}

async function sha(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("ut-salt-1:" + text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}
