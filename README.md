# The Unfinished Tutorial

**Play: https://unfinished-tutorial.connharr1230.workers.dev** (open it on two devices, or send the link to a friend)

A tiny real MMO. Everyone is stuck in a game's starting area because the rest of the game never shipped.
Walk around with real people, chat, and fight slimes together. Tap to move, tap a slime to fight it.
Everyone who hits a slime gets the XP.
Slimes drop placeholder loot (hats and held items with no stats). Tap Bag to wear it; your bag is saved in your browser.

Runs on one Cloudflare Worker plus one Durable Object (the shared world), on the free plan.

- `npm install` then `npm run dev` to play locally at http://localhost:8787
- `npm run deploy` (or Cloudflare's "Import a repository") to put it online
