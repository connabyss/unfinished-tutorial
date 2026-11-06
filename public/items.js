// Loot table, shared by the server (src/worker.js) and the page (index.html).
// Order matters: players send and receive items by their position in this list, so only ever add to the end.
export const RARITY = [
  { name: "Common", color: "#d8d8d8", weight: 60 },
  { name: "Uncommon", color: "#7be36a", weight: 30 },
  { name: "Rare", color: "#6cb6ff", weight: 10 },
  { name: "Unfinished", color: "#ff7bf0", weight: 0 }, // only from MISSING_TEXTURE
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
];

export const DROP_CHANCE = 0.22; // per person who hit a normal slime

// Pick an item. rnd() returns 0..1. Bosses only drop Rare or Unfinished.
export function rollItem(rnd, boss) {
  if (boss) {
    const tier = rnd() < 0.3 ? 3 : 2;
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

// The server-wide patch bar. Everyone's kills fill it; each full bar "ships" the next thing for good.
// After the list runs out, every patch is "bug fixes and performance improvements" and adds nothing.
export const PATCHES = [
  { id: "bench", note: "Added a bench. The legs are in the next patch.", x: 640, y: 780, title: "BENCH", text: "Legs coming in a future patch." },
  { id: "fountain", note: "Added a fountain. The water didn't load.", x: 1000, y: 380, title: "FOUNTAIN", text: "water.png not found." },
  { id: "npc", note: "Added a second NPC. Nobody wrote their lines.", x: 560, y: 520, title: "NPC_02", text: "Hi! [DIALOGUE MISSING]" },
  { id: "cloud", note: "Added weather: one cloud, on a string.", x: 1150, y: 230, title: "WEATHER", text: "The whole weather system. It's one cloud." },
  { id: "pond", note: "Added a pond. Do not try to swim. It's a rectangle.", x: 300, y: 700, title: "POND (TEMP)", text: "Fishing is on the roadmap." },
  { id: "statue", note: "Added a statue of the lead dev. They left halfway through.", x: 1250, y: 760, title: "STATUE", text: "The lead dev. Scaffolding still up." },
  { id: "spawn2", note: "Added a second spawn point. It isn't connected to anything.", x: 1420, y: 1020, title: "SPAWN POINT 2", text: "Not connected to anything. Like the roadmap." },
  { id: "lamp", note: "Added a street lamp. There is no night.", x: 900, y: 860, title: "LAMP", text: "Always on. There is no night." },
];
export const patchGoal = (n) => 50 + 25 * n; // kills needed to ship patch number n (0-based)
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
  { name: "Completionist (16/16)", need: { found: 16 }, how: "Find all 16 items" },
  { name: "Mostly Finished", need: { kills: 1000 }, how: "Kill 1,000 slimes" },
];
