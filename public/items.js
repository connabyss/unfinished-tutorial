// Loot table, shared by the server (src/worker.js) and the page (index.html).
// Order matters: players send and receive items by their position in this list, so only ever add to the end.
export const RARITY = [
  { name: "Common", color: "#d8d8d8", weight: 60 },
  { name: "Uncommon", color: "#7be36a", weight: 30 },
  { name: "Rare", color: "#6cb6ff", weight: 10 },
  { name: "Unfinished", color: "#ff7bf0", weight: 0 }, // only from bosses
  { name: "Finished", color: "#ffd700", weight: 0.4 },  // ultra rare: the only things the devs actually finished
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
];

export const SLOTS = ["hat", "hand", "back", "pet", "trail"];
export const SLOT_NAMES = { hat: "Hats", hand: "Held", back: "Backs", pet: "Pets", trail: "Trails" };

// Wear 3 or more pieces of a set for a glow and the set's name under yours.
export const SETS = [
  { name: "Dev Kit", color: "#ffd34d", items: ["mug", "keyboard", "hoodie", "pbug"] },
  { name: "Placeholder", color: "#c8ccd2", items: ["cube", "spoon", "greycape", "pcube"] },
  { name: "MISSING_TEXTURE", color: "#ff00dc", items: ["notex", "shard", "checkcape", "ptex", "tcheck"] },
  { name: "Final_FINAL", color: "#6cb6ff", items: ["tophat", "final", "cape", "tlorem"] },
  { name: "Cut Content", color: "#b44dff", items: ["wizard", "wand", "wings", "trainbow"] },
  { name: "Asset Store", color: "#ff9a3d", items: ["cone", "baguette", "pack", "pslime"] },
];

export const DROP_CHANCE = 0.3; // per person who hit a normal slime

// Pick an item. rnd() returns 0..1. Bosses drop Rare or better (and sometimes something Finished).
export function rollItem(rnd, boss) {
  if (boss) {
    const x = rnd(), tier = x < 0.04 ? 4 : x < 0.34 ? 3 : 2;
    const pool = ITEMS.map((it, i) => i).filter((i) => ITEMS[i].r === tier);
    return pool[Math.floor(rnd() * pool.length)];
  }
  const total = ITEMS.reduce((s, it) => s + RARITY[it.r].weight, 0);
  let x = rnd() * total;
  for (let i = 0; i < ITEMS.length; i++) {
    x -= RARITY[ITEMS[i].r].weight;
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
  { id: "fountain", unlock: "fountain", tease: "a wishing fountain", note: "Added a wishing fountain. 10 coins for a random item. The water didn't load.", x: 1000, y: 380, title: "FOUNTAIN", text: "Toss 10 coins for a random item. Tap the Wish button." },
  { id: "boss2", unlock: "boss2", tease: "a new boss", note: "New boss: FINAL_BOSS_v0.1. It only has one attack. The animator quit." },
  { id: "npc", unlock: "quests", tease: "quests", note: "NPC_02 now gives quests. Nobody wrote the dialogue, so it just lists numbers.", x: 560, y: 520, title: "NPC_02", text: "QUEST_GIVER.exe. Tap the Quest button." },
  { id: "fence", unlock: "fence", tease: "a way into Area 2", note: "The Area 2 fence now has HP. Break it together to get in.", },
  { id: "cloud", unlock: "events", tease: "world events", note: "Weather added: one cloud, on a string. Also world events: Slime Rain and Bug Bounty.", x: 1150, y: 230, title: "WEATHER", text: "The whole weather system. It's one cloud." },
  { id: "pond", tease: "a pond", note: "Added a pond. Do not try to swim. It's a rectangle.", x: 300, y: 700, title: "POND (TEMP)", text: "Fishing is on the roadmap." },
  { id: "statue", tease: "a statue", note: "Added a statue of the lead dev. They left halfway through.", x: 1250, y: 760, title: "STATUE", text: "The lead dev. Scaffolding still up." },
  { id: "lamp", tease: "a lamp", note: "Added a street lamp. There is no night.", x: 900, y: 860, title: "LAMP", text: "Always on. There is no night." },
  { id: "spawn2", tease: "a second spawn point", note: "Added a second spawn point. It isn't connected to anything.", x: 1420, y: 1020, title: "SPAWN POINT 2", text: "Not connected to anything. Like the roadmap." },
];
export const unlocked = (patch, feature) => PATCHES.slice(0, patch).some((p) => p.unlock === feature);
export const patchGoal = (n) => 40 + 20 * n; // kills needed to ship patch number n (0-based)
export const patchName = (n) => "0.0." + (n + 1);

// Character maker. Players send the index of each choice; the server only checks the range.
export const SHAPES = ["Circle", "Default Cube", "Blob", "Low-poly"];
export const EYES = ["Dots", "Sleepy", "Angry", "Googly", "Visor", "Placeholder X"];
export const MOUTHS = ["None", "Smile", "Grumpy", "Open", "Mustache"];
// Titles shown under your name. "need" is checked in your browser against your lifetime stats.
export const TITLES = [
  { name: "Fresh Install", need: null },
  { name: "Slime Intern", need: { kills: 25 }, how: "Kill 25 slimes" },
  { name: "Beta Tester", need: { kills: 150 }, how: "Kill 150 slimes" },
  { name: "Unpaid QA", need: { deaths: 5 }, how: "Die 5 times" },
  { name: "Fence Enjoyer", need: { fence: 60 }, how: "Hit the Area 2 fence 60 times" },
  { name: "Combo Goblin", need: { combo: 20 }, how: "Land a 20-hit combo" },
  { name: "Hat Haver", need: { found: 5 }, how: "Find 5 different items" },
  { name: "Max Level (it's 5)", need: { lvl: 5 }, how: "Reach level 5" },
  { name: "Boss Puncher", need: { boss: 1 }, how: "Help kill MISSING_TEXTURE" },
  { name: "Collector", need: { found: 25 }, how: "Find 25 different items" },
  { name: "Completionist", need: { found: ITEMS.length }, how: `Find all ${ITEMS.length} items` },
  { name: "Set Enjoyer", need: { sets: 1 }, how: "Wear a full set" },
  { name: "Mostly Finished", need: { kills: 1000 }, how: "Kill 1,000 slimes" },
];

// The shop (after patch "shop"). Prices in Placeholder Coins. Rare stock rotates daily.
export const PRICES = [15, 40, 120];
export function shopStock(day) {
  const common = ITEMS.map((it, i) => i).filter((i) => ITEMS[i].r <= 1);
  const rares = ITEMS.map((it, i) => i).filter((i) => ITEMS[i].r === 2);
  const pick = (arr, n, seed) => { const a = arr.slice(), out = []; let x = seed; while (out.length < n && a.length) { x = (x * 1103515245 + 12345) % 2147483648; out.push(a.splice(x % a.length, 1)[0]); } return out; };
  return [...pick(common, 6, day * 7 + 1), ...pick(rares, 2, day * 13 + 5)];
}
export const WISH_COST = 10;

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
