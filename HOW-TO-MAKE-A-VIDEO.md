# HOW TO MAKE A VIDEO

The plain-English guide for your Creator Editing OS.

---

## 1. Create a new video

```
npm run new-video my-first-video --type talking
```

A folder opens with your footage and a brief file. Fill it out.

## 2. Fill the brief

Open `assets/projects/my-first-video/BRIEF.md`.
Paste your script. List must-have moments. Add references.

## 3. Tell me you're ready

Say: "ready to prep my-first-video"
I run `npm run prep`, read PREP.md, and describe every reference moment back to you.

## 4. I build

I write the plan. You approve. I build the composition.

## 5. I check stills

I render key frames and send them to you. You check at full speed.

## 6. I render

I make the final render. You get the mp4, voice.wav, sfx.wav, and SFX-CUES.txt.

## 7. You send notes

```
00:12 - text sits too low - move up 30px
00:45 - rolling number is too fast - slow to 1.2s
```

I fix only those notes and re-render.

---

## IF SOMETHING BREAKS

| Problem | Fix |
|---|---|
| `npm run studio` won't start | Close other Node processes. Run `npm run clean`. Try again. |
| Fonts look wrong | Put font files in `assets/fonts/` and reference them in `src/design/tokens.ts` |
| Transcode fails | Check file isn't DRM-protected. Convert to MP4 with HandBrake first. |
| Out of memory | Close Chrome and Premiere. Renders need 8GB+ free. |
| Render is slow | 2x renders take ~4x time. Reduce resolution or shorten the video. |

---

## WHERE FILES LIVE

| What | Where |
|---|---|
| Your footage | `assets/projects/[name]/footage/` |
| Finished videos | `out/[name]/` |
| Work files | `work/[name]/` |
| Brief | `assets/projects/[name]/BRIEF.md` |
| Script | `src/videos/[name]/script.txt` |
| Scripts | `scripts/` |
| Helpers | `src/lib/` |
| Parts | `src/components/` |
| Tokens | `src/design/` |
