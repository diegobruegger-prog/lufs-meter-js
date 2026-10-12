# lufs-meter-js

Integrated loudness in **LUFS** (ITU-R BS.1770-4, EBU R128) in about 100 lines of dependency-free JavaScript. Runs in the browser (Web Audio) and in Node.

- Integrated loudness with absolute (-70 LUFS) and relative (-10 LU) gating
- Max momentary (400 ms) and max short-term (3 s) loudness
- Sample peak and an estimated true peak (4× oversampling)
- K-weighting coefficients computed for **any sample rate** (44.1, 48, 96 kHz …), not just 48 kHz
- Verified against `ffmpeg -af ebur128`: within 0.03 LU on pink noise, tones and bursts at 44.1, 48 and 96 kHz (`npm test`)

**Try it without code:** [Free online LUFS meter](https://shortformkit.com/lufs-meter/). Drop a WAV, MP3 or video file, nothing is uploaded.

## Usage

```js
import { measureFile, measureLoudness } from "./lufs.js";

// Browser: a File from <input type="file"> or drag and drop
const r = await measureFile(file);
console.log(r.integrated.toFixed(1), "LUFS", r.truePeak.toFixed(1), "dBTP");

// Anywhere: your own Float32Array channels
const result = measureLoudness([left, right], 48000);
```

`measureLoudness` returns `{ integrated, momentaryMax, shortTermMax, samplePeak, truePeak }`.

## Common targets

| Where | Integrated | True peak |
|---|---|---|
| Spotify, YouTube | -14 LUFS | -1 dBTP |
| Apple Music, Apple Podcasts | -16 LUFS | -1 dBTP |
| EBU R128 broadcast | -23 LUFS | -1 dBTP |
| Instagram Reels (measured, not official) | about -14 LUFS | |

The Instagram value comes from our own measurement of 135 public Reels, TikToks and Shorts: [Short-form video quality study 2026](https://shortformkit.com/short-form-video-quality-study-2026/) (data as CSV, CC BY 4.0).

## Test

```
npm test
```

Needs `ffmpeg` on your PATH. The test generates signals with ffmpeg, measures them with both ffmpeg and lufs.js and fails if they differ by more than 0.1 LU.

## Notes

- Only the first two channels are used (stereo). 5.1 channel weighting is not implemented.
- True peak is an estimate (Catmull-Rom 4× interpolation), close to but not identical with the BS.1770 polyphase filter.

## License

MIT. Made by [Diego Brügger](https://shortformkit.com/about/), video editor in Zürich, for [Shortform Kit](https://shortformkit.com): free tools for creators.
