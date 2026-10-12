// compares lufs.js with ffmpeg's ebur128 on generated test files: node test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { measureLoudness, kWeighting } from "./lufs.js";
const dir = mkdtempSync(join(tmpdir(), "lufs-"));
const k48 = kWeighting(48000);
console.log("48 kHz coefficients match the BS.1770 table:", Math.abs(k48[0][0][0] - 1.53512485958697) < 1e-9 && Math.abs(k48[1][1][1] + 1.99004745483398) < 1e-9);
const cases = [
  ["pink noise 44.1k", 44100, "anoisesrc=color=pink:amplitude=0.3:d=20"],
  ["pink noise 48k", 48000, "anoisesrc=color=pink:amplitude=0.3:d=20"],
  ["sine 1k + 100 Hz, 44.1k", 44100, "sine=f=1000:d=20,volume=0.5[a];sine=f=100:d=20[b];[a][b]amix"],
  ["music-like: noise bursts, 96k", 96000, "anoisesrc=color=brown:amplitude=0.6:d=20,volume='if(lt(mod(t,4),2),1,0.1)':eval=frame"],
];
let worst = 0;
for (const [name, sr, filt] of cases) {
  const f = join(dir, `t${sr}.f32`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-filter_complex", `${filt},aformat=channel_layouts=stereo`, "-ar", String(sr), "-f", "f32le", f]);
  const ref = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-f", "f32le", "-ar", String(sr), "-ac", "2", "-i", f, "-af", "ebur128", "-f", "null", "-"]).stderr.toString();
  const raw = readFileSync(f); const all = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
  const L = new Float32Array(all.length / 2), R = new Float32Array(all.length / 2);
  for (let i = 0; i < L.length; i++) { L[i] = all[2 * i]; R[i] = all[2 * i + 1]; }
  const m = measureLoudness([L, R], sr);
  const want = parseFloat(ref.slice(ref.lastIndexOf("Summary:")).match(/I:\s+(-?[\d.]+)/)[1]);
  const diff = Math.abs(m.integrated - want); worst = Math.max(worst, diff);
  console.log(`${name.padEnd(30)} lufs.js ${m.integrated.toFixed(2)}  ffmpeg ${want.toFixed(1)}  diff ${diff.toFixed(2)} LU`);
}
console.log(worst <= 0.1 ? "PASS (all within 0.1 LU)" : "FAIL"); process.exit(worst <= 0.1 ? 0 : 1);
