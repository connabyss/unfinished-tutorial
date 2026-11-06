import { DurableObject } from "cloudflare:workers";
import { ITEMS, RARITY, DROP_CHANCE, rollItem, PATCHES, patchGoal, patchName, unlocked, SHAPES, EYES, MOUTHS, TITLES, SLOTS, SETS,
  PRICES, shopStock, WISH_COST, QUESTS } from "../public/items.js";
import { isBad, cleanChat } from "./filter.js";

// One shared world for everyone. The browser connects to /ws; everything else is the static page.
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      if (req.headers.get("Upgrade") !== "websocket") return new Response("expected websocket", { status: 426 });
      const stub = env.WORLD.get(env.WORLD.idFromName("world-1"));
      return stub.fetch(req);
    }
    return env.ASSETS.fetch(req);
  },
};

const W = 2400, H = 1200, SPAWN = { x: 800, y: 600 };
const FENCE_X = 1560;        // the Area 2 fence. Everything right of it is Area 2.
const AREA2_OPEN_MS = 180000; // how long the hole stays open
const TODO = 98;             // kind index for Area 2's enemy
const SAFE = 110;            // safe radius around spawn
const TICK = 100;            // ms
const MAX_PLAYERS = 60;
const SPEED = 170;           // px/s
const REACH = 46;            // attack distance (edge to edge-ish)
const LEVEL_CAP = 5;
const SLIME_NAMES = ["SLIME_FINAL", "SLIME_FINAL_v2", "SLIME_FINAL_v2_ACTUAL", "slime (placeholder)", "slime_copy(3)", "SLIME_DO_NOT_SHIP"];
const BOSS = 99;             // kind index for the boss
const BOSS2 = 97;            // the second boss, FINAL_BOSS_v0.1; bosses take turns
const FAST = 10, BIG = 11, LAG = 12; // special slimes
const isBoss = (k) => k === BOSS || k === BOSS2;
// per kind: hp, size, bite damage, hop speed (wander, chase), xp
const KIND = {
  normal: { hp: 3, r: 16, dmg: 1, sp: [85, 120], xp: 1 },
  [FAST]: { hp: 2, r: 11, dmg: 1, sp: [150, 230], xp: 1 },
  [BIG]: { hp: 9, r: 27, dmg: 2, sp: [50, 75], xp: 3 },
  [LAG]: { hp: 4, r: 16, dmg: 1, sp: [85, 120], xp: 2 },
  [TODO]: { hp: 8, r: 20, dmg: 2, sp: [85, 120], xp: 3 },
  [BOSS]: { r: 42, dmg: 2, sp: [70, 110], xp: 6 },
  [BOSS2]: { r: 46, dmg: 2, sp: [55, 80], xp: 6 },
};
const kindOf = (k) => KIND[k] || KIND.normal;
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
const xpFor = (lvl) => lvl * 6;    // xp needed to leave this level

export class World extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.players = new Map();
    this.slimes = new Map();
    this.nextId = 1;
    this.events = [];
    this.total = 0;
    this.dirty = false;
    this.timer = null;
    this.lastSave = 0;
    this.fence = { hp: 150, max: 150, openUntil: 0 };
    this.event = null;           // current world event: { kind, until }
    this.nextEventAt = Date.now() + 5 * 60000;
    this.bots = new Map();       // placeholder players while the server is quiet
    ctx.blockConcurrencyWhile(async () => {
      this.total = (await ctx.storage.get("total")) || 0;
      this.patch = (await ctx.storage.get("patch")) || 0;          // patches shipped so far
      this.patchKills = (await ctx.storage.get("patchKills")) || 0; // kills toward the next one
    });
  }

  async fetch(req) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    if (this.players.size >= MAX_PLAYERS) {
      server.send(JSON.stringify({ t: "full" }));
      server.close(1013, "full");
      return new Response(null, { status: 101, webSocket: client });
    }
    this.join(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  join(ws) {
    const id = this.nextId++;
    const p = {
      id, ws, name: "Player_" + (1000 + Math.floor(Math.random() * 9000)), hue: Math.floor(Math.random() * 360),
      x: SPAWN.x + (Math.random() - 0.5) * 140, y: SPAWN.y + 20 + Math.random() * 60, tx: null, ty: null,
      target: null, hp: 10, max: 10, lvl: 1, xp: 0, kills: 0, lastHit: 0, lastHurt: 0, lastRegen: 0,
      deadUntil: 0, lastSay: 0, named: false, wear: [-1, -1, -1, -1, -1], look: [0, 0, 0, 0], combo: 0, bucket: 0, bucketAt: Date.now(),
      acct: null, keyHash: null, emote: -1, emoteAt: 0, lastEmote: 0, lastRename: 0, loading: false,
    };
    this.players.set(id, p);
    ws.send(JSON.stringify({ t: "you", id, total: this.total, w: W, h: H }));
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
      if (Number.isFinite(m.hue)) a.hue = p.hue = Math.floor(clamp(m.hue, 0, 360)); // 360 = rainbow
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
      p.tx = clamp(m.x, 20, W - 20); p.ty = clamp(m.y, 20, H - 20); p.target = null;
    } else if (m.t === "atk") {
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
      this.questProgress(p, "emote", 1);
    } else if (m.t === "report") {
      this.report(p, m.id).catch(() => {});
    } else if (m.t === "give") {
      this.give(p, m.to, m.item);
    } else if (m.t === "buy") {
      this.buy(p, m.item);
    } else if (m.t === "wish") {
      this.wish(p);
    } else if (m.t === "quest") {
      this.quest(p);
    }
  }

  // ---------- characters: claimed names, secret save codes, saved progress ----------
  humans() { let n = 0; for (const q of this.players.values()) if (q.named && !q.bot) n++; return n; }
  tell(p, o) { if (p.ws) try { p.ws.send(JSON.stringify(o)); } catch {} }

  async login(p, m) {
    const st = this.ctx.storage;
    let key = typeof m.key === "string" ? m.key.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20) : "";
    let acct = null, h = null;
    if (key) { h = await sha(key); acct = await st.get("a:" + h); if (!acct) this.tell(p, { t: "err", text: "That save code wasn't found. Starting a new character." }); }
    if (acct) {
      // the same character can only be online once: the older tab gets kicked
      for (const q of this.players.values()) if (q !== p && q.keyHash === h) { this.tell(q, { t: "kicked" }); try { q.ws.close(4000, "opened elsewhere"); } catch {} this.leave(q); }
    } else {
      key = ""; for (let i = 0; i < 15; i++) key += KEY_CHARS[Math.floor(Math.random() * KEY_CHARS.length)];
      h = await sha(key);
      let name = cleanName(m.name);
      if (!name || isBad(name) || (await st.get("n:" + name.toLowerCase()))) {
        do { name = "Player_" + (1000 + Math.floor(Math.random() * 9000)); } while (await st.get("n:" + name.toLowerCase()));
        if (cleanName(m.name)) this.tell(p, { t: "err", text: `That name is taken or not allowed. You're ${name} for now. Change it in 🎨 Me.` });
      }
      const look = Array.isArray(m.look) ? m.look.slice(0, 3).map((v, i) => (Number.isInteger(v) && v >= 0 && v < [SHAPES.length, EYES.length, MOUTHS.length][i] ? v : 0)).concat([0]) : [0, 0, 0, 0];
      acct = { name, hue: Number.isFinite(m.hue) ? Math.floor(clamp(m.hue, 0, 360)) : Math.floor(Math.random() * 360), look,
        bag: {}, wear: {}, lvl: 1, xp: 0, coins: 0, stats: { kills: 0, deaths: 0, fence: 0, combo: 0, boss: 0, sets: 0, lvl: 1 },
        tu: [0], quest: null, mutedUntil: 0, created: Date.now() };
      await st.put({ ["a:" + h]: acct, ["n:" + name.toLowerCase()]: h });
      this.tell(p, { t: "key", key });
    }
    if (!this.players.has(p.id)) return; // they left while we were loading
    p.acct = acct; p.keyHash = h; p.name = acct.name; p.hue = acct.hue; p.look = acct.look;
    p.lvl = acct.lvl; p.xp = acct.xp; p.max = 10 + 2 * (acct.lvl - 1); p.hp = p.max;
    p.wear = SLOTS.map((sl) => { const id = acct.wear[sl]; const i = ITEMS.findIndex((it) => it.id === id); return i >= 0 && acct.bag[id] > 0 ? i : -1; });
    p.named = true;
    this.sendMe(p);
    const alone = this.humans() === 1;
    this.events.push({ e: "sys", text: alone
      ? `${p.name} joined. You're the only one here. Very realistic MMO launch.`
      : `${p.name} joined. Welcome to the tutorial. It's also the endgame.` });
  }

  sendMe(p) {
    const a = p.acct;
    const found = Object.keys(a.bag).filter((k) => a.bag[k] > 0).length;
    this.tell(p, { t: "me", name: a.name, hue: a.hue, look: a.look, bag: a.bag, wear: a.wear, coins: a.coins, stats: { ...a.stats, found }, titles: a.tu,
      quest: a.quest, muted: a.mutedUntil > Date.now() });
  }

  async rename(p, raw) {
    const st = this.ctx.storage, name = cleanName(raw);
    if (!name) return this.tell(p, { t: "err", text: "Names need 2 to 16 letters or numbers." });
    if (isBad(name)) return this.tell(p, { t: "err", text: "QA rejected that name. Try another." });
    const old = p.acct.name;
    if (name === old) return;
    const owner = await st.get("n:" + name.toLowerCase());
    if (owner && owner !== p.keyHash) return this.tell(p, { t: "err", text: `"${name}" is already claimed by someone else.` });
    if (old.toLowerCase() !== name.toLowerCase()) await st.delete("n:" + old.toLowerCase());
    p.acct.name = p.name = name;
    await st.put({ ["n:" + name.toLowerCase()]: p.keyHash, ["a:" + p.keyHash]: p.acct });
    this.events.push({ e: "sys", text: `${old} is now called ${name}.` });
    this.sendMe(p);
  }

  saveAcct(p) {
    if (!p.acct || !p.keyHash) return;
    p.acct.lvl = p.lvl; p.acct.xp = p.xp; p.dirty = false;
    this.ctx.storage.put("a:" + p.keyHash, p.acct);
  }

  hasTitle(a, i) {
    const t = TITLES[i]; if (!t) return false; if (!t.need) return true;
    const found = Object.keys(a.bag).filter((k) => a.bag[k] > 0).length;
    const s = { ...a.stats, found, lvl: Math.max(a.stats.lvl || 1, a.lvl) };
    return Object.entries(t.need).every(([k, v]) => (s[k] || 0) >= v);
  }

  checkTitles(p) {
    const a = p.acct; if (!a) return;
    for (let i = 0; i < TITLES.length; i++) if (!a.tu.includes(i) && this.hasTitle(a, i)) {
      a.tu.push(i); this.tell(p, { t: "title", i }); p.dirty = true;
    }
  }

  stat(p, k, add, max) {
    const a = p.acct; if (!a) return;
    if (max != null) a.stats[k] = Math.max(a.stats[k] || 0, max); else a.stats[k] = (a.stats[k] || 0) + add;
    p.dirty = true; this.checkTitles(p);
  }

  fullSets(p) {
    const worn = new Set(p.wear.filter((i) => i >= 0).map((i) => ITEMS[i].id));
    return SETS.filter((st) => st.items.every((id) => worn.has(id))).length;
  }

  async report(p, id) {
    const q = this.players.get(id);
    if (!q || !q.acct || q === p || q.bot) return;
    const st = this.ctx.storage, k = "r:" + q.keyHash, now = Date.now();
    const r = (await st.get(k)) || { by: {} };
    r.by[p.keyHash] = now;
    for (const [who, at] of Object.entries(r.by)) if (now - at > DAY) delete r.by[who];
    await st.put(k, r);
    this.tell(p, { t: "err", text: `Reported ${q.name}. Thanks. If 3 different players report someone, they're muted for a day.` });
    if (Object.keys(r.by).length >= 3 && !(q.acct.mutedUntil > now)) {
      q.acct.mutedUntil = now + DAY; q.dirty = true;
      this.tell(q, { t: "err", text: "You've been muted for a day after reports from several players." });
    }
  }

  give(p, to, item) {
    const q = this.players.get(to), it = ITEMS[item];
    if (!q || !q.acct || q === p || !it || !(p.acct.bag[it.id] > 0)) return;
    if (dist(p, q) > 220) return this.tell(p, { t: "err", text: "Stand closer to give something. Shipping isn't implemented." });
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
    this.tell(p, { t: "loot", item, x: Math.round(from.x), y: Math.round(from.y), why });
    if (it.r >= 2) this.events.push({ e: "sys", text: it.r === 4
      ? `${p.name} found ${it.name}. It's FINISHED. Fully. Everyone stop and look.`
      : it.r === 3 ? `${p.name} found ${it.name} (Unfinished). It doesn't exist. They're wearing it anyway.`
      : `${p.name} found ${it.name} (${RARITY[it.r].name}).` });
    if (it.r === 4) this.events.push({ e: "finished", id: p.id, item });
    this.sendMe(p); this.checkTitles(p);
  }

  buy(p, item) {
    if (!unlocked(this.patch, "shop")) return;
    if (dist(p, SHOP_AT) > 170) return this.tell(p, { t: "err", text: "Walk over to the SHOP first." });
    const stock = shopStock(Math.floor(Date.now() / DAY));
    if (!stock.includes(item)) return;
    const price = PRICES[ITEMS[item].r];
    if (p.acct.coins < price) return this.tell(p, { t: "err", text: `Not enough coins. It's ${price}. You have ${p.acct.coins}.` });
    p.acct.coins -= price;
    this.grant(p, item, SHOP_AT, "shop");
  }

  wish(p) {
    if (!unlocked(this.patch, "fountain")) return;
    if (dist(p, FOUNTAIN_AT) > 150) return this.tell(p, { t: "err", text: "Walk over to the fountain first." });
    if (p.acct.coins < WISH_COST) return this.tell(p, { t: "err", text: `A wish costs ${WISH_COST} coins. You have ${p.acct.coins}.` });
    p.acct.coins -= WISH_COST;
    this.events.push({ e: "wish", id: p.id });
    this.grant(p, rollItem(Math.random, false), FOUNTAIN_AT, "wish");
  }

  quest(p) {
    if (!unlocked(this.patch, "quests")) return;
    if (dist(p, NPC_AT) > 150) return this.tell(p, { t: "err", text: "Walk over to NPC_02 first." });
    const a = p.acct;
    if (a.quest && a.quest.have >= QUESTS[a.quest.i].n) {
      const Q = QUESTS[a.quest.i];
      a.coins += Q.coins; a.quest = null; p.dirty = true;
      this.tell(p, { t: "err", text: `Quest done. +${Q.coins} coins. NPC_02 says: "QUEST_COMPLETE_STRING".` });
      this.events.push({ e: "quest", id: p.id });
      if (Math.random() < 0.35) this.grant(p, rollItem(Math.random, false), NPC_AT, "quest");
      this.sendMe(p);
      return;
    }
    if (a.quest) return this.tell(p, { t: "err", text: "You already have a quest. Check 🎨 Me for progress." });
    const choices = QUESTS.map((q, i) => i).filter((i) => {
      const k = QUESTS[i].k;
      if ((k === "big" || k === "fast") && !unlocked(this.patch, "enemies")) return false;
      if (k === "fence" && !unlocked(this.patch, "fence")) return false;
      return true;
    });
    a.quest = { i: choices[Math.floor(Math.random() * choices.length)], have: 0 }; p.dirty = true;
    this.sendMe(p);
  }

  questProgress(p, k, add, max) {
    const a = p.acct; if (!a || !a.quest) return;
    const Q = QUESTS[a.quest.i]; if (Q.k !== k || a.quest.have >= Q.n) return;
    a.quest.have = Math.min(Q.n, max != null ? Math.max(a.quest.have, max) : a.quest.have + add); p.dirty = true;
    this.tell(p, { t: "qp", have: a.quest.have, n: Q.n });
  }

  spawnSlime(boss = false, todo = false, kind = null, at = null) {
    const id = this.nextId++;
    let x, y;
    for (let i = 0; i < 20; i++) {
      x = 80 + Math.random() * (FENCE_X - 160); y = 80 + Math.random() * (H - 160);
      if (Math.hypot(x - SPAWN.x, y - SPAWN.y) > (boss ? 300 : 220)) break;
    }
    if (todo) { x = FENCE_X + 120 + Math.random() * (W - FENCE_X - 200); y = 80 + Math.random() * (H - 160); }
    if (at) { x = clamp(at.x + (Math.random() - 0.5) * 50, 30, FENCE_X - 30); y = clamp(at.y + (Math.random() - 0.5) * 50, 30, H - 30); }
    const n = this.players.size;
    if (kind == null) {
      if (boss) kind = unlocked(this.patch, "boss2") && Math.floor(this.total / BOSS_EVERY) % 2 === 0 ? BOSS2 : BOSS;
      else if (todo) kind = TODO;
      else {
        const r = unlocked(this.patch, "enemies") ? Math.random() : 1;
        kind = r < 0.12 ? FAST : r < 0.22 ? BIG : r < 0.3 ? LAG : Math.floor(Math.random() * SLIME_NAMES.length);
      }
    }
    const K = kindOf(kind);
    const hp = kind === BOSS ? 30 + 12 * n : kind === BOSS2 ? 40 + 15 * n : K.hp;
    const s = { id, x, y, hp, kind, r: K.r, dmg: K.dmg, hitters: new Set() };
    if (kind === BUG) { s.until = Date.now() + 90000; }
    s.max = s.hp; s.hopAt = Date.now() + Math.random() * 1500; s.vx = 0; s.vy = 0; s.hopEnd = 0; s.lastBite = 0;
    s.lagAt = Date.now() + 2000 + Math.random() * 1500; s.slamAt = Date.now() + 3000; s.slam = null;
    this.slimes.set(id, s);
    if (kind === BOSS) this.events.push({ e: "sys", text: "MISSING_TEXTURE has spawned. The artist left before finishing it. Team up." });
    if (kind === BOSS2) this.events.push({ e: "sys", text: "FINAL_BOSS_v0.1 has spawned. It only has one attack. Step out of the red circle." });
    return s;
  }

  tick() {
    const now = Date.now(), dt = TICK / 1000;
    const alive = [...this.players.values()].filter((p) => p.named);
    // keep the slime population matched to how many people are around
    const rain = this.event && this.event.kind === "rain";
    const want = Math.min(rain ? 48 : 32, 6 + 2 * alive.length + (rain ? 16 : 0));
    let normal = 0, todos = 0;
    for (const s of this.slimes.values()) { if (s.kind === TODO) todos++; else if (!isBoss(s.kind)) normal++; }
    if (normal < want && Math.random() < (rain ? 0.9 : 0.3)) this.spawnSlime();
    this.worldEvents(now);
    this.botBrains(now);
    const f = this.fence;
    if (f.openUntil) {
      if (todos < Math.min(16, 4 + alive.length) && Math.random() < 0.3) this.spawnSlime(false, true);
      if (now >= f.openUntil) this.closeArea2();
    }

    // players
    for (const p of this.players.values()) {
      if (p.deadUntil) {
        if (now >= p.deadUntil) {
          p.deadUntil = 0; p.hp = p.max; p.x = SPAWN.x + (Math.random() - 0.5) * 140; p.y = SPAWN.y + 20 + Math.random() * 60; p.tx = p.ty = null; p.target = null;
        }
        continue;
      }
      let gx = p.tx, gy = p.ty;
      const t = p.target === "fence" ? (this.fence.openUntil ? null : { x: FENCE_X, y: clamp(p.y, 40, H - 40), r: 4, fence: true })
        : p.target != null ? this.slimes.get(p.target) : null;
      if (p.target != null && !t) p.target = null;
      if (t) {
        const d = dist(p, t);
        if (d <= t.r + REACH) {
          gx = null;
          if (now - p.lastHit >= 450) {
            // keep swinging without a break to build a combo; every 5th hit in a combo is a crit
            p.combo = now - p.lastHit < 2500 ? p.combo + 1 : 1;
            p.lastHit = now;
            const crit = p.combo % 5 === 0 || Math.random() < 0.08;
            const dmg = (1 + Math.floor((p.lvl - 1) / 2)) * (crit ? 2 : 1);
            this.stat(p, "combo", 0, p.combo); this.questProgress(p, "combo", 0, p.combo);
            if (t.fence) {
              this.fence.hp -= dmg; this.stat(p, "fence", 1); this.questProgress(p, "fence", 1);
              this.events.push({ e: "fhit", by: p.id, y: Math.round(t.y), dmg, crit, combo: p.combo });
              if (this.fence.hp <= 0) this.openArea2(p);
            } else {
              t.hp -= dmg; t.hitters.add(p.id);
              this.events.push({ e: "hit", by: p.id, id: t.id, dmg, crit, combo: p.combo });
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
      if (p.hp < p.max && now - p.lastHurt > 4000 && now - p.lastRegen > 1500) { p.hp++; p.lastRegen = now; }
    }

    // slimes
    for (const s of this.slimes.values()) {
      if (now >= s.hopAt) {
        const K = kindOf(s.kind);
        let near = null, nd = isBoss(s.kind) ? 320 : s.kind === FAST ? 240 : 190;
        for (const p of alive) { if (p.deadUntil) continue; const d = dist(p, s); if (d < nd) { nd = d; near = p; } }
        let ang = Math.random() * Math.PI * 2, sp = K.sp[0];
        if (near) { ang = Math.atan2(near.y - s.y, near.x - s.x) + (s.kind === BUG ? Math.PI + (Math.random() - 0.5) : 0); sp = K.sp[1]; }
        s.vx = Math.cos(ang) * sp; s.vy = Math.sin(ang) * sp;
        s.hopEnd = now + 450; s.hopAt = now + (s.kind === FAST || s.kind === BUG ? 550 : near ? 900 : 1400 + Math.random() * 1600);
      }
      if (s.kind === BUG && now > s.until) {
        this.slimes.delete(s.id);
        this.events.push({ e: "sys", text: "THE BUG escaped to production. It'll be fine." });
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
      // FINAL_BOSS_v0.1 has one attack: a slam with a red warning circle you can step out of
      if (s.kind === BOSS2) {
        if (!s.slam && now >= s.slamAt) {
          let tgt = null, td = 420;
          for (const p of alive) { if (p.deadUntil) continue; const d = dist(p, s); if (d < td) { td = d; tgt = p; } }
          if (tgt) { s.slam = { x: Math.round(tgt.x), y: Math.round(tgt.y), at: now + 1300 }; this.events.push({ e: "tele", x: s.slam.x, y: s.slam.y, r: 105, ms: 1300 }); }
          s.slamAt = now + 3800;
        }
        if (s.slam && now >= s.slam.at) {
          const sl = s.slam; s.slam = null; let hit = 0;
          for (const p of alive) {
            if (p.deadUntil || dist(p, SPAWN) < SAFE || Math.hypot(p.x - sl.x, p.y - sl.y) > 105) continue;
            p.hp -= 3; p.lastHurt = now; hit++;
            this.events.push({ e: "ow", id: p.id, dmg: 3 });
            if (p.hp <= 0) { p.hp = 0; p.deadUntil = now + 3000; p.target = null; this.events.push({ e: "die", id: p.id }); this.stat(p, "deaths", 1); }
          }
          this.events.push({ e: "slam", x: sl.x, y: sl.y, r: 105, hit });
        }
      }
      if (now < s.hopEnd) {
        // slimes stay on their own side of the fence, open or not
        const lo = s.kind === TODO ? FENCE_X + 30 : 30, hi = s.kind === TODO ? W - 30 : FENCE_X - 30;
        s.x = clamp(s.x + s.vx * dt, lo, hi); s.y = clamp(s.y + s.vy * dt, 30, H - 30);
      }
      // the spawn circle is a safe zone: slimes respect the tutorial
      const sd = Math.hypot(s.x - SPAWN.x, s.y - SPAWN.y), keep = SAFE + s.r;
      if (sd < keep) { const k = keep / (sd || 1); s.x = SPAWN.x + (s.x - SPAWN.x) * k; s.y = SPAWN.y + (s.y - SPAWN.y) * k; }
      // bite anyone touching it
      if (now - s.lastBite > 1300) {
        for (const p of alive) {
          if (p.deadUntil || dist(p, SPAWN) < SAFE) continue;
          if (dist(p, s) < s.r + 14) {
            s.lastBite = now; p.hp -= s.dmg; p.lastHurt = now;
            this.events.push({ e: "ow", id: p.id, dmg: s.dmg });
            if (p.hp <= 0) {
              p.hp = 0; p.deadUntil = now + 3000; p.target = null;
              this.events.push({ e: "die", id: p.id }); this.stat(p, "deaths", 1);
            }
            break;
          }
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
    this.patchKills++;
    if (this.patchKills >= patchGoal(this.patch)) {
      const n = this.patch;
      this.patchKills = 0; this.patch++;
      const note = PATCHES[n] ? PATCHES[n].note : "Bug fixes and performance improvements.";
      this.events.push({ e: "patch", n: this.patch, name: patchName(n), note });
      this.events.push({ e: "sys", text: `Patch ${patchName(n)} shipped. ${note}` });
    }
    const boss = isBoss(s.kind);
    const xp = kindOf(s.kind).xp;
    const coins = boss ? 10 : s.kind === BUG ? 8 : xp;
    for (const pid of s.hitters) {
      const p = this.players.get(pid);
      if (!p) continue;
      p.kills++;
      if (p.acct) {
        p.acct.coins += coins; this.tell(p, { t: "coins", n: p.acct.coins, add: coins, x: Math.round(s.x), y: Math.round(s.y) });
        this.stat(p, "kills", 1); this.questProgress(p, "kills", 1);
        if (boss) { this.stat(p, "boss", 1); this.questProgress(p, "boss", 1); }
        if (s.kind === BIG) this.questProgress(p, "big", 1);
        if (s.kind === FAST) this.questProgress(p, "fast", 1);
        const evx = this.event && this.event.kind === "rain" ? 2 : 1;
        this.loot(p, boss || s.kind === BUG, Math.min(0.9, evx * (s.kind === TODO ? 0.5 : (s.kind === BIG || s.kind === LAG) ? 0.35 : DROP_CHANCE)), s);
      }
      if (p.lvl >= LEVEL_CAP) continue;
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
      this.events.push({ e: "sys", text: `THE BUG was squashed by ${s.hitters.size} ${s.hitters.size === 1 ? "person" : "people"}. Everyone who hit it got Rare loot or better. Marked as fixed.` });
      if (this.event && this.event.kind === "bug") this.event = null;
    } else if (s.kind === BOSS2) {
      this.events.push({ e: "sys", text: `FINAL_BOSS_v0.1 defeated by ${s.hitters.size} ${s.hitters.size === 1 ? "person" : "people"}. The real final boss is in the sequel. Everyone who hit it got Rare loot or better.` });
    } else if (boss) {
      this.events.push({ e: "sys", text: `MISSING_TEXTURE defeated by ${s.hitters.size} ${s.hitters.size === 1 ? "person" : "people"}. Everyone who hit it got Rare loot or better. Some of it isn't finished.` });
    } else if (this.total % 100 === 0) {
      this.events.push({ e: "sys", text: `Everyone together has now killed ${this.total} slimes. New areas added by the devs: 0.` });
    }
    let hasBoss = false;
    for (const o of this.slimes.values()) if (isBoss(o.kind)) hasBoss = true;
    if (!hasBoss && this.total % BOSS_EVERY === 0) this.spawnSlime(true);
  }

  loot(p, boss, chance, s) {
    if (!boss && Math.random() >= chance) return;
    this.grant(p, rollItem(Math.random, boss), s);
  }

  // ---------- world events: Slime Rain and Bug Bounty, every 7 to 12 minutes once patched in ----------
  worldEvents(now) {
    const ev = this.event;
    if (ev && ev.kind === "rain" && now >= ev.until) {
      this.event = null; this.events.push({ e: "sys", text: "Slime Rain is over. Loot odds are back to normal (bad)." });
    }
    if (ev || now < this.nextEventAt || !unlocked(this.patch, "events") || this.humans() === 0) return;
    this.nextEventAt = now + (7 + Math.random() * 5) * 60000;
    if (Math.random() < 0.5) {
      this.event = { kind: "rain", until: now + 45000 };
      this.events.push({ e: "event", kind: "rain", ms: 45000 });
      this.events.push({ e: "sys", text: "WORLD EVENT: Slime Rain! A spawn loop is stuck. Double loot for 45 seconds." });
    } else {
      this.event = { kind: "bug", until: now + 90000 };
      this.spawnSlime(false, false, BUG);
      this.events.push({ e: "event", kind: "bug", ms: 90000 });
      this.events.push({ e: "sys", text: "WORLD EVENT: Bug Bounty! THE BUG is loose. Everyone who hits it before it escapes gets Rare loot." });
    }
  }

  // ---------- placeholder players: when fewer than 3 people are on, up to 2 bots wander and fight ----------
  botBrains(now) {
    const humans = this.humans(), want = humans === 0 ? 0 : Math.max(0, Math.min(2, 3 - humans));
    let bots = [...this.players.values()].filter((q) => q.bot);
    while (bots.length > want) { const b = bots.pop(); this.players.delete(b.id); }
    while (bots.length < want) {
      const name = BOT_NAMES.find((n) => !bots.some((b) => b.name === n)) || "NPC_Player_99";
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
    f.hp = 0; f.openUntil = Date.now() + AREA2_OPEN_MS;
    for (const q of this.players.values()) if (q.target === "fence") q.target = null;
    this.events.push({ e: "area2", open: true, by: p.id });
    this.events.push({ e: "sys", text: `${p.name} landed the last hit. The fence is down. AREA 2 is open for 3 minutes before the devs notice.` });
  }

  closeArea2() {
    const f = this.fence;
    const n = this.players.size;
    f.max = 120 + 40 * Math.max(1, n); f.hp = f.max; f.openUntil = 0;
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
    this.ctx.storage.put({ total: this.total, patch: this.patch, patchKills: this.patchKills });
  }

  broadcast() {
    const p = [], m = [];
    let online = 0;
    for (const q of this.players.values()) {
      if (!q.named) continue;
      if (!q.bot) online++;
      p.push([q.id, Math.round(q.x), Math.round(q.y), q.hp, q.max, q.lvl, q.deadUntil ? 1 : 0, q.name, q.hue, q.xp, xpFor(q.lvl), q.kills, q.wear, q.look, q.bot ? 1 : 0]);
    }
    for (const s of this.slimes.values()) m.push([s.id, Math.round(s.x), Math.round(s.y), s.hp, s.max, s.kind]);
    const ev = this.event ? [this.event.kind, Math.ceil((this.event.until - Date.now()) / 1000)] : null;
    const msg = JSON.stringify({ t: "s", p, m, e: this.events, n: online, total: this.total, pa: [this.patch, this.patchKills, patchGoal(this.patch)], ev,
      fz: [this.fence.hp, this.fence.max, this.fence.openUntil ? Math.ceil((this.fence.openUntil - Date.now()) / 1000) : 0] });
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
