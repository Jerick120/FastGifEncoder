import {ByteStream} from './ByteStream.js';

const BIT_MASK = [0, 1, 3, 7, 15, 31, 63, 127, 255, 511, 1023, 2047, 4095, 8191, 16383, 32767, 65535];

export const lzwEncodeExact = (
	w,
	h,
	pixels,
	minCodeSize,
	stream = ByteStream(512),
	block = new Uint8Array(256),
	dictKey = new Int32Array(5003),
	dictVal = new Int32Array(5003)) => {

	const hsize = dictKey.length;
	const s = Math.max(2, minCodeSize);

	block.fill(0);
	dictVal.fill(0);
	dictKey.fill(-1);

	let curAccum = 0;
	let curBits = 0;
	let g = s + 1;
	let clearFlag = false;
	let codeSize = g;
	let maxCode = (1 << codeSize) - 1;

	let clearCode = 1 << g - 1;
	let eofCode = clearCode + 1;
	let freeEnt = clearCode + 2;

	let outCount = 0;
	let ent = pixels[0];
	let shift = 0;

	const output = (code) => {
		curAccum &= BIT_MASK[curBits];
		curBits > 0 ? (curAccum |= code << curBits) : (curAccum = code);
		curBits += codeSize;

		while (curBits >= 8) {
			block[outCount++] = curAccum & 255;
			if (outCount >= 254) {
				stream.writeByte(outCount);
				stream.writeBytesView(block, 0, outCount);
				outCount = 0;
			}
			curAccum >>= 8;
			curBits -= 8;
		}

		if ((freeEnt > maxCode || clearFlag)) {
			if (clearFlag) {
				maxCode = (1 << (codeSize = g)) - 1;
				clearFlag = false;
			} else {
				maxCode = (12 == ++codeSize) ? (1 << codeSize) : ((1 << codeSize) - 1);
			}
		}

		if (code === eofCode) {
			while (curBits > 0) {
				block[outCount++] = curAccum & 255;
				if (outCount >= 254) {
					stream.writeByte(outCount);
					stream.writeBytesView(block, 0, outCount);
					outCount = 0;
				}
				curAccum >>= 8;
				curBits -= 8;
			}
			if (outCount > 0) {
				stream.writeByte(outCount);
				stream.writeBytesView(block, 0, outCount);
				outCount = 0;
			}
		}
	};

	for (let e = hsize; e < 65536; e *= 2) ++shift;
	shift = 8 - shift;

	stream.writeByte(s);
	output(clearCode);

	const k = pixels.length;
	for (let e = 1; e < k; e++) {
		const t = pixels[e];
		const fcode = (t << 12) + ent;
		let idx = (t << shift) ^ ent;

		if (dictKey[idx] === fcode) {
			ent = dictVal[idx];
			continue;
		}

		const disp = idx === 0 ? 1 : hsize - idx;
		while (dictKey[idx] >= 0) {
			idx -= disp;
			if (idx < 0) idx += hsize;
			if (dictKey[idx] === fcode) {
				ent = dictVal[idx];
				break;
			}
		}

		if (dictKey[idx] === fcode) continue;

		output(ent);
		ent = t;

		if (freeEnt < 4096) {
			dictVal[idx] = freeEnt++;
			dictKey[idx] = fcode;
		} else {
			dictKey.fill(-1);
			freeEnt = clearCode + 2;
			clearFlag = true;
			output(clearCode);
		}
	}

	output(ent);
	output(eofCode);
	stream.writeByte(0);
	return stream.bytesView();
};