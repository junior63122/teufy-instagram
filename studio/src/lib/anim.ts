import {Easing, interpolate, spring} from 'remotion';

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export const E = {
  outExpo: Easing.bezier(0.16, 1, 0.3, 1),
  outQuint: Easing.bezier(0.22, 1, 0.36, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  inCubic: Easing.bezier(0.32, 0, 0.67, 0),
  outBack: Easing.bezier(0.34, 1.56, 0.64, 1),
  linear: (x: number) => x,
};

/** progression 0→1 entre t0 et t0+d (secondes), avec une courbe */
export const p = (t: number, t0: number, d: number, e: (x: number) => number = E.outExpo) => e(clamp((t - t0) / d));

export const SPR = {
  doux: {damping: 18, stiffness: 120, mass: 0.9},
  pop: {damping: 11, stiffness: 170, mass: 0.7},
  sec: {damping: 22, stiffness: 280, mass: 0.6},
  lourd: {damping: 14, stiffness: 90, mass: 1.4},
};

/** ressort physique 0→1 (peut dépasser 1) qui démarre à t0 secondes */
export const sp = (t: number, t0: number, fps: number, cfg = SPR.doux) => (t <= t0 ? 0 : spring({frame: (t - t0) * fps, fps, config: cfg}));

/** piste d'images clés : [[t, {x, y…}, courbe?], …] */
export type KF = [number, Record<string, number>, ((x: number) => number)?];
export function piste(t: number, kfs: KF[], defaut = E.inOut): Record<string, number> {
  if (t <= kfs[0][0]) return kfs[0][1];
  for (let i = 0; i < kfs.length - 1; i++) {
    const [t0, v0, e0] = kfs[i];
    const [t1, v1] = kfs[i + 1];
    if (t < t1) {
      const x = (e0 ?? defaut)(clamp((t - t0) / (t1 - t0)));
      const o: Record<string, number> = {};
      for (const k of Object.keys(v0)) o[k] = mix(v0[k], v1[k] ?? v0[k], x);
      return o;
    }
  }
  return kfs[kfs.length - 1][1];
}

/** pseudo-hasard déterministe */
export const rnd = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export const compteur = (t: number, t0: number, d: number, de: number, a: number) => Math.round(interpolate(t, [t0, t0 + d], [de, a], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: E.outExpo}));
