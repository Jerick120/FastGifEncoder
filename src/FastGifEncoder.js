import {applyPalette} from './utils/palette.js';
import {GIFEncoder} from './utils/GIFEncoder.js';
import {quantize} from './utils/quantize.js';

export class FastGifEncoder {
	constructor({width, height, loop = 0, quality = 20, format = 'rgb565'} = {}) {
		if (!Number.isFinite(width) || !Number.isFinite(height)) throw new Error('width/height is required');
		this.width = width | 0;
		this.height = height | 0;
		this.loop = loop | 0;
		this.quality = quality | 0;
		this.format = format; // "rgb565" | "rgb444" | "rgba4444"
		this._enc = GIFEncoder({initialCapacity: 4096, auto: true});
		this._first = true;
	}

	addFrame(rgba, opts = {}) {
		const data = rgba?.data ? rgba.data : rgba;
		if (!(data instanceof Uint8Array) && !(data instanceof Uint8ClampedArray)) {
			throw new Error('addFrame expects ImageData.data (Uint8ClampedArray) or Uint8Array RGBA');
		}

		const delay = (opts.delay ?? 0) | 0; // ms
		const dispose = opts.dispose ?? -1;

		const alphaThreshold = opts.alphaThreshold ?? 128;
		const colors = Math.max(2, Math.min(256, 256 - 8 * this.quality));

		const palette = quantize(data, colors, {
			format: this.format,
			oneBitAlpha: alphaThreshold,
			clearAlpha: true,
			clearAlphaColor: 0,
			clearAlphaThreshold: alphaThreshold,
		});

		const indexed = applyPalette(data, palette, this.format);

		let transparentIndex = -1;
		if (this.format === 'rgba4444') {
			for (let i = 0; i < palette.length; i++) {
				const c = palette[i];
				if (c.length >= 4 && c[3] === 0) {
					transparentIndex = i;
					break;
				}
			}
		}

		this._enc.writeFrame(indexed, this.width, this.height, {
			palette,
			delay,
			dispose,
			repeat: this._first ? this.loop : 0,
			transparent: transparentIndex >= 0,
			transparentIndex: transparentIndex >= 0 ? transparentIndex : 0,
		});

		this._first = false;
	}

	encode() {
		this._enc.finish();
		return this._enc.bytes();
	}
}

