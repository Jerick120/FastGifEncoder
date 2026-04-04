export const ByteStream = (cap = 256) => {
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
	};

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
};