// Loot table, shared by the server (src/worker.js) and the page (index.html).
// Order matters: players send and receive items by their position in this list, so only ever add to the end.
export const RARITY = [
  { name: "Common", color: "#d8d8d8", weight: 60 },
  { name: "Uncommon", color: "#7be36a", weight: 30 },
  { name: "Rare", color: "#6cb6ff", weight: 10 },
  { name: "Unfinished", color: "#ff7bf0", weight: 0 }, // only from bosses
  { name: "Finished", color: "#ffd700", weight: 0 },  // never random: each one is earned with a long goal (GOALS below)
];

export const ITEMS = [
  { id: "cube", slot: "hat", r: 0, name: "Default Cube", text: "Every 3D program starts with one. So does your outfit." },
  { id: "mug", slot: "hat", r: 0, name: "Dev's Coffee Mug", text: "Still warm. The dev left in a hurry." },
  { id: "lorem", slot: "hat", r: 0, name: "Lorem Ipsum Helmet", text: "Lorem ipsum dolor sit armor." },
  { id: "tophat", slot: "hat", r: 1, name: "hat_final_v3", text: "Versions 1 and 2 were worse." },
  { id: "float", slot: "hat", r: 1, name: "Floating Hat", text: "Attached to the wrong bone." },
  { id: "wire", slot: "hat", r: 2, name: "Wireframe Crown", text: "The artist got as far as the lines." },
  { id: "notex", slot: "hat", r: 2, name: "Hat (no texture)", text: "Pink and black means it's working." },
  { id: "todo", slot: "hat", r: 3, name: "// TODO: hat", text: "The rarest hat. It was never made." },
  { id: "noodle", slot: "hand", r: 0, name: "Pool Noodle", text: "Does the same damage as the stick. Everything does." },
  { id: "baguette", slot: "hand", r: 0, name: "Baguette (placeholder sword)", text: "Nobody ever replaced it." },
  { id: "spoon", slot: "hand", r: 0, name: "Debug Spoon", text: "Used to test the hit boxes. Still is." },
  { id: "pencil", slot: "hand", r: 1, name: "Sword (concept art)", text: "Looked great on the pitch slide." },
  { id: "final", slot: "hand", r: 1, name: "sword_FINAL_FINAL", text: "sword_FINAL_FINAL_2 is coming soon." },
  { id: "noname", slot: "hand", r: 2, name: "ITEM_NAME_HERE", text: "Someone forgot to name it." },
  { id: "keyboard", slot: "hand", r: 2, name: "Dev's Keyboard", text: "The Ctrl and Z keys are worn smooth." },
  { id: "shard", slot: "hand", r: 3, name: "Shard of MISSING_TEXTURE", text: "A piece of the boss. It didn't load either." },
  // ---- more hats
  { id: "paper", slot: "hat", r: 0, name: "Paper Crown (printed)", text: "Printed on the office printer. It jammed twice." },
  { id: "cone", slot: "hat", r: 0, name: "Traffic Cone (asset store)", text: "Bought for $2. Used in every game ever." },
  { id: "phones", slot: "hat", r: 1, name: "Dev Headphones", text: "Noise cancelling. Mostly cancels bug reports." },
  { id: "prop", slot: "hat", r: 1, name: "Propeller Cap (no lift)", text: "Spins. Does nothing. Very on brand." },
  { id: "horns", slot: "hat", r: 1, name: "horns_placeholder", text: "They were going to be a demon. Budget." },
  { id: "halo", slot: "hat", r: 2, name: "Halo (debug light)", text: "Left on by accident. Lights nothing." },
  { id: "wizard", slot: "hat", r: 2, name: "Wizard Hat (spell not found)", text: "Magic was cut in pre-production." },
  { id: "crt", slot: "hat", r: 3, name: "CRT Monitor Head", text: "Shows the loading screen forever." },
  // ---- more held items
  { id: "fish", slot: "hand", r: 0, name: "Fish (from the pond DLC)", text: "The pond DLC was cancelled. The fish escaped." },
  { id: "mop", slot: "hand", r: 0, name: "QA Mop", text: "For cleaning up after a launch." },
  { id: "umbrella", slot: "hand", r: 1, name: "Umbrella (no rain)", text: "Weather is one cloud. It never rains." },
  { id: "laser", slot: "hand", r: 2, name: "Laser Pointer Sword", text: "Point at slimes. Cats love it." },
  { id: "hammer", slot: "hand", r: 2, name: "Ban Hammer (mods only)", text: "There are no mods. You're holding it anyway." },
  { id: "wand", slot: "hand", r: 3, name: "Wand of undefined", text: "Casts NaN. Nobody knows what that does." },
  // ---- backs
  { id: "cape", slot: "back", r: 0, name: "Cape (physics disabled)", text: "Stiff as a board. Cloth sim was too slow." },
  { id: "greycape", slot: "back", r: 0, name: "Grey Cape (untextured)", text: "The texture is coming in a patch." },
  { id: "pack", slot: "back", r: 1, name: "Inventory (an actual backpack)", text: "Holds 0 items. It's decoration." },
  { id: "hoodie", slot: "back", r: 1, name: "Dev Hoodie (hood up)", text: "Worn during crunch. Never washed." },
  { id: "jetpack", slot: "back", r: 1, name: "Jetpack (no fuel)", text: "Puffs smoke. You stay on the ground." },
  { id: "wings", slot: "back", r: 2, name: "Wings (concept art)", text: "Pencil sketches. Flight is on the roadmap." },
  { id: "checkcape", slot: "back", r: 3, name: "Cape of MISSING_TEXTURE", text: "Flows dramatically. Renders terribly." },
  // ---- pets (they follow you around)
  { id: "pslime", slot: "pet", r: 0, name: "Pet slime_copy(3)", text: "Tamed. It's the same asset as the enemies." },
  { id: "pcube", slot: "pet", r: 0, name: "Pet Default Cube", text: "Follows you. Has no thoughts." },
  { id: "pcursor", slot: "pet", r: 1, name: "Pet Mouse Cursor", text: "Someone left it on screen. Now it's yours." },
  { id: "pbug", slot: "pet", r: 1, name: "Pet Bug (won't fix)", text: "Marked won't fix. So it stays, with you." },
  { id: "pguy", slot: "pet", r: 2, name: "Tiny Tutorial Guy", text: "Gives you tips nobody asked for." },
  { id: "ptex", slot: "pet", r: 3, name: "Pet MISSING_TEXTURE", text: "A baby boss. Adorable. Also unloaded." },
  // ---- trails (behind you when you walk)
  { id: "tpix", slot: "trail", r: 0, name: "Trail: Dead Pixels", text: "Your monitor was fine. Now it isn't." },
  { id: "tlorem", slot: "trail", r: 1, name: "Trail: Lorem Ipsum", text: "Leaves placeholder text everywhere you go." },
  { id: "thearts", slot: "trail", r: 1, name: "Trail: Placeholder Hearts", text: "Love, but the art isn't final." },
  { id: "terr", slot: "trail", r: 2, name: "Trail: Error Messages", text: "Each step throws an exception." },
  { id: "trainbow", slot: "trail", r: 2, name: "Trail: Rainbow (unoptimized)", text: "Costs 4 frames per second. Worth it." },
  { id: "tcheck", slot: "trail", r: 3, name: "Trail: MISSING_TEXTURE", text: "You leave the boss behind you. Literally." },
  // ---- ultra rare: actually finished
  { id: "realhat", slot: "hat", r: 4, name: "Hat (actually has texture)", text: "Fully textured. Normal maps. The devs cried." },
  { id: "realsword", slot: "hand", r: 4, name: "Sword (fully animated)", text: "It has a swing animation. 24 frames. Unheard of." },
  { id: "realcape", slot: "back", r: 4, name: "Cape (physics enabled)", text: "It flutters. The server can barely handle it." },
  { id: "realpet", slot: "pet", r: 4, name: "Pet (with real AI)", text: "It has thoughts. Mostly about the roadmap." },
  { id: "realtrail", slot: "trail", r: 4, name: "Trail: Finished Game", text: "Leaves a trail of shipped features. Very rare." },
  // ---- Area 2 only: dropped by ENEMY_TODO while the fence is down
  { id: "hardhat", slot: "hat", r: 2, a2: true, name: "Hard Hat (Area 2)", text: "Required on site. The site is unfinished." },
  { id: "scaffold", slot: "back", r: 2, a2: true, name: "Scaffolding (Area 2)", text: "You are now under construction." },
  { id: "tcaution", slot: "trail", r: 2, a2: true, name: "Trail: Caution Tape (Area 2)", text: "Leaves DO NOT CROSS behind you. Everyone crosses." },
  { id: "oobcone", slot: "hat", r: 2, hid: true, name: "Out-of-Bounds Cone", text: "Left past the edge of the world by a dev. Proof you looked where you weren't supposed to." },
];
export const A2_DROP = 0.06; // ENEMY_TODO's chance to drop an Area 2 item

export const SLOTS = ["hat", "hand", "back", "pet", "trail"];
export const SLOT_NAMES = { hat: "Hats", hand: "Held", back: "Backs", pet: "Pets", trail: "Trails" };

// Wear 3 or more pieces of a set for a glow and the set's name under yours.
export const SETS = [
  { name: "Dev Kit", color: "#ffd34d", items: ["mug", "keyboard", "hoodie", "pbug"] },
  { name: "Placeholder", color: "#c8ccd2", items: ["cube", "spoon", "greycape", "pcube"] },
  { name: "MISSING_TEXTURE", color: "#ff00dc", items: ["notex", "shard", "checkcape", "ptex", "tcheck"] },
  { name: "Final_FINAL", color: "#6cb6ff", items: ["tophat", "final", "cape", "tlorem"] },
  { name: "Cut Content", color: "#b44dff", items: ["wizard", "wand", "wings", "trainbow"] },
  { name: "Under Construction", color: "#ff9a1f", items: ["hardhat", "scaffold", "tcaution"] },
  { name: "Asset Store", color: "#ff9a3d", items: ["cone", "baguette", "pack", "pslime"] },
];

export const DROP_CHANCE = 0.2; // per person who hit a normal slime
export const EPIC_BOSSES = 25;  // Unfinished boss loot starts after you've really helped kill this many bosses
export const isBound = (it) => it.r >= 3; // Unfinished and Finished can't be given away
export const GIFT_MIN_KILLS = 0, GIFTS_PER_DAY = Infinity; // gifting is free; only repeat Rare sends to one person are limited

// Every Finished item is earned with a long goal, never by luck. Progress shows in the Bag.
export const GOALS = {
  realhat: { k: "kills", n: 10000, how: "Kill 10,000 slimes" },
  realsword: { k: "boss", n: 150, how: "Really help kill 150 bosses" },
  realcape: { k: "days", n: 14, how: "Play on 14 different days (50+ kills each day)" },
  realpet: { k: "found", n: 40, how: "Find 40 different items from drops (no shop, wishes or gifts)" },
  realtrail: { k: "ships", n: 8, how: "Help ship 8 patches (fill at least half your share of each)" },
};
export const SHIP_KILLS = 100, DAY_KILLS = 50;
export const SCRAP = [2, 6, 25];           // coins for recycling one spare copy, by rarity
export const RAINBOW_OT = 10;              // rainbow body color unlocks at overtime ★10
export const SPIN_CD = 6000;               // spin attack cooldown (ms)
// Overtime rewards: past level 5, every 10 stars unlocks a look everyone can see. Earned only by playing.
export const OT_REWARDS = [
  { ot: 10, name: "Rainbow body color", text: "Pick it in 🎨 Me." },
  { ot: 20, name: "Sweat drops", text: "You visibly work too hard." },
  { ot: 25, name: "Gold name", text: "Your name tag turns gold." },
  { ot: 30, name: "Coffee IV", text: "A mug orbits you. It's empty." },
  { ot: 40, name: "Burnout aura", text: "You are slightly on fire." },
  { ot: 50, name: "Crunch Survivor title", text: "Wear it in 🎨 Me." },
  { ot: 60, name: "Sticky-note storm", text: "Three 'fix later' notes circle you." },
  { ot: 80, name: "Server glow", text: "You hum like a server rack." },
  { ot: 100, name: "Rainbow name", text: "Your name tag cycles colors. Go outside." },
];
// Hidden spots. Walk onto one to find it (titles for finding them). Not drawn on the map.
export const SECRETS = [
  { x: 430, y: 300, text: "Behind the house. There's no back. It's a flat picture of a house." },
  { x: 25, y: 25, text: "The top-left corner. Coordinates (0, 0). The origin of everything. It's grass." },
  { x: 800, y: 1180, text: "Past the WORLD EDGE sign: dev graffiti, and a hat someone left behind. Don't tell QA." },
  { x: 300, y: 700, text: "You tried to swim in the pond spot. It's a rectangle. You're standing on it." },
  { x: 2375, y: 1175, text: "Area 2's far corner: the dev room. One chair, one mug, one sticky note: 'fix later'." },
];
// Overtime: after level 5 your XP keeps going into unpaid overtime levels, shown as a star next to your level.
export const otNeed = (ot) => 40 + 10 * ot;

// Pick an item. rnd() returns 0..1. Bosses drop Rare, or Unfinished (epic) for veterans (epic = true).
// Finished items never drop: see GOALS.
export function rollItem(rnd, boss, epic = false) {
  if (boss) {
    const tier = epic && rnd() < 0.08 ? 3 : rnd() < 0.45 ? 2 : 1; // Rare is a 45% chance, not a guarantee
    const pool = ITEMS.map((it, i) => i).filter((i) => ITEMS[i].r === tier && !ITEMS[i].a2 && !ITEMS[i].hid);
    return pool[Math.floor(rnd() * pool.length)];
  }
  const total = ITEMS.reduce((s, it) => s + (it.a2 || it.hid ? 0 : RARITY[it.r].weight), 0);
  let x = rnd() * total;
  for (let i = 0; i < ITEMS.length; i++) {
    x -= ITEMS[i].a2 || ITEMS[i].hid ? 0 : RARITY[ITEMS[i].r].weight;
    if (x < 0) return i;
  }
  return 0;
}

// The server-wide patch bar. Everyone's kills fill it, and each full bar ships the next patch for good,
// so the whole server "finishes" the game together. "unlock" names a feature the server turns on.
// After the list runs out, every patch is "bug fixes and performance improvements" and adds nothing.
export const PATCHES = [
  { id: "bench", tease: "a bench", note: "Added a bench. The legs are in the next patch.", x: 640, y: 780, title: "BENCH", text: "Legs coming in a future patch." },
  { id: "shop", unlock: "shop", tease: "THE SHOP", note: "The SHOP is open. It sells whatever the devs had lying around. Kills give coins.", x: 1080, y: 548, title: "SHOP (OPEN)", text: "Tap the Shop button while you stand here." },
  { id: "enemies", unlock: "enemies", tease: "3 new enemies", note: "New enemies: slime_fast, SLIME_BIG_PLACEHOLDER and lag_slime. They drop better loot." },
  { id: "fountain", unlock: "fountain", tease: "a wishing fountain", note: "Added a wishing fountain. 25 coins for a random item. The water didn't load.", x: 1000, y: 380, title: "FOUNTAIN", text: "Toss 25 coins for a random item. Tap the Wish button." },
  { id: "boss2", unlock: "boss2", tease: "a new boss", note: "New boss: FINAL_BOSS_v0.1. It only has one attack. The animator quit." },
  { id: "npc", unlock: "quests", tease: "quests", note: "NPC_02 now gives quests. Nobody wrote the dialogue, so it just lists numbers.", x: 560, y: 520, title: "NPC_02", text: "QUEST_GIVER.exe. Tap the Quest button." },
  { id: "fence", unlock: "fence", tease: "a way into Area 2", note: "The Area 2 fence now has HP. Break it together to get in.", },
  { id: "cloud", unlock: "events", tease: "world events", note: "Weather added: one cloud, on a string. Also world events: Slime Rain and Bug Bounty.", x: 1150, y: 230, title: "WEATHER", text: "The whole weather system. It's one cloud." },
  { id: "pond", tease: "a pond", note: "Added a pond. Do not try to swim. It's a rectangle.", x: 300, y: 700, title: "POND (TEMP)", text: "Fishing is on the roadmap." },
  { id: "statue", tease: "a statue", note: "Added a statue of the lead dev. They left halfway through.", x: 1250, y: 760, title: "STATUE", text: "The lead dev. Scaffolding still up." },
  { id: "lamp", tease: "a lamp", note: "Added a street lamp. There is no night.", x: 900, y: 860, title: "LAMP", text: "Always on. There is no night." },
  { id: "spawn2", tease: "a second spawn point", note: "Added a second spawn point. It isn't connected to anything.", x: 1420, y: 1020, title: "SPAWN POINT 2", text: "Not connected to anything. Like the roadmap." },
];
// After the list runs out, each patch is a "hotfix": 5 minutes of double loot for everyone, plus a note.
export const HOTFIX_NOTES = [
  "Hotfix: fixed a bug where slimes had feelings. They still do. Double loot for 5 minutes as an apology.",
  "Hotfix: rebalanced the slimes by rotating them 1 degree. Double loot for 5 minutes.",
  "Hotfix: the fence now says 'ouch'. Silently. Double loot for 5 minutes.",
  "Hotfix: renamed SLIME_FINAL_v2_ACTUAL to SLIME_FINAL_v2_ACTUAL. Double loot for 5 minutes.",
  "Hotfix: removed a memory leak by adding a bigger memory leak somewhere else. Double loot for 5 minutes.",
  "Hotfix: Area 3 is 0.4% done. Double loot for 5 minutes.",
];
export const unlocked = (patch, feature) => PATCHES.slice(0, patch).some((p) => p.unlock === feature);
export const patchGoal = (n) => 40 + 20 * n + 5 * n * n; // kills needed to ship patch number n (0-based); later patches take longer
export const LAUNCH = PATCHES.length;        // patch index of "1.0 Launch": needs a release boss beaten by a crowd
export const LAUNCH_CROWD = 10;              // players who must really help beat the release boss, together
export const patchName = (n) => n < LAUNCH ? "0.0." + (n + 1) : n === LAUNCH ? "1.0" : "1.0." + (n - LAUNCH);
// No one person can fill a patch: each player's kills count for at most this share of the bar (1/5 early, 1/20 late).
export const patchShare = (n) => 1 / Math.min(10, 5 + Math.floor(n * 5 / 11)); // 5 helpers early, 10 late: never solo, still doable on a small server
export const helpersNeeded = (n) => Math.round(1 / patchShare(n));
export const BAR_MIN_KILLS = 20;             // an account's kills count toward the bar after its first 20 kills (stops instant throwaways)

// Character maker. Players send the index of each choice; the server only checks the range.
export const SHAPES = ["Circle", "Default Cube", "Blob", "Low-poly"];
export const EYES = ["Dots", "Sleepy", "Angry", "Googly", "Visor", "Placeholder X"];
export const MOUTHS = ["None", "Smile", "Grumpy", "Open", "Mustache"];
// Titles shown under your name. "need" is checked in your browser against your lifetime stats.
export const FINDABLE = ITEMS.filter((it) => it.r < 4).length; // Finished items are earned by goals, not found
export const TITLES = [
  { name: "Fresh Install", need: null },
  { name: "Slime Intern", need: { kills: 25 }, how: "Kill 25 slimes" },
  { name: "Beta Tester", need: { kills: 300 }, how: "Kill 300 slimes" },
  { name: "Unpaid QA", need: { deaths: 5 }, how: "Die 5 times" },
  { name: "Fence Enjoyer", need: { fence: 60 }, how: "Hit the Area 2 fence 60 times" },
  { name: "Combo Goblin", need: { combo: 20 }, how: "Land a 20-hit combo" },
  { name: "Hat Haver", need: { found: 5 }, how: "Find 5 different items" },
  { name: "Max Level (it's 5)", need: { lvl: 5 }, how: "Reach level 5" },
  { name: "Boss Puncher", need: { boss: 1 }, how: "Help kill MISSING_TEXTURE" },
  { name: "Collector", need: { found: 30 }, how: "Find 30 different items from drops" },
  { name: "Completionist", need: { found: FINDABLE }, how: `Find all ${FINDABLE} findable items yourself` },
  { name: "Set Enjoyer", need: { sets: 1 }, how: "Wear a full set" },
  { name: "Mostly Finished", need: { kills: 1000 }, how: "Kill 1,000 slimes" },
  { name: "Raid Regular", need: { boss: 25 }, how: "Really help kill 25 bosses" },
  { name: "Unpaid Overtime", need: { ot: 10 }, how: "Reach overtime ★10 (keep playing past level 5)" },
  { name: "Crunch Survivor", need: { ot: 50 }, how: "Reach overtime ★50" },
  { name: "Regular", need: { days: 7 }, how: "Play on 7 different days (50+ kills each)" },
  { name: "Shipped It", need: { ships: 5 }, how: "Help ship 5 patches" },
  { name: "Actually Finished", need: { fin: 5 }, how: "Earn all 5 Finished items" },
  { name: "Clipped Through", need: { secrets: 1 }, how: "Find a hidden spot" },
  { name: "QA Lead", need: { secrets: 5 }, how: "Find all 5 hidden spots" },
  { name: "Day One", need: { launch: 1 }, how: "Help beat RELEASE_CANDIDATE_1.0 when version 1.0 ships" },
];

// The shop (after patch "shop"). Prices in Placeholder Coins. Rare stock rotates daily.
export const PRICES = [15, 40, 250];
export function shopStock(day) {
  const common = ITEMS.map((it, i) => i).filter((i) => ITEMS[i].r <= 1);
  const rares = ITEMS.map((it, i) => i).filter((i) => ITEMS[i].r === 2 && !ITEMS[i].a2 && !ITEMS[i].hid);
  const pick = (arr, n, seed) => { const a = arr.slice(), out = []; let x = seed; while (out.length < n && a.length) { x = (x * 1103515245 + 12345) % 2147483648; out.push(a.splice(x % a.length, 1)[0]); } return out; };
  return [...pick(common, 6, day * 7 + 1), ...pick(rares, 2, day * 13 + 5)];
}
export const WISH_COST = 25;

// NPC_02's quests (after patch "quests"). k = what to count.
export const QUESTS = [
  { k: "kills", n: 20, text: "Kill 20 slimes. Any slimes. They're all the same asset.", coins: 25 },
  { k: "kills", n: 40, text: "Kill 40 slimes. QA needs the numbers.", coins: 50 },
  { k: "combo", n: 10, text: "Land a 10-hit combo. To test the combo system. It's untested.", coins: 30 },
  { k: "big", n: 3, text: "Kill 3 SLIME_BIG_PLACEHOLDERs. Watch them split. That's the feature.", coins: 40 },
  { k: "fast", n: 5, text: "Kill 5 slime_fasts. They're unbalanced. Balance them with violence.", coins: 35 },
  { k: "fence", n: 30, text: "Hit the Area 2 fence 30 times. For science.", coins: 30 },
  { k: "boss", n: 1, text: "Help kill a boss. Any boss. We only have two.", coins: 80 },
  { k: "emote", n: 5, text: "Emote 5 times. Social features need engagement metrics.", coins: 15 },
];

// SKILLS: the shop sells the skills the devs cut. Coins buy levels; each level costs more, forever-ish.
// They make fighting feel better (faster swings, bigger spins, harder counters, a dash) but never block anyone.
export const SKILLS = [
  { k: "swing", name: "Swing speed", text: "Swing 25ms faster per level. The animation was always optional.", max: 10 },
  { k: "spin", name: "Spin", text: "Spin cools down 0.4s faster and reaches 8px further per level.", max: 10 },
  { k: "counter", name: "Counter", text: "Counter crits after a dodge hit 30% harder per level.", max: 10 },
  { k: "dash", name: "Dash", text: "Dash cools down 0.25s faster and goes 10px further per level.", max: 10 },
];
export const skillCost = (lvl) => 40 * (lvl + 1) * (lvl + 1); // 40, 160, 360 ... 4,400 for level 10
export const swingMs = (lv) => 450 - 25 * (lv || 0);
export const spinCd = (lv) => SPIN_CD - 400 * (lv || 0);
export const dashCd = (lv) => 4000 - 250 * (lv || 0);

// fake dev notes, one per shipped patch, shown in the credits
export const DEV_NOTES = [
  "Slimes now have eyes. Sorry about before.",
  "Fixed a bug where the bench had legs. It was too finished.",
  "Grass is now 4% greener. We measured.",
  "Removed the 'win game' button. It was for testing.",
  "Players can no longer walk through walls. There are no walls.",
  "Lowered gravity by 0. Nobody noticed last time either.",
  "The lamp is still always on. That's a feature now.",
  "Slime AI improved: they now chase you on purpose.",
  "Fixed the tutorial guy saying 'Press W'. (We did not fix it.)",
  "Added sound to the music. Music was silent in the build we tested.",
  "Rebalanced loot. We rolled a die. It said 'fine'.",
  "Known issue: everything. Workaround: keep playing.",
];
