# Little Hanzi 小汉字: Build Brief (v1, Level A1)

## 1. What we're building

Little Hanzi is a Chinese character learning web app for young children (around 5–8). The words come from the levels used at the kids' Chinese centre (A1–A9, 30 words each).

**Goal of v1:** a fully working **A1 module**: a child creates a profile, plays through a path of 8 stations, and by the end can recognise all 30 A1 characters.

The app must be built so A2–A9 can be added later **by adding data only** (word list + audio files), with no code changes.

## 2. Tech and hosting

- Static web app (HTML/CSS/JavaScript). No backend needed for v1. Keep it simple; a framework is optional.
- Hosted from a GitHub repo, deployed on **Cloudflare Pages** with a custom domain (to be decided).
- Main devices: **iPad and phone** (touch first), also MacBook. Layout must work in portrait and landscape.
- Progress is saved **on the device** (localStorage) for v1. Keep all saving in one module so it can later move to Cloudflare D1/KV for cross-device sync.

## 3. Content and data

### Audio
- 30 MP3 files already exist in `audio_bank/a1/`, named `a1_01_baba.mp3` … `a1_30_dou.mp3`.
- `audio_bank/a1/a1_manifest.json` lists each word with `id`, `level`, `word`, `pinyin` and `audio`.
- Note: the manifest's `audio` paths start with `audio/a1/…`. Either move the files to match or adjust the paths. Pick one and keep it consistent.

### Word data
Create `data/a1.json` (one file per level) with this shape:

```json
{
  "id": "a1_01",
  "level": "A1",
  "word": "爸爸",
  "pinyin": "bàba",
  "meaning": "dad",
  "audio": "audio/a1/a1_01_baba.mp3",
  "image": null
}
```

`image` stays empty in v1 (no pictures yet). The app must load the level list from a small index (e.g. `data/levels.json`) so new levels can be dropped in.

### A1 words

| # | Word | Pinyin | Meaning |
|---|------|--------|---------|
| 1 | 爸爸 | bàba | dad |
| 2 | 妈妈 | māma | mum |
| 3 | 哥哥 | gēge | older brother |
| 4 | 姐姐 | jiějie | older sister |
| 5 | 妹妹 | mèimei | younger sister |
| 6 | 宝贝 | bǎobèi | baby, darling, treasure |
| 7 | 星星 | xīngxing | star |
| 8 | 花 | huā | flower |
| 9 | 去 | qù | to go |
| 10 | 讨厌 | tǎoyàn | to dislike; annoying |
| 11 | 说 | shuō | to say, to speak |
| 12 | 人 | rén | person |
| 13 | 家 | jiā | home, family |
| 14 | 我 | wǒ | I, me |
| 15 | 大 | dà | big |
| 16 | 小 | xiǎo | small |
| 17 | 也 | yě | also, too |
| 18 | 爱 | ài | to love |
| 19 | 我们 | wǒmen | we, us |
| 20 | 的 | de | possessive particle ('s) |
| 21 | 里 | lǐ | inside |
| 22 | 到 | dào | to arrive; to (a place) |
| 23 | 一 | yī | one |
| 24 | 嘻 | xī | hee (giggling sound) |
| 25 | 哈 | hā | ha (laughing sound) |
| 26 | 有 | yǒu | to have; there is |
| 27 | 和 | hé | and; with |
| 28 | 这 | zhè | this |
| 29 | 是 | shì | to be (is, am, are) |
| 30 | 都 | dōu | all, both |

## 4. Profiles

- Create a profile with a **name** and a **picked avatar** (simple emoji or icon).
- Pick a **starting level**. Only A1 is available in v1; show A2–A9 as locked.
- Several profiles on one device (one per child), each with its own progress.
- Simple profile picker on launch. No passwords.

## 5. The path

Each level is a path of **8 stations**, shown as a visual trail (Duolingo-style). Stations unlock one at a time. Completed stations can be replayed.

| Station | Words |
|---|---|
| 1 | 5 new words |
| 2–6 | 5 new words + up to 5 carried "difficult" words |
| 7 | 10 review words, weakest first |
| 8 | 10 review words, weakest first: **level check** |

- New words are introduced in list order (words 1–5 at station 1, 6–10 at station 2, etc.).
- By the end of station 6, all 30 words have been introduced.
- **Weakest first** (stations 7–8): rank words by most recent mistakes and lowest accuracy; take the top 10. If fewer than 10 words are weak, fill the rest at random from the level.

### Level check (station 8)
- Count **first-try** answers in station 8. **80% or higher** = level passed, A2 unlocks (once A2 content exists).
- Below 80%: friendly message, and station 8 can be replayed with a fresh set of weakest words.

## 6. Tracking each word

Store per profile, per word: times seen, times correct, times wrong, current correct streak, and a `difficult` flag.

- A word becomes **difficult** when the child answers it wrong.
- A word stops being difficult after **2 correct answers in a row**.
- Carry forward **at most 5** difficult words into any station, most recently missed first.
- Keep this data clean: future scoring, stars and rankings will be built on it.

## 7. Inside a station

- Every station (1–6) **starts with This or That** for its new words.
- Then **2 more activities** picked at random from: Identification, Pinyin Match, Memory Match.
- Stations 7 and 8: 3 activities picked at random from all four.
- **Memory Match is not used in station 1** (it needs 6 pairs).
- **Mistakes inside a station:** a missed word comes back later in the same station, so the child ends on a correct answer.
- Aim for about **5 minutes** per station.
- End of station: simple "well done" screen and back to the path.

## 8. The 4 activities

### 1. This or That (listening)
- A word's audio plays automatically. Two character cards are shown: the right word and one other word from the level.
- Child taps a card. Correct: happy feedback, play the audio again. Wrong: gentle feedback, show the right card, play its audio.
- Big replay (speaker) button to hear the word again.
- One question per word in the station's word set.

### 2. Identification (speaking, with an adult)
- A large character card is shown. The child says the word out loud.
- Tap the card to **flip**: shows pinyin and plays the audio.
- An adult taps **"Got it"** or **"Try again"**. That answer is recorded like any other.
- Show a small note on first use: *"Play this one with a grown-up."*
- (Future: speech recognition. Not in v1.)

### 3. Pinyin Match (reading pinyin)
- 5 characters in one column and their 5 pinyin in another, both shuffled.
- Child taps a character (plays its audio), then taps a pinyin.
- Correct pair: both lock in as matched. Wrong: brief shake, both unselect. The first wrong pairing for a character counts as a mistake for that word.
- If the station has fewer than 5 words, fill from other A1 words already introduced.

### 4. Memory Match (memory)
- Grid of **6 pairs** (12 cards), face down. Each pair = a **character card** + a **speaker card**.
- Flipping a speaker card plays that word's audio. Flipping a character card shows the character (and plays its audio).
- Flip two at a time. A match stays face up; a miss flips back after a short pause.
- Record a mistake for a word when the child flips its character card and a non-matching speaker card (or vice versa) after both have already been seen once.
- Fill to 6 pairs with other introduced A1 words if needed.

## 9. Child-friendly design rules

- **No English reading required** to play. Use icons, audio and colour; keep any text short and large.
- Large tap targets (at least ~64px), generous spacing.
- Warm, encouraging feedback. **No harsh buzzers or red X screens**; wrong answers should feel safe.
- Characters must be big and clear. Use a font with good simplified Chinese support (e.g. Noto Sans SC).
- **iOS audio gotcha:** Safari only allows audio after a user tap. Start/unlock audio on the first tap (e.g. the profile or "Start" button), and preload the station's audio files.

## 10. Out of scope for v1

- Scoring, stars, streaks, rankings, rewards (data is tracked so these can come later)
- Speech recognition
- Pictures
- Word Hunt and sentence activities
- Cross-device sync
- Levels A2–A9 content (structure must support them)

## 11. Done when

- [ ] A child can create a profile, choose A1 and see the 8-station path.
- [ ] All 4 activities work on iPad Safari and phone, with audio playing reliably.
- [ ] Stations 1–6 introduce all 30 words, 5 per station, with difficult words carried forward (max 5).
- [ ] Missed words come back within the same station.
- [ ] Stations 7–8 pick the weakest words first; station 8 passes at 80% first-try.
- [ ] Progress survives closing and reopening the app, per profile.
- [ ] Adding a new level only needs a new `data/aX.json`, audio files and an entry in `data/levels.json`.
- [ ] Deployed to Cloudflare Pages from the GitHub repo.
