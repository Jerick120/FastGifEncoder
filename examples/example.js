import fs from 'fs';
import {compare} from './compare.js';
import {createCanvas, loadImage} from 'canvas';

const applySpeedOptimization = ({frames, delay}) => {
	if (frames.length <= 50) return {frames, delay};
	return {frames: frames.filter((_, i) => i % 2 == 0), delay: 2 * delay};
};

const encodeGif = async (arr, optimizeSpeed = true) => {
	const width = 800;
	const height = 450;
	const frameDelay = 20;

	const payload = {frames: arr, delay: frameDelay};
	const {frames, delay} = optimizeSpeed ? applySpeedOptimization(payload) : payload;

	const canvas = createCanvas(width, height);
	const ctx = canvas.getContext('2d');

	for (const encoder in compare) {
		console.log(`⏳ Running ${encoder}`);
		await compare[encoder](frames, ctx, width, height, delay);
	}
};

const readFrames = async () => {
	const dir = fs.readdirSync('./frames').filter(f => f.endsWith('.png'));
	return await Promise.all(dir.map(f => loadImage(`./frames/${f}`)));
};

const frames = await readFrames();
await encodeGif(frames);