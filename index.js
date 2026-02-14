export class FastGIFEncoder {
    constructor({ width, height, loop = 0, quality = 20, format = "rgb565" } = {}) {
        if (!Number.isFinite(width) || !Number.isFinite(height)) throw new Error("width/height is required");
        this.width = width | 0;
        this.height = height | 0;
        this.loop = loop | 0;
        this.quality = quality | 0;
        this.format = format; // "rgb565" | "rgb444" | "rgba4444"
        this._enc = GIFEncoder({ initialCapacity: 4096, auto: true });
        this._first = true;
    }

    addFrame(rgba, opts = {}) {
        const data = rgba?.data ? rgba.data : rgba;
        if (!(data instanceof Uint8Array) && !(data instanceof Uint8ClampedArray)) {
            throw new Error("addFrame expects ImageData.data (Uint8ClampedArray) or Uint8Array RGBA");
        }

        const delay = (opts.delay ?? 0) | 0; // ms
        const dispose = opts.dispose ?? -1;

        const colors = Math.max(2, Math.min(256, 256 - 8 * this.quality));
        const palette = quantize(data, colors, { format: this.format });
        const indexed = applyPalette(data, palette, this.format);

        this._enc.writeFrame(indexed, this.width, this.height, {
            palette,
            delay,
            dispose,
            repeat: this._first ? this.loop : 0,
        });

        this._first = false;
    }

    encode() {
        this._enc.finish();
        return this._enc.bytes();
    }
}

const ByteStream = (cap = 256) => {
    let off = 0;
    let buf = new Uint8Array(cap);

    const ensure = (size) => {
        const cur = buf.length;
        if (cur >= size) return;
        let next = Math.max(size, (cur * (cur < 1048576 ? 2 : 1.125)) >>> 0);
        if (cur !== 0) next = Math.max(next, 256);
        const prev = buf;
        buf = new Uint8Array(next);
        if (off > 0) buf.set(prev.subarray(0, off), 0);
    }

    return {
        get buffer() {
            return buf.buffer;
        },
        reset() {
            off = 0;
        },
        bytesView: () => buf.subarray(0, off),
        bytes: () => buf.slice(0, off),
        writeByte(b) {
            ensure(off + 1);
            buf[off++] = b & 255;
        },
        writeBytes(arr, start = 0, len = arr.length) {
            ensure(off + len);
            for (let i = 0; i < len; i++) buf[off++] = arr[i + start] & 255;
        },
        writeBytesView(view, start = 0, len = view.byteLength) {
            ensure(off + len);
            buf.set(view.subarray(start, start + len), off);
            off += len;
        },
    };
}

const BIT_MASK = [0, 1, 3, 7, 15, 31, 63, 127, 255, 511, 1023, 2047, 4095, 8191, 16383, 32767, 65535];

const lzwEncodeExact = (w, h, pixels, minCodeSize, stream = ByteStream(512), block = new Uint8Array(256), dictKey = new Int32Array(5003), dictVal = new Int32Array(5003)) => {
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
    }

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

const packRgb565 = (r, g, b) => ((r << 8) & 63488) | ((g << 2) & 992) | (b >> 3);
const packRgba4444 = (r, g, b, a) => (r >> 4) | (240 & g) | ((240 & b) << 4) | ((240 & a) << 8);
const packRgb444 = (r, g, b) => ((r >> 4) << 8) | (240 & g) | (b >> 4);
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const node = () => ({ ac: 0, rc: 0, gc: 0, bc: 0, cnt: 0, nn: 0, fw: 0, bk: 0, tm: 0, mtm: 0, err: 0 });

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
}

const quantize = (rgba, maxColors, opts = {}) => {
    let {
        format = "rgb565",
        clearAlpha = true,
        clearAlphaColor = 0,
        clearAlphaThreshold = 0,
        oneBitAlpha = false,
    } = opts;

    if (!rgba || !rgba.buffer || (!(rgba instanceof Uint8Array) && !(rgba instanceof Uint8ClampedArray))) {
        throw Error("quantize() expected RGBA Uint8Array data");
    }

    const p = new Uint32Array(rgba.buffer);
    let useSqrt = opts.useSqrt !== false;
    const useAlpha = (format === "rgba4444");

    const hist = (() => {
        const r = Array(format === "rgb444" ? 4096 : 65536);
        const n = p.length;

        if (format === "rgba4444") {
            for (let t = 0; t < n; ++t) {
                const v = p[t];
                const a = (v >> 24) & 255;
                const b = (v >> 16) & 255;
                const g = (v >> 8) & 255;
                const rr = v & 255;
                const k = packRgba4444(rr, g, b, a);
                const nd = (k in r) ? r[k] : (r[k] = node());
                nd.rc += rr; nd.gc += g; nd.bc += b; nd.ac += a; nd.cnt++;
            }
        } else if (format === "rgb444") {
            for (let t = 0; t < n; ++t) {
                const v = p[t];
                const b = (v >> 16) & 255;
                const g = (v >> 8) & 255;
                const rr = v & 255;
                const k = packRgb444(rr, g, b);
                const nd = (k in r) ? r[k] : (r[k] = node());
                nd.rc += rr; nd.gc += g; nd.bc += b; nd.cnt++;
            }
        } else {
            for (let t = 0; t < n; ++t) {
                const v = p[t];
                const b = (v >> 16) & 255;
                const g = (v >> 8) & 255;
                const rr = v & 255;
                const k = packRgb565(rr, g, b);
                const nd = (k in r) ? r[k] : (r[k] = node());
                nd.rc += rr; nd.gc += g; nd.bc += b; nd.cnt++;
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
            nd.rc *= inv; nd.gc *= inv; nd.bc *= inv;
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
            if (oneBitAlpha) a = a <= (typeof oneBitAlpha === "number" ? oneBitAlpha : 127) ? 0 : 255;
            if (clearAlpha && a <= clearAlphaThreshold) { r = g = b = clearAlphaColor; a = 0; }
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
}

const applyPalette = (rgba, palette, format = "rgb565") => {
    if (!rgba || !rgba.buffer || (!(rgba instanceof Uint8Array) && !(rgba instanceof Uint8ClampedArray))) {
        throw Error("quantize() expected RGBA Uint8Array data");
    }
    if (palette.length > 256) throw Error("applyPalette() only works with 256 colors or less");

    const px32 = new Uint32Array(rgba.buffer);
    const n = px32.length;
    const out = new Uint8Array(n);
    const cache = Array(format === "rgb444" ? 4096 : 65536);

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
    }

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
    }

    if (format === "rgba4444") {
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
        const keyFn = (format === "rgb444") ? packRgb444 : packRgb565;
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
}


const log2ceil = (n) => Math.max(Math.ceil(Math.log2(n)), 1)
const writePalette = (stream, palette) => {
    const size = 1 << log2ceil(palette.length);
    for (let i = 0; i < size; i++) {
        let c = [0, 0, 0];
        if (i < palette.length) c = palette[i];
        stream.writeByte(c[0]);
        stream.writeByte(c[1]);
        stream.writeByte(c[2]);
    }
}
const writeLSD = (stream, w, h, palette, colorDepth = 8) => {
    const pow = log2ceil(palette.length) - 1;
    writeShort(stream, w);
    writeShort(stream, h);
    stream.writeBytes([128 | (((colorDepth - 1) << 4) | pow), 0, 0]);
}
const writeShort = (stream, v) => {
    stream.writeByte(v & 255);
    stream.writeByte((v >> 8) & 255);
}
const writeASCII = (stream, str) => {
    for (let i = 0; i < str.length; i++) stream.writeByte(str.charCodeAt(i));
}

const GIFEncoder = ({ initialCapacity = 4096, auto = true } = {}) => {
    const stream = ByteStream(initialCapacity);
    const block = new Uint8Array(256);
    const dictKey = new Int32Array(5003);
    const dictVal = new Int32Array(5003);
    let started = false;
    const writeHeader = () => {
        writeASCII(stream, "GIF89a");
    }

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
            if (auto ? (!started && (first = true, writeHeader(), started = true)) : (first = !!opts.first)) { }

            w = Math.max(0, Math.floor(w));
            h = Math.max(0, Math.floor(h));

            if (first) {
                if (!palette) throw Error("First frame must include a { palette } option");
                writeLSD(stream, w, h, palette, colorDepth);
                writePalette(stream, palette);

                if (repeat >= 0) {
                    stream.writeByte(33);
                    stream.writeByte(255);
                    stream.writeByte(11);
                    writeASCII(stream, "NETSCAPE2.0");
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
            if (transparent) { transpFlag = 1; disp = 2; }
            else { transpFlag = 0; disp = 0; }

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
}
