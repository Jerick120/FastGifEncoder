import {packRgb565, packRgb444, packRgba4444} from './packRGB.js';

export const applyPalette = (rgba, palette, format = 'rgb565') => {
	if (!rgba || !rgba.buffer || (!(rgba instanceof Uint8Array) && !(rgba instanceof Uint8ClampedArray))) {
		throw Error('quantize() expected RGBA Uint8Array data');
	}
	if (palette.length > 256) throw Error('applyPalette() only works with <= 256 colors');

	const px32 = new Uint32Array(rgba.buffer);
	const n = px32.length;
	const out = new Uint8Array(n);
	const cache = Array(format === 'rgb444' ? 4096 : 65536);

	const sq = (x) => x * x;
	const nearestRGB = (r, g, b, pal) => {
		let bi = 0;
		let bd = 1e100;
		for (let i = 0; i < pal.length; i++) {
			const c = pal[i];
			let d = sq(c[0] - r);
			if (d > bd) continue;
			d += sq(c[1] - g);
			if (d > bd) continue;
			d += sq(c[2] - b);
			if (d > bd) continue;
			bd = d;
			bi = i;
		}
		return bi;
	};

	const nearestRGBA = (r, g, b, a, pal) => {
		let bi = 0;
		let bd = 1e100;
		for (let i = 0; i < pal.length; i++) {
			const c = pal[i];
			let d = sq(c[3] - a);
			if (d > bd) continue;
			d += sq(c[0] - r);
			if (d > bd) continue;
			d += sq(c[1] - g);
			if (d > bd) continue;
			d += sq(c[2] - b);
			if (d > bd) continue;
			bd = d;
			bi = i;
		}
		return bi;
	};

	if (format === 'rgba4444') {
		for (let i = 0; i < n; i++) {
			const p = px32[i];
			const a = (p >> 24) & 255;
			const b = (p >> 16) & 255;
			const g = (p >> 8) & 255;
			const r = p & 255;

			const key = packRgba4444(r, g, b, a);
			const idx = (key in cache) ? cache[key] : (cache[key] = nearestRGBA(r, g, b, a, palette));
			out[i] = idx;
		}
	} else {
		const keyFn = (format === 'rgb444') ? packRgb444 : packRgb565;
		for (let i = 0; i < n; i++) {
			const p = px32[i];
			const b = (p >> 16) & 255;
			const g = (p >> 8) & 255;
			const r = p & 255;

			const key = keyFn(r, g, b);
			const idx = (key in cache) ? cache[key] : (cache[key] = nearestRGB(r, g, b, palette));
			out[i] = idx;
		}
	}

	return out;
};