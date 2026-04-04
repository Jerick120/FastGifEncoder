import fs from 'fs';
import {performance} from 'perf_hooks';

import {FastGifEncoder} from '../src/index.js';
import GIFEncoder from 'gif-encoder';
import GifEncoder2 from 'gif-encoder-2';
import {encode as moderngif} from 'modern-gif';
import {GifEncoder as gifenc} from '@skyra/gifenc';

const logTime = (start, end) => console.log(`✅ Encoded in: ${(end - start).toFixed(2)}ms\n`);

const outDir = './out';
if (fs.existsSync(outDir)) fs.rmSync(outDir, {recursive: true});
fs.mkdirSync(outDir);

export const compare = {
		fastgifencoder: async (frames, ctx, width, height, delay) => {
			await new Promise(res => {
				const encoder = new FastGifEncoder({width, height});
				for (const fr of frames) {
					ctx.clearRect(0, 0, width, height);
					ctx.drawImage(fr, 0, 0, width, height);
					const img = ctx.getImageData(0, 0, width, height);
					encoder.addFrame(img.data, {delay});
				}
				const start = performance.now();
				const bytes = encoder.encode();
				const end = performance.now();
				logTime(start, end);
				fs.writeFileSync(`${outDir}/fastgifencoder-cat.gif`, bytes);
				res();
			});
		},
		'gif-encoder': async (frames, ctx, width, height, delay) => {
			await new Promise(res => {
				const encoder = new GIFEncoder(width, height);
				encoder.setQuality(20);
				encoder.setDelay(delay);

				const file = fs.createWriteStream(`${outDir}/gifencoder-cat.gif`);
				encoder.pipe(file);

				let start;
				encoder.on('data', () => {
					start ||= performance.now();
				});
				encoder.on('end', () => {
					const end = performance.now();
					logTime(start, end);
					res();
				});
				encoder.on('readable', () => {
					encoder.read();
				});

				encoder.writeHeader();
				for (const fr of frames) {
					ctx.clearRect(0, 0, width, height);
					ctx.drawImage(fr, 0, 0, width, height);
					const img = ctx.getImageData(0, 0, width, height);
					encoder.addFrame(img.data);
				}
				encoder.finish();
			});
		},
		'gif-encoder-2': async (frames, ctx, width, height, delay) => {
			await new Promise(res => {
				const encoder = new GifEncoder2(width, height);
				encoder.setQuality(20);
				encoder.setDelay(delay);

				const start = performance.now();
				encoder.start();

				for (const fr of frames) {
					ctx.clearRect(0, 0, width, height);
					ctx.drawImage(fr, 0, 0, width, height);
					const img = ctx.getImageData(0, 0, width, height);
					encoder.addFrame(img.data);
				}

				encoder.finish();
				const buffer = encoder.out.getData();
				const end = performance.now();
				logTime(start, end);
				fs.writeFileSync(`${outDir}/gifencoder2-cat.gif`, buffer);
				res();
			});
		},
		'modern-gif': async (frames, ctx, width, height, delay) => {
			await new Promise(async (res) => {
				const frameData = [];
				for (const fr of frames) {
					ctx.clearRect(0, 0, width, height);
					ctx.drawImage(fr, 0, 0, width, height);
					const img = ctx.getImageData(0, 0, width, height);
					frameData.push({data: img.data.buffer, delay});
				}
				const start = performance.now();
				const out = await moderngif({width, height, frames: frameData});
				const end = performance.now();
				logTime(start, end);
				fs.writeFileSync(`${outDir}/moderngif-cat.gif`, Buffer.from(out));
				res();
			});
		},
		'@skyra/gifenc': async (frames, ctx, width, height, delay) => {
			await new Promise(res => {
				const encoder = new gifenc(width, height);
				encoder.setQuality(20);
				encoder.setDelay(delay);

				const stream = encoder.createReadStream();
				stream.pipe(fs.createWriteStream(`${outDir}/gifenc-cat.gif`));

				stream.on('end', () => {
					const end = performance.now();
					logTime(start, end);
					res();
				});

				const start = performance.now();
				encoder.start();
				for (const fr of frames) {
					ctx.clearRect(0, 0, width, height);
					ctx.drawImage(fr, 0, 0, width, height);
					const img = ctx.getImageData(0, 0, width, height);
					encoder.addFrame(img.data);
				}
				encoder.finish();
			});
		}
	}
;