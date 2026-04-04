import {lzwEncodeExact} from './LZW.js';
import {ByteStream} from './ByteStream.js';

const log2ceil = (n) => Math.max(Math.ceil(Math.log2(n)), 1);
const writePalette = (stream, palette) => {
	const size = 1 << log2ceil(palette.length);
	for (let i = 0; i < size; i++) {
		let c = [0, 0, 0];
		if (i < palette.length) c = palette[i];
		stream.writeByte(c[0]);
		stream.writeByte(c[1]);
		stream.writeByte(c[2]);
	}
};
const writeLSD = (stream, w, h, palette, colorDepth = 8) => {
	const pow = log2ceil(palette.length) - 1;
	writeShort(stream, w);
	writeShort(stream, h);
	stream.writeBytes([128 | (((colorDepth - 1) << 4) | pow), 0, 0]);
};
const writeShort = (stream, v) => {
	stream.writeByte(v & 255);
	stream.writeByte((v >> 8) & 255);
};
const writeASCII = (stream, str) => {
	for (let i = 0; i < str.length; i++) stream.writeByte(str.charCodeAt(i));
};

export const GIFEncoder = ({initialCapacity = 4096, auto = true} = {}) => {
	const stream = ByteStream(initialCapacity);
	const block = new Uint8Array(256);
	const dictKey = new Int32Array(5003);
	const dictVal = new Int32Array(5003);
	let started = false;
	const writeHeader = () => {
		writeASCII(stream, 'GIF89a');
	};

	return {
		reset() {
			stream.reset();
			started = false;
		},
		finish() {
			stream.writeByte(59);
		},
		bytes: () => stream.bytes(),
		bytesView: () => stream.bytesView(),
		get buffer() {
			return stream.buffer;
		},
		get stream() {
			return stream;
		},
		writeHeader,
		writeFrame(indexedPixels, w, h, opts = {}) {
			let {
				transparent = false,
				transparentIndex = 0,
				delay = 0,
				palette = null,
				repeat = 0,
				colorDepth = 8,
				dispose = -1,
			} = opts;

			let first = false;
			if (auto ? (!started && (first = true, writeHeader(), started = true)) : (first = !!opts.first)) {
			}

			w = Math.max(0, Math.floor(w));
			h = Math.max(0, Math.floor(h));

			if (first) {
				if (!palette) throw Error('First frame must include a { palette } option');
				writeLSD(stream, w, h, palette, colorDepth);
				writePalette(stream, palette);

				if (repeat >= 0) {
					stream.writeByte(33);
					stream.writeByte(255);
					stream.writeByte(11);
					writeASCII(stream, 'NETSCAPE2.0');
					stream.writeByte(3);
					stream.writeByte(1);
					writeShort(stream, repeat);
					stream.writeByte(0);
				}
			}

			const delayCS = Math.round(delay / 10);
			stream.writeByte(33);
			stream.writeByte(249);
			stream.writeByte(4);

			if (transparentIndex < 0) {
				transparentIndex = 0;
				transparent = false;
			}

			let transpFlag, disp;
			if (transparent) {
				transpFlag = 1;
				disp = 2;
			} else {
				transpFlag = 0;
				disp = 0;
			}

			if (dispose >= 0) disp = dispose & 7;
			disp <<= 2;

			stream.writeByte(disp | transpFlag);
			writeShort(stream, delayCS);
			stream.writeByte(transparentIndex || 0);
			stream.writeByte(0);

			const hasLocalPalette = !!palette && !first;

			stream.writeByte(44);
			writeShort(stream, 0);
			writeShort(stream, 0);
			writeShort(stream, w);
			writeShort(stream, h);

			if (hasLocalPalette) {
				const pow = log2ceil(palette.length) - 1;
				stream.writeByte(128 | pow);
			} else {
				stream.writeByte(0);
			}

			if (hasLocalPalette) writePalette(stream, palette);

			lzwEncodeExact(w, h, indexedPixels, colorDepth, stream, block, dictKey, dictVal);
		},
	};
};