# Platinum Audit — The Leonida 55

An offline trophy guide and tracker for the 55 trophies of **Grand Theft Auto VI** on PlayStation 5 — every guide step cited, every disagreement between sources shown both ways.

![make.fun entry](https://make.fun/badge/gta6-trophy-guide-01.svg)
![make.fun rank](https://make.fun/badge/gta6-trophy-guide-01/mangkarones3-afk/gta6-trophy-guide-01/rank.svg)
![make.fun reward](https://make.fun/badge/gta6-trophy-guide-01/mangkarones3-afk/gta6-trophy-guide-01/reward.svg)

Entry page: [gta6-trophy-guide-01 on make.fun](https://make.fun/c/gta6-trophy-guide-01)

## What this guide is

- **Tracker** — all 55 official trophies with their official name, description and grade (1 platinum, 2 gold, 6 silver, 46 bronze, 28 PSN-hidden). Progress is saved in the browser (localStorage), with Export and Import as a JSON file. Filters by kind (story, missable, collectibles, activities, online), by grade, by PSN-hidden and disputed status, plus full-text search. A spoiler shield masks unearned story trophies until they are earned.
- **Roadmap** — the platinum in stage order: story chapters, stranger strands, counted grinds, 100% completion, finale. About 200 hours, difficulty 4/10, one playthrough, no online trophies required.
- **Missables** — exactly **1 possibly-missable** trophy (Positive Mental Attitude, whose Chapter 1 window closes when The Cartel Heist ends the chapter), 9 at-risk and the watch list, each with its exact closing event named.
- **Cited guidance** — every numbered step in every guide carries source chips into a registry of **95 pages across 32 sites**, all read on 20 Nov 2026. The audit, computed from the guide's own data at runtime: **607 claims cited, 607 of them backed by 2+ sources, 55 disputes shown both ways (A says / B says / our call), 55/55 guides citing sources.**
- **Count steppers** — every counted trophy (250 stunts, 42 shooting-range golds, 18 meditation spots, 100 WAiNK locations, $250,000 laundered, and the rest) tracks progress with a stepper and a "left" counter, feeding the collectibles-logged total in the header.

## How to run

The app is plain static files with no build step and no network use:

- Open `app/index.html` in a browser via any static file server, e.g. `node --experimental-strip-types serve` alternatives aside, the simplest is: `cd app && python3 -m http.server 8080` and visit the local address it prints.
- Or run the entrypoint, which assembles the submission output: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` — this copies `app/` and `screenshots/` into `out/` and writes `out/dossier.json`.

Source paths in the registry are shown as text for citation only; the app never loads them and makes zero network requests.

## Layout

- `app/index.html`, `app/style.css`, `app/app.js` — the whole app (vanilla, no libraries).
- `app/data/trophies.json` — the 55 trophies: official name, description and grade, plus our own guide, steps with citations, counts, missable tiers and disputes.
- `app/data/sources.json` — the source registry: 95 pages, 32 sites, read 20 Nov 2026.
- `screenshots/` — four captures of the running app: tracker cover, roadmap, missables, sources and audit.
- `main.ts` — the make.fun entrypoint; `vendor/makefun-frontend.ts` is the kit's dossier library, unchanged.

## License

MIT — see `LICENSE`.

---

Built for the make.fun GTA 6 trophy guide bounty. Try make.fun: https://make.fun/r/ram1fzcx
