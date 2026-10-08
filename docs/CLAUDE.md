# Little Hanzi 小汉字 — Project guide for Claude Code

Chinese character learning web app for children aged ~5–8. v1 = a fully working **Level A1** module (30 words, 8-station path, 4 activities). Later levels (A2–A9) must be addable **by data only**.

## Sources of truth

| What | Where | Wins on |
|---|---|---|
| Learning logic, data, rules | `docs/LittleHanzi_Brief.md` | Behaviour, word sets, tracking, level check |
| Visual design | Figma: https://www.figma.com/design/2AUmUBlMM1m4eYiYEjNy7H | Colours, type, components, layouts |
| User flow | FigJam: https://www.figma.com/board/0M7EkY1ZCPp1pYs6BPWFgi | Screen order, branches, decision points |
| Decisions made after the brief | "Decisions" section below | Overrides the brief where they differ |

The Figma file has 4 pages: **Cover**, **Foundations** (tokens, type, spacing, rules), **Components** (all UI parts with variants), **Wireframes** (14 iPad landscape screens + clickable prototype). Use the Figma MCP server to read frames (design context, variables, screenshots) before building each screen.

## Decisions (override the brief)

0. **Where the sources disagree, the Figma wireframe wins.** The FigJam flow board omits
   the age step in profile creation; wireframe 03 (`8:194`) has it, so age stays.
1. **Profile = name + age + avatar.** Age is picked from big buttons 3–9 and shown as "6 岁". Avatar = animal art (Panda, Bunny, Cat to start) on one of 5 colours (persimmon, jade, sky, sunshine, plum). Store `{ art, color }`, not an emoji.
2. **Audio files live in `audio/a1/`** so the manifest paths (`audio/a1/…`) work unchanged. Do not rewrite manifest paths.
3. **Pinyin Match layout:** landscape = characters in one row, pinyin in a second row. Portrait (phone) = two side-by-side columns.
4. **No scores, percentages or stars shown to the child.** Level check (80% first-try) runs silently; child sees "Level A1 done!" or "So close!".
5. **A2 shows "Coming soon"** on the level-passed screen until `data/a2.json` exists. A2–A9 show locked on Pick a level.
6. **Welcome screen only on first launch** (no profiles yet). Its Start tap unlocks audio. Afterwards the app opens on "Who's playing?", where tapping a profile also unlocks audio.
7. **Home button** on the path goes to "Who's playing?" (switch child). Home inside an activity goes back to the path. Leaving mid-station discards that station's in-progress state but keeps the word stats already recorded.
8. **Feedback sounds:** soft, short, friendly (chime for correct, gentle "boop" for try again). Never a buzzer. Synthesise with Web Audio or add tiny SFX files in `audio/sfx/`.
9. **No read-aloud speaker on "Who's playing?" or "Pick a level"** (a grown-up handles setup). "Well done!" keeps its speaker.
10. **Grown-ups page** (`#/parents`): reached from the grown-up button top-right of "Who's playing?", behind a maths gate (two-digit addition; a wrong answer gives a fresh sum). Holds: players (Edit, Level, Reset, Delete), a sound-effects toggle (word audio always plays), feedback by email to hello@pejabatdigital.com, and an About note. The gate stays passed only until "Who's playing?" shows again (`session.js`, in memory). Edit reuses New player (`#/new-player?edit=<id>`); Level reuses Pick a level (`#/levels?for=<id>`). Reset clears progress on every level plus the one-off flags, keeping name, avatar and level. Confirmations use the in-app dialog in `ui.js`, never `confirm()`.

## Tech

- Static site: `index.html` + CSS + vanilla JavaScript (ES modules). **No build step, no framework** unless I approve one.
- Hosted from GitHub on **Cloudflare Pages** (framework preset: None, build command: empty, output directory: `/`).
- Fonts: **Nunito** (600, 700, 800) for UI and pinyin, **Noto Sans SC** (500, 700) for Chinese characters, both from Google Fonts.
- Progress saved in **localStorage** through `js/storage.js` only. Nothing else touches localStorage. Its API is async (returns Promises) so it can later move to Cloudflare D1/KV for cross-device sync without changing callers.
- Target devices: iPad Safari (main), phone Safari/Chrome, MacBook. Touch first. Portrait and landscape.

## Folder structure

```
/index.html
/css/tokens.css          design tokens (below), nothing else
/css/base.css            reset, fonts, layout, screen shell
/css/components.css      one block per Figma component
/js/app.js               boot, simple hash router, screen switching
/js/storage.js           ONLY module that reads/writes localStorage
/js/data.js              loads data/levels.json and data/<level>.json
/js/audio.js             unlock, preload, play word + sfx
/js/engine/tracking.js   per-word stats + difficult flag rules
/js/engine/path.js       station unlocking, station word sets, weakest-first
/js/engine/station.js    activity sequence, retry queue, first-try counting
/js/activities/this-or-that.js
/js/activities/identification.js
/js/activities/pinyin-match.js
/js/activities/memory-match.js
/js/screens/*.js         welcome, profiles, new-player, levels, path, station, done, level-result, parents (Grown-ups)
/data/levels.json        [{ "id": "A1", "file": "data/a1.json", "available": true }, { "id": "A2", "available": false }, …]
/data/a1.json            30 words, shape in the brief (§3)
/audio/a1/*.mp3          + a1_manifest.json
/assets/icons/*.svg      exported from Figma Components → Icon (currentColor)
/js/icons.js             GENERATED from assets/icons/*.svg — do not hand-edit the paths
/js/ui.js                DOM builders, one per Figma component
/js/tests/engine-tests.js  engine assertions, run by tests.html and Node
/js/session.js           in-memory only (draft profile, current station run)
/components.html         component gallery (all variants + audio bench)
/tests.html              engine test runner
/screens-test.html       drives screens 01-05 for real (WIPES saved profiles)
/assets/avatars/*.svg    exported from Figma Components → Avatar Art
/docs/LittleHanzi_Brief.md
```

## Design tokens (`css/tokens.css`)

Names match the Figma variables' code syntax exactly. Use semantic tokens in components; primitives only inside tokens.css.

```css
:root {
  /* Primitives */
  --cream-50:#FFFBF4; --cream-100:#FFF4E3; --cream-200:#F6E7D0; --cream-300:#EBD6B6;
  --ink-900:#2B2633; --ink-600:#5F5868; --ink-400:#9A92A3; --white:#FFFFFF;
  --persimmon-100:#FFE6D3; --persimmon-500:#FF7A3D; --persimmon-700:#D9561C;
  --jade-100:#D6F3EA; --jade-500:#1FA884; --jade-700:#137A5F;
  --sky-100:#DCEBFC; --sky-500:#3D8FE8; --sky-700:#2367B3;
  --sunshine-100:#FFF3C7; --sunshine-500:#FFC63A; --sunshine-700:#C98F00;
  --plum-100:#ECE3FC; --plum-500:#8A63E0; --plum-700:#6440B3;

  /* Semantic colour */
  --color-bg-app:var(--cream-100); --color-bg-surface:var(--white); --color-bg-sunken:var(--cream-200); --color-bg-soft:var(--cream-50);
  --color-text-primary:var(--ink-900); --color-text-secondary:var(--ink-600); --color-text-disabled:var(--ink-400); --color-text-on-accent:var(--white);
  --color-icon-default:var(--ink-900); --color-icon-on-accent:var(--white);
  --color-border-default:var(--cream-300); --color-border-selected:var(--sky-500);
  --color-action-primary:var(--persimmon-500); --color-action-primary-edge:var(--persimmon-700); --color-action-primary-soft:var(--persimmon-100);
  --color-action-audio:var(--sky-500); --color-action-audio-edge:var(--sky-700); --color-action-audio-soft:var(--sky-100);
  --color-feedback-correct:var(--jade-500); --color-feedback-correct-edge:var(--jade-700); --color-feedback-correct-soft:var(--jade-100);
  --color-feedback-try-again:var(--sunshine-500); --color-feedback-try-again-edge:var(--sunshine-700); --color-feedback-try-again-soft:var(--sunshine-100);
  --color-state-locked:var(--ink-400); --color-state-locked-soft:var(--cream-200);
  --color-activity-this-or-that:var(--sky-500);
  --color-activity-identification:var(--plum-500); --color-activity-identification-edge:var(--plum-700); --color-activity-identification-soft:var(--plum-100);
  --color-activity-pinyin-match:var(--jade-500);
  --color-activity-memory-match:var(--persimmon-500);

  /* Dimensions */
  --spacing-xs:4px; --spacing-sm:8px; --spacing-md:16px; --spacing-lg:24px; --spacing-xl:32px; --spacing-2xl:48px;
  --radius-sm:12px; --radius-md:20px; --radius-lg:28px; --radius-full:999px;
  --size-tap-min:64px; --size-tap-lg:88px; --size-edge:6px;

  /* Elevation */
  --elevation-soft:0 4px 12px rgba(43,38,51,.08);
  --elevation-raised:0 10px 28px rgba(43,38,51,.14);

  /* Fonts */
  --font-ui:"Nunito", system-ui, sans-serif;
  --font-hanzi:"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", sans-serif;
}
```

### Typography

| Style | Font | Size / line height | Use |
|---|---|---|---|
| Character/XL | Noto Sans SC 500 | 160 / 176 | Identification card |
| Character/L | Noto Sans SC 500 | 96 / 112 | This or That cards |
| Character/M | Noto Sans SC 500 | 56 / 68 | Pinyin Match, Memory Match |
| Heading/Title | Nunito 800 | 40 / 48 | Screen titles (short) |
| Heading/Section | Nunito 800 | 28 / 36 | Profile names, banners |
| Label/Button | Nunito 800 | 24 / 28 | Buttons |
| Pinyin/L | Nunito 700 | 32 / 40 | Flipped Identification card |
| Pinyin/M | Nunito 700 | 24 / 32 | Pinyin chips |
| Body/Default | Nunito 600 | 20 / 28 | Short helper text |
| Body/Small | Nunito 700 | 16 / 22 | Grown-up notes, captions |

On phones, scale Character and Heading sizes down with `clamp()`, but never let tap targets go below 64px.

## Components (match Figma → Components page)

All interactive elements have the **chunky edge**: a 6px bottom border (`--size-edge`) in the darker "edge" colour. **Pressed state** (code only): `transform: translateY(4px)` and bottom border 2px.

| Component | Variants | Spec |
|---|---|---|
| Icon | Speaker, Play, Home, Back, Check, Retry, Lock, Plus, Flag, Grown-up | Rounded line icons, 24 grid, inline SVG with `currentColor` |
| Button | Style: Primary, Audio, Correct, Try again, Secondary × State: Default, Disabled | 88px tall, radius-lg, icon + short label; icon must carry the meaning |
| Round Button | Style: Audio, Primary, Secondary × Size: L 112px, M 64px | L = big replay speaker on every activity |
| Character Card | Size: L 240×260, M 144×160 × State: Default, Selected, Correct, Try again, Face down | Face down = persimmon with white "?" |
| Pinyin Chip | Default, Selected, Matched, Try again | 176×76 pill. Try again = shake 300ms then Default |
| Speaker Card | Face down, Face up, Matched | 144×160, Memory Match audio card |
| Avatar | Size: L 120, M 80, S 56 × Color: 5 | Animal art (72% size) on soft colour circle, white 4px ring |
| Profile Card | Default, Add new | 240×300: avatar L, name, age chip "6 岁". Add new = dashed border + Plus |
| Station Node | Kind: Station, Level check × State: Locked, Current, Completed | 104px circle. Current = persimmon with number (+ "Go" bubble); Level check current = plum with flag |
| Activity Badge | This or That, Identification, Pinyin Match, Memory Match | Small pill in the activity colour |
| Feedback Banner | Correct, Try again | 560px, slides up from bottom, icon circle + short message |
| Progress Bar | 0–100 | 480×24 track, jade fill, top of every activity screen |
| Grown-up Note | single | Plum pill: "Play this one with a grown-up", Identification first use only |

## Screens (Figma → Wireframes, iPad landscape 1194×834)

| # | Screen | Figma link |
|---|---|---|
| 01 | Welcome | https://www.figma.com/design/2AUmUBlMM1m4eYiYEjNy7H?node-id=8-3 |
| 02 | Who's playing | https://www.figma.com/design/2AUmUBlMM1m4eYiYEjNy7H?node-id=8-100 |
| 03 | New player | https://www.figma.com/design/2AUmUBlMM1m4eYiYEjNy7H?node-id=8-194 |
| 04 | Pick a level | https://www.figma.com/design/2AUmUBlMM1m4eYiYEjNy7H?node-id=8-331 |
| 05 | Level path | https://www.figma.com/design/2AUmUBlMM1m4eYiYEjNy7H?node-id=9-197 |
| 06 | This or That | https://www.figma.com/design/2AUmUBlMM1m4eYiYEjNy7H?node-id=9-277 |
| 07 | This or That — correct | https://www.figma.com/design/2AUmUBlMM1m4eYiYEjNy7H?node-id=9-305 |
| 08 | Identification | https://www.figma.com/design/2AUmUBlMM1m4eYiYEjNy7H?node-id=9-336 |
| 09 | Identification — flipped | https://www.figma.com/design/2AUmUBlMM1m4eYiYEjNy7H?node-id=9-369 |
| 10 | Pinyin Match | https://www.figma.com/design/2AUmUBlMM1m4eYiYEjNy7H?node-id=10-309 |
| 11 | Memory Match | https://www.figma.com/design/2AUmUBlMM1m4eYiYEjNy7H?node-id=10-346 |
| 12 | Well done | https://www.figma.com/design/2AUmUBlMM1m4eYiYEjNy7H?node-id=10-402 |
| 13 | Level check — passed | https://www.figma.com/design/2AUmUBlMM1m4eYiYEjNy7H?node-id=10-454 |
| 14 | Level check — try again | https://www.figma.com/design/2AUmUBlMM1m4eYiYEjNy7H?node-id=10-497 |

Each wireframe has a caption under it in Figma describing its behaviour. Read it.

## Data model (storage.js)

```js
// localStorage keys (versioned)
"lh:v1:profiles"            -> [{ id, name, age, avatar: { art: "panda", color: "persimmon" }, levelId: "A1", createdAt }]
"lh:v1:progress:<profileId>" -> {
  A1: {
    completedStations: [1, 2],      // replayable
    unlockedStation: 3,
    passed: false,
    words: {
      a1_01: { seen: 0, correct: 0, wrong: 0, streak: 0, difficult: false, lastWrongAt: null }
    }
  }
}
```

Also stored (added after v1 planning):

```js
"lh:v1:flags:<profileId>"   -> { "identification-note": true }  // one-off per-child flags
"lh:v1:settings"            -> { sfx: true }            // device-wide, Grown-ups page
```

Keep this data clean and complete: future stars, scores and rankings will be built on it.

## Engine rules (from the brief, summarised)

- **Stations:** 1 = words 1–5. 2–6 = next 5 new words + up to 5 difficult words. 7 and 8 = 10 review words, weakest first. Station 8 = level check.
- **Difficult:** set on any wrong answer. Cleared after 2 correct in a row. Carry at most 5 into a station, most recently missed first.
- **Weakest first:** sort by `lastWrongAt` (most recent first), then accuracy (correct ÷ seen, lowest first). Take 10; if fewer than 10 are weak, fill at random from the level.
- **Inside a station:** stations 1–6 start with This or That for the new words, then 2 random activities from Identification / Pinyin Match / Memory Match (no Memory Match in station 1). Stations 7–8: 3 random activities from all four. Aim for ~5 minutes.
- **Mistakes:** a missed word is re-queued later in the same station so the child always ends on a correct answer.
- **Level check:** count first-try answers in station 8 only. ≥ 80% → passed (A2 unlocks when its data exists). Below → friendly retry with a fresh weakest-first set.
- **Pinyin Match / Memory Match fill:** if the station has fewer words than needed (5 / 6), fill from other already-introduced A1 words.
- **Memory Match mistake:** recorded when the child flips a character card and a non-matching speaker card (or vice versa) after both were already seen once.

## Audio (audio.js) — iOS is the hard part

- Use the **Web Audio API** (`AudioContext` + `decodeAudioData` buffers) for word playback, not new `<audio>` elements per tap.
- **Unlock** on the first user tap (Welcome Start or a profile card): create/resume the AudioContext and play a silent buffer.
- **Preload** all audio for a station before it starts. Show a short loading state if needed.
- Re-resume the context if iOS suspends it (e.g. after the tab was in the background).

## Router contract (easy to break)

- Renders are **serialised**: `render()` queues if one is already running, then
  re-reads the hash. Never render two screens at once.
- A screen is built **off-document** and swapped in only when it resolves, so a
  half-built screen is never visible. Anything that needs real measurements
  (the path trail) must re-measure after insertion — use a ResizeObserver plus
  a `requestAnimationFrame`, not a measurement taken during render.
- A screen renderer returns an optional cleanup function. It MUST tear down
  timers, observers and audio.
- **Never block a render on audio.** `audio.unlock()` is fired, not awaited;
  `preload()` happens after the screen is up, behind a loading state, and is
  bounded by a timeout. Decoding can silently never call back.

## Working rules for Claude

- Build **in phases** (below). At the end of each phase: run it locally (`npx serve .` or `python3 -m http.server`), summarise what changed, commit with a clear message, then **stop and wait for review**.
- Read the Figma frame for a screen (via the Figma MCP) before building it. Match tokens and components; do not invent new colours or sizes.
- No frameworks, bundlers or new dependencies without asking.
- Never show red, X marks or harsh sounds for wrong answers.
- No English reading required to play: every action has an icon, and text stays short and large.
- Check layouts at 1194×834 (iPad landscape), 834×1194 (iPad portrait) and 390×844 (phone portrait).
- Don't change the data shapes above without asking.

## Build phases

1. **Foundation:** folder structure, tokens.css, fonts, base layout, icon and avatar SVGs, `data/levels.json` + `data/a1.json` (from the brief's word table + manifest), `storage.js`, `data.js`, `audio.js` (unlock + preload + play), hash router.
2. **Profiles:** screens 01–04. Create/select profiles with name, age, avatar; level picker (A1 open, A2–A9 locked).
3. **Path + engine:** screen 05, `tracking.js`, `path.js`, `station.js` with unit-style checks for the word-set, difficult and weakest-first rules (a simple `tests.html` page is fine).
4. **Activities:** This or That (06–07), Identification (08–09), Pinyin Match (10), Memory Match (11). One activity at a time, each reviewed on a real iPad. ✅
5. **Endings:** Well done (12) ✅, level check result (13–14), replaying completed stations.
6. **Polish + ship:** feedback sounds, transitions, landscape/portrait/phone checks, test on iPad Safari, deploy to Cloudflare Pages with the custom domain.

Live at https://littlehanzi.kasahkod.cc (Cloudflare Pages, auto-deploys from main).
Note: Cloudflare strips `.html`, so `/tests.html` redirects to `/tests`.

## Done when (from the brief §11)

- [ ] A child can create a profile (name, age, avatar), choose A1 and see the 8-station path.
- [ ] All 4 activities work on iPad Safari and phone, with audio playing reliably.
- [ ] Stations 1–6 introduce all 30 words, 5 per station, with difficult words carried forward (max 5).
- [ ] Missed words come back within the same station.
- [ ] Stations 7–8 pick the weakest words first; station 8 passes at 80% first-try.
- [ ] Progress survives closing and reopening the app, per profile.
- [ ] Adding a new level only needs `data/aX.json`, audio files and an entry in `data/levels.json`.
- [ ] Deployed to Cloudflare Pages from the GitHub repo.
