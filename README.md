# The Unfinished Tutorial

A tiny real MMO. Everyone is stuck in a game's starting area because the rest of the game never shipped.
Walk around with real people, chat, and fight slimes together. Tap to move, tap a slime to fight it.
Everyone who hits a slime gets the XP.

Runs on one Cloudflare Worker plus one Durable Object (the shared world), on the free plan.

- `npm install` then `npm run dev` to play locally at http://localhost:8787
- `npm run deploy` (or Cloudflare's "Import a repository") to put it online
