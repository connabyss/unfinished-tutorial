# The Unfinished Tutorial

**Play: https://unfinished-tutorial.connabyss.workers.dev** (open it on two devices, or send the link to a friend)

A tiny real MMO. Everyone is stuck in a game's starting area because the rest of the game never shipped.
Walk around with real people, chat, and fight slimes together. Tap to move, tap a slime to fight it, tap Spin to hit everything nearby.
Every kill fills a server-wide patch bar, and each patch unlocks something real (a shop, new enemies, a second boss, quests, a fence into Area 2).
Slimes drop placeholder loot to wear: hats, held items, backs, pets and trails, all with no stats. The gold Finished items can't drop: each one is earned with a long goal.
Your character (name, level, loot, coins, looks) is saved on the server under a save code shown in the Me panel.

Runs on one Cloudflare Worker plus one Durable Object (the shared world), on the free plan.

- `npm install` then `npm run dev` to play locally at http://localhost:8787
- `npm run deploy` (or Cloudflare's "Import a repository") to put it online
