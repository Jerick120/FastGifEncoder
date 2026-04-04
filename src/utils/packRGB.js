export const packRgb565 = (r, g, b) => ((r << 8) & 63488) | ((g << 2) & 992) | (b >> 3);
export const packRgba4444 = (r, g, b, a) => (r >> 4) | (240 & g) | ((240 & b) << 4) | ((240 & a) << 8);
export const packRgb444 = (r, g, b) => ((r >> 4) << 8) | (240 & g) | (b >> 4);