import {packRgb565, packRgba4444, packRgb444} from './packRGB.js';

const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const node = () => ({ac: 0, rc: 0, gc: 0, bc: 0, cnt: 0, nn: 0, fw: 0, bk: 0, tm: 0, mtm: 0, err: 0});
const updateNearest = (net, idx, useAlpha) => {
	let best = 0;
	let bestDist = 1e100;

	const cur = net[idx];
	const oc = cur.cnt;
	const ac = cur.ac, rc = cur.rc, gc = cur.gc, bc = cur.bc;

	for (let s = cur.fw; s !== 0; s = net[s].fw) {
		const n = net[s];
		const nc = n.cnt;
		const w = (oc * nc) / (oc + nc);
		if (w >= bestDist) continue;

		let d = 0;
		if (useAlpha) {
			const da = n.ac - ac;
			d += w * (da * da);
			if (d >= bestDist) continue;
		}

		const dr = n.rc - rc;
		d += w * (dr * dr);
		if (d >= bestDist) continue;

		const dg = n.gc - gc;
		d += w * (dg * dg);
		if (d >= bestDist) continue;

		const db = n.bc - bc;
		d += w * (db * db);
		if (d >= bestDist) continue;

		bestDist = d;
		best = s;
	}

	cur.err = bestDist;
	cur.nn = best;
};

export const quantize = (rgba, maxColors, opts = {}) => {
	let {
		format = 'rgb565',
		clearAlpha = true,
		clearAlphaColor = 0,
		clearAlphaThreshold = 0,
		oneBitAlpha = false,
	} = opts;

	if (!rgba || !rgba.buffer || (!(rgba instanceof Uint8Array) && !(rgba instanceof Uint8ClampedArray))) {
		throw Error('quantize() expected RGBA Uint8Array data');
	}

	const p = new Uint32Array(rgba.buffer);
	let useSqrt = opts.useSqrt !== false;
	const useAlpha = (format === 'rgba4444');

	const hist = (() => {
		const r = Array(format === 'rgb444' ? 4096 : 65536);
		const n = p.length;

		if (format === 'rgba4444') {
			for (let t = 0; t < n; ++t) {
				const v = p[t];
				const a = (v >> 24) & 255;
				const b = (v >> 16) & 255;
				const g = (v >> 8) & 255;
				const rr = v & 255;
				const k = packRgba4444(rr, g, b, a);
				const nd = (k in r) ? r[k] : (r[k] = node());
				nd.rc += rr;
				nd.gc += g;
				nd.bc += b;
				nd.ac += a;
				nd.cnt++;
			}
		} else if (format === 'rgb444') {
			for (let t = 0; t < n; ++t) {
				const v = p[t];
				const b = (v >> 16) & 255;
				const g = (v >> 8) & 255;
				const rr = v & 255;
				const k = packRgb444(rr, g, b);
				const nd = (k in r) ? r[k] : (r[k] = node());
				nd.rc += rr;
				nd.gc += g;
				nd.bc += b;
				nd.cnt++;
			}
		} else {
			for (let t = 0; t < n; ++t) {
				const v = p[t];
				const b = (v >> 16) & 255;
				const g = (v >> 8) & 255;
				const rr = v & 255;
				const k = packRgb565(rr, g, b);
				const nd = (k in r) ? r[k] : (r[k] = node());
				nd.rc += rr;
				nd.gc += g;
				nd.bc += b;
				nd.cnt++;
			}
		}
		return r;
	})();

	const v = hist.length;
	const B = v - 1;
	const heap = new Uint32Array(v + 1);

	let A = 0;
	for (let i = 0; i < v; i++) {
		const nd = hist[i];
		if (nd != null) {
			const inv = 1 / nd.cnt;
			if (useAlpha) nd.ac *= inv;
			nd.rc *= inv;
			nd.gc *= inv;
			nd.bc *= inv;
			hist[A++] = nd;
		}
	}

	if ((maxColors * maxColors) / A < 0.022) useSqrt = false;

	for (let i = 0; i < A - 1; i++) {
		hist[i].fw = i + 1;
		hist[i + 1].bk = i;
		if (useSqrt) hist[i].cnt = Math.sqrt(hist[i].cnt);
	}
	if (useSqrt) hist[A - 1].cnt = Math.sqrt(hist[A - 1].cnt);

	for (let x = 0; x < A; x++) {
		updateNearest(hist, x, false);
		const err = hist[x].err;

		let z = ++heap[0];
		while (z > 1) {
			const S = z >> 1;
			const C = heap[S];
			if (hist[C].err <= err) break;
			heap[z] = C;
			z = S;
		}
		heap[z] = x;
	}

	const U = A - maxColors;

	for (let x = 0; x < U;) {
		for (; ;) {
			let _ = heap[1];
			const I = hist[_];
			if (I.tm >= I.mtm && hist[I.nn].mtm <= I.tm) break;

			if (I.mtm === B) {
				_ = heap[1] = heap[heap[0]--];
			} else {
				updateNearest(hist, _, false);
				I.tm = x;
			}

			const err = hist[_].err;
			let z = 1;

			while (true) {
				let S = z + z;
				if (S > heap[0]) break;
				if (S < heap[0] && hist[heap[S]].err > hist[heap[S + 1]].err) S++;
				const C = heap[S];
				if (err <= hist[C].err) break;
				heap[z] = C;
				z = S;
			}
			heap[z] = _;
		}

		const _ = heap[1];
		const I = hist[_];
		const P = hist[I.nn];

		const j = I.cnt;
		const E = P.cnt;
		const k = 1 / (j + E);

		if (useAlpha) I.ac = k * (j * I.ac + E * P.ac);
		I.rc = k * (j * I.rc + E * P.rc);
		I.gc = k * (j * I.gc + E * P.gc);
		I.bc = k * (j * I.bc + E * P.bc);

		I.cnt += P.cnt;
		I.mtm = ++x;

		hist[P.bk].fw = P.fw;
		hist[P.fw].bk = P.bk;
		P.mtm = B;
	}

	const out = [];
	for (let x = 0; ;) {
		let r = clamp(Math.round(hist[x].rc), 0, 255);
		let g = clamp(Math.round(hist[x].gc), 0, 255);
		let b = clamp(Math.round(hist[x].bc), 0, 255);
		let a = 255;

		if (useAlpha) {
			a = clamp(Math.round(hist[x].ac), 0, 255);
			if (oneBitAlpha) a = a <= (typeof oneBitAlpha === 'number' ? oneBitAlpha : 127) ? 0 : 255;
			if (clearAlpha && a <= clearAlphaThreshold) {
				r = g = b = clearAlphaColor;
				a = 0;
			}
			out.push([r, g, b, a]);
		} else {
			out.push([r, g, b]);
		}

		x = hist[x].fw;
		if (x === 0) break;
	}

	const uniq = [];
	outer: for (const c of out) {
		for (const u of uniq) {
			const rgbEq = u[0] === c[0] && u[1] === c[1] && u[2] === c[2];
			const aEq = !(u.length >= 4) || !(c.length >= 4) || u[3] === c[3];
			if (rgbEq && aEq) continue outer;
		}
		uniq.push(c);
	}

	return uniq;
};