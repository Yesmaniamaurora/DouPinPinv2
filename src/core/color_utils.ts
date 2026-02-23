import { rawPaletteData } from './palette_data';

export type ColorInfo = { 
  code: string; 
  rgb: [number, number, number]; 
  lab: [number, number, number];
  isExternal?: boolean;
};

export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  let r_ = r / 255, g_ = g / 255, b_ = b / 255;
  r_ = r_ > 0.04045 ? Math.pow((r_ + 0.055) / 1.055, 2.4) : r_ / 12.92;
  g_ = g_ > 0.04045 ? Math.pow((g_ + 0.055) / 1.055, 2.4) : g_ / 12.92;
  b_ = b_ > 0.04045 ? Math.pow((b_ + 0.055) / 1.055, 2.4) : b_ / 12.92;

  let x = (r_ * 0.4124 + g_ * 0.3576 + b_ * 0.1805) * 100;
  let y = (r_ * 0.2126 + g_ * 0.7152 + b_ * 0.0722) * 100;
  let z = (r_ * 0.0193 + g_ * 0.1192 + b_ * 0.9505) * 100;

  x /= 95.047;
  y /= 100.000;
  z /= 108.883;

  x = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x) + (16 / 116);
  y = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y) + (16 / 116);
  z = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z) + (16 / 116);

  return [(116 * y) - 16, 500 * (x - y), 200 * (y - z)];
}

export function deltaE(lab1: [number, number, number], lab2: [number, number, number]): number {
  return Math.sqrt(Math.pow(lab1[0] - lab2[0], 2) + Math.pow(lab1[1] - lab2[1], 2) + Math.pow(lab1[2] - lab2[2], 2));
}

export type BrandName = 'mard' | '漫漫' | '盼盼' | '咪小窝' | 'COCO' | '卡卡';
export const brandNames: BrandName[] = ['mard', '漫漫', '盼盼', '咪小窝', 'COCO', '卡卡'];

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [0, 0, 0];
}

function parsePalettes(): Record<BrandName, ColorInfo[]> {
  const lines = rawPaletteData.trim().split('\n');
  const headers = lines[0].split(',');
  
  const brandIndices: Record<BrandName, number> = {
    'mard': headers.indexOf('mard'),
    '漫漫': headers.indexOf('漫漫'),
    '盼盼': headers.indexOf('盼盼'),
    '咪小窝': headers.indexOf('咪小窝'),
    'COCO': headers.indexOf('COCO'),
    '卡卡': headers.indexOf('卡卡'),
  };

  const parsedPalettes: Record<BrandName, ColorInfo[]> = {
    'mard': [],
    '漫漫': [],
    '盼盼': [],
    '咪小窝': [],
    'COCO': [],
    '卡卡': [],
  };

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    const hex = parts[0].trim();
    
    // Skip rows without a valid hex code
    if (!hex.startsWith('#') || hex.length !== 7) {
      continue;
    }

    const rgb = hexToRgb(hex);
    const lab = rgbToLab(rgb[0], rgb[1], rgb[2]);

    for (const brand of brandNames) {
      const idx = brandIndices[brand];
      const code = parts[idx]?.trim();
      if (code) {
        parsedPalettes[brand].push({ code, rgb, lab });
      }
    }
  }

  return parsedPalettes;
}

export const palettes = parsePalettes();
export type PaletteKey = BrandName;

export function findClosestColor(r: number, g: number, b: number, paletteKey: PaletteKey): ColorInfo {
  const lab = rgbToLab(r, g, b);
  const palette = palettes[paletteKey];
  let minDistance = Infinity;
  let closest = palette[0];

  for (const color of palette) {
    const distance = deltaE(lab, color.lab);
    if (distance < minDistance) {
      minDistance = distance;
      closest = color;
    }
  }
  return closest;
}
