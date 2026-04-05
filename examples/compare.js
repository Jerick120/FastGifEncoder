import fs from 'fs';
import {performance} from 'perf_hooks';

import {FastGifEncoder} from '../src/index.js';
import GifEncoder2 from 'gif-encoder-2';
import {encode as moderngif} from 'modern-gif';
import {GifEncoder as skyragifenc} from '@skyra/gifenc';
import {GIFEncoder as gifenc, quantize, applyPalette} from 'gifenc';

const logTime = (start, end) => console.log(`✅ Encoded in: ${(end - start).toFixed(2)}ms\n`);

const outDir = './out';
if (fs.existsSync(outDir)) fs.rmSync(outDir, {recursive: true});
fs.mkdirSync(outDir);

export const compare = {
		fastgifencoder: async (imageData, width, height, delay) => {
			await new Promise(res => {
				const encoder = new FastGifEncoder({width, height});
				const start = performance.now();
				for (const data of imageData) {
					encoder.addFrame(data, {delay});
				}
				const bytes = encoder.encode();
				const end = performance.now();
				logTime(start, end);
				fs.writeFileSync(`${outDir}/fastgifencoder-cat.gif`, bytes);
				res();
			});
		},
		'gif-encoder-2': async (imageData, width, height, delay) => {
			await new Promise(res => {
				const encoder = new GifEncoder2(width, height);
				encoder.setQuality(20);
				encoder.setDelay(delay);

				const start = performance.now();
				encoder.start();
				for (const data of imageData) {
					encoder.addFrame(data);
				}
				encoder.finish();

				const buffer = encoder.out.getData();
				const end = performance.now();
				logTime(start, end);
				fs.writeFileSync(`${outDir}/gifencoder2-cat.gif`, buffer);
				res();
			});
		},
		'modern-gif': async (imageData, width, height, delay) => {
			await new Promise(async (res) => {
				const frameData = [];
				for (const data of imageData) {
					frameData.push({data: data.buffer, delay});
				}
				const start = performance.now();
				const out = await moderngif({width, height, frames: frameData});
				const end = performance.now();
				logTime(start, end);
				fs.writeFileSync(`${outDir}/moderngif-cat.gif`, Buffer.from(out));
				res();
			});
		},
		'@skyra/gifenc': async (imageData, width, height, delay) => {
			await new Promise(res => {
				const encoder = new skyragifenc(width, height);
				encoder.setQuality(20);
				encoder.setDelay(delay);

				const stream = encoder.createReadStream();
				stream.pipe(fs.createWriteStream(`${outDir}/skyragifenc-cat.gif`));

				stream.on('end', () => {
					const end = performance.now();
					logTime(start, end);
					res();
				});

				const start = performance.now();
				encoder.start();
				for (const data of imageData) {
					encoder.addFrame(data);
				}
				encoder.finish();
			});
		},
		'mattdesl/gifenc': async (imageData, width, height, delay) => {
			await new Promise(res => {
				const encoder = new gifenc();

				const start = performance.now();
				for (const data of imageData) {
					const palette = quantize(data, 256);
					const index = applyPalette(data, palette);
					encoder.writeFrame(index, width, height, {palette, delay});
				}
				encoder.finish();
				const out = encoder.bytes();
				const end = performance.now();
				logTime(start, end);
				fs.writeFileSync(`${outDir}/gifenc-cat.gif`, out);
				res();
			});
		},
	}
;