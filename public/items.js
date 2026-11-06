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
