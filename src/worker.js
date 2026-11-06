import { DurableObject } from "cloudflare:workers";
import { ITEMS, RARITY, DROP_CHANCE, rollItem, PATCHES, patchGoal, patchName, SHAPES, EYES, MOUTHS, TITLES } from "../public/items.js";

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
      deadUntil: 0, lastSay: 0, named: false, hat: -1, hand: -1, look: [0, 0, 0, 0], combo: 0, bucket: 0, bucketAt: Date.now(),
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
    if (p.named) this.events.push({ e: "sys", text: `${p.name} left. Their progress is saved. (It isn't.)` });
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
      const name = cleanName(m.name);
      if (name) p.name = name;
      if (Number.isFinite(m.hue)) p.hue = Math.floor(clamp(m.hue, 0, 360)); // 360 = rainbow
      if (Array.isArray(m.look)) {
        const lim = [SHAPES.length, EYES.length, MOUTHS.length, TITLES.length];
        p.look = lim.map((n, i) => (Number.isInteger(m.look[i]) && m.look[i] >= 0 && m.look[i] < n ? m.look[i] : 0));
      }
      if (!p.named) {
        p.named = true;
        const alone = this.players.size === 1;
        this.events.push({ e: "sys", text: alone
          ? `${p.name} joined. You're the only one here. Very realistic MMO launch.`
          : `${p.name} joined. Welcome to the tutorial. It's also the endgame.` });
      }
    } else if (m.t === "wear") {
      // what you wear is saved in your own browser; the server just checks it's a real item for that slot
      const ok = (v, slot) => Number.isInteger(v) && ITEMS[v] && ITEMS[v].slot === slot;
      p.hat = ok(m.hat, "hat") ? m.hat : -1;
      p.hand = ok(m.hand, "hand") ? m.hand : -1;
    } else if (m.t === "go") {
      if (!Number.isFinite(m.x) || !Number.isFinite(m.y)) return;
      p.tx = clamp(m.x, 20, W - 20); p.ty = clamp(m.y, 20, H - 20); p.target = null;
    } else if (m.t === "atk") {
      if (m.id === "fence" && !this.fence.openUntil) { p.target = "fence"; p.tx = null; }
      else if (this.slimes.has(m.id)) { p.target = m.id; p.tx = null; }
    } else if (m.t === "say") {
      if (typeof m.text !== "string") return;
      const text = m.text.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 80);
      if (!text || now - p.lastSay < 1200) return;
      p.lastSay = now;
      this.events.push({ e: "say", id: p.id, text });
    }
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
      if (boss) kind = Math.floor(this.total / BOSS_EVERY) % 2 === 0 ? BOSS2 : BOSS;
      else if (todo) kind = TODO;
      else { const r = Math.random(); kind = r < 0.12 ? FAST : r < 0.22 ? BIG : r < 0.3 ? LAG : Math.floor(Math.random() * SLIME_NAMES.length); }
    }
    const K = kindOf(kind);
    const hp = kind === BOSS ? 30 + 12 * n : kind === BOSS2 ? 40 + 15 * n : K.hp;
    const s = { id, x, y, hp, kind, r: K.r, dmg: K.dmg, hitters: new Set() };
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
    const want = Math.min(32, 6 + 2 * alive.length);
    let normal = 0, todos = 0;
    for (const s of this.slimes.values()) { if (s.kind === TODO) todos++; else if (!isBoss(s.kind)) normal++; }
    if (normal < want && Math.random() < 0.3) this.spawnSlime();
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
            if (t.fence) {
              this.fence.hp -= dmg;
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
        if (near) { ang = Math.atan2(near.y - s.y, near.x - s.x); sp = K.sp[1]; }
        s.vx = Math.cos(ang) * sp; s.vy = Math.sin(ang) * sp;
        s.hopEnd = now + 450; s.hopAt = now + (s.kind === FAST ? 550 : near ? 900 : 1400 + Math.random() * 1600);
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
            if (p.hp <= 0) { p.hp = 0; p.deadUntil = now + 3000; p.target = null; this.events.push({ e: "die", id: p.id }); }
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
              this.events.push({ e: "die", id: p.id });
            }
            break;
          }
        }
      }
    }

    if (this.dirty && now - this.lastSave > 5000) this.save();
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
    for (const pid of s.hitters) {
      const p = this.players.get(pid);
      if (!p) continue;
      p.kills++;
      this.loot(p, boss, s.kind === TODO ? 0.5 : (s.kind === BIG || s.kind === LAG) ? 0.35 : DROP_CHANCE, s);
      if (p.lvl >= LEVEL_CAP) continue;
      p.xp += xp;
      while (p.lvl < LEVEL_CAP && p.xp >= xpFor(p.lvl)) {
        p.xp -= xpFor(p.lvl); p.lvl++; p.max += 2; p.hp = p.max;
        this.events.push({ e: "lvl", id: p.id, lvl: p.lvl, cap: p.lvl >= LEVEL_CAP });
      }
    }
    this.events.push({ e: "kill", id: s.id, x: Math.round(s.x), y: Math.round(s.y), boss, helpers: s.hitters.size, total: this.total, by: [...s.hitters], xp });
    if (s.kind === BIG) {
      // split() was never implemented. It splits anyway.
      for (let i = 0; i < 3; i++) { const c = this.spawnSlime(false, false, Math.floor(Math.random() * SLIME_NAMES.length), s); c.hp = c.max = 2; }
    }
    if (s.kind === BOSS2) {
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
    const item = rollItem(Math.random, boss);
    try { p.ws.send(JSON.stringify({ t: "loot", item, x: Math.round(s.x), y: Math.round(s.y) })); } catch {}
    const it = ITEMS[item];
    if (it.r >= 2) this.events.push({ e: "sys", text: it.r === 3
      ? `${p.name} found ${it.name} (Unfinished). It doesn't exist. They're wearing it anyway.`
      : `${p.name} found ${it.name} (${RARITY[it.r].name}).` });
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
      online++;
      p.push([q.id, Math.round(q.x), Math.round(q.y), q.hp, q.max, q.lvl, q.deadUntil ? 1 : 0, q.name, q.hue, q.xp, xpFor(q.lvl), q.kills, q.hat, q.hand, q.look]);
    }
    for (const s of this.slimes.values()) m.push([s.id, Math.round(s.x), Math.round(s.y), s.hp, s.max, s.kind]);
    const msg = JSON.stringify({ t: "s", p, m, e: this.events, n: online, total: this.total, pa: [this.patch, this.patchKills, patchGoal(this.patch)],
      fz: [this.fence.hp, this.fence.max, this.fence.openUntil ? Math.ceil((this.fence.openUntil - Date.now()) / 1000) : 0] });
    this.events = [];
    for (const q of this.players.values()) {
      try { q.ws.send(msg); } catch { this.leave(q); }
    }
  }
}

function cleanName(n) {
  if (typeof n !== "string") return null;
  const s = n.replace(/[^\p{L}\p{N} _.\-]/gu, "").trim().slice(0, 16);
  return s.length >= 2 ? s : null;
}
