/*! lufs.js: integrated loudness (ITU-R BS.1770-4 / EBU R128) in plain JavaScript.
 * MIT License. From Shortform Kit, https://shortformkit.com/lufs-meter/ */

/** K-weighting biquad coefficients for any sample rate (BS.1770-4, as derived in pyloudnorm). */
export function kWeighting(fs) {
  // stage 1: high shelf (head effect)
  let G = 3.999843853973347, Q = 0.7071752369554196, fc = 1681.974450955533;
  let K = Math.tan(Math.PI * fc / fs);
  const Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const shelf = [[(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0], [1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0]];
  // stage 2: high pass (RLB)
  Q = 0.5003270373238773; fc = 38.13547087602444; K = Math.tan(Math.PI * fc / fs);
  a0 = 1 + K / Q + K * K;
  const hp = [[1, -2, 1], [1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0]];
  return [shelf, hp];
}

function biquad(x, b, a) {
  const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; }
  return y;
}

/**
 * Measure loudness.
 * @param {Float32Array[]} channels  one Float32Array per channel (only the first two are used: L, R)
 * @param {number} sampleRate
 * @returns {{integrated:number, momentaryMax:number, shortTermMax:number, samplePeak:number, truePeak:number}}
 *   LUFS values and peaks in dBFS / dBTP (true peak is a 4x oversampled estimate).
 */
export function measureLoudness(channels, sampleRate) {
  const ch = channels.slice(0, 2), len = ch[0].length;
  const [shelf, hp] = kWeighting(sampleRate);
  const kw = ch.map((d) => biquad(biquad(d, shelf[0], shelf[1]), hp[0], hp[1]));
  const block = Math.round(0.4 * sampleRate), step = Math.round(0.1 * sampleRate);
  const L = (z) => -0.691 + 10 * Math.log10(z || 1e-12);
  const zs = []; let momentaryMax = -Infinity;
  for (let s = 0; s + block <= len; s += step) {
    let z = 0;
    for (const k of kw) { let acc = 0; for (let i = s; i < s + block; i++) acc += k[i] * k[i]; z += acc / block; }
    zs.push(z); momentaryMax = Math.max(momentaryMax, L(z));
  }
  const mean = (a) => a.reduce((p, q) => p + q, 0) / (a.length || 1);
  const abs = zs.filter((z) => L(z) > -70);
  const rel = L(mean(abs)) - 10;
  const gated = abs.filter((z) => L(z) > rel);
  const integrated = gated.length ? L(mean(gated)) : -Infinity;
  let shortTermMax = -Infinity;
  for (let i = 0; i + 30 <= zs.length; i++) shortTermMax = Math.max(shortTermMax, L(mean(zs.slice(i, i + 30))));
  let sp = 0, tp = 0;
  for (const d of ch) for (let i = 1; i < d.length - 2; i++) {
    const p0 = d[i - 1], p1 = d[i], p2 = d[i + 1], p3 = d[i + 2], a1 = Math.abs(p1);
    if (a1 > sp) sp = a1; if (a1 > tp) tp = a1;
    for (let t = 0.25; t < 1; t += 0.25) {
      const v = 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
      if (Math.abs(v) > tp) tp = Math.abs(v);
    }
  }
  return { integrated, momentaryMax, shortTermMax, samplePeak: 20 * Math.log10(sp || 1e-12), truePeak: 20 * Math.log10(tp || 1e-12) };
}

/** Convenience for browsers: measure a File/Blob (audio or video) with the Web Audio API. */
export async function measureFile(file) {
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  const ctx = new AC();
  try {
    const buf = await ctx.decodeAudioData(await file.arrayBuffer());
    const chans = []; for (let c = 0; c < Math.min(2, buf.numberOfChannels); c++) chans.push(buf.getChannelData(c));
    return { ...measureLoudness(chans, buf.sampleRate), duration: buf.duration, sampleRate: buf.sampleRate, channels: buf.numberOfChannels };
  } finally { ctx.close && ctx.close(); }
}
