import { findClosestColor, PaletteKey, ColorInfo } from './color_utils';
import { drawPattern } from './draw_utils';

export type Algorithm = 'average' | 'nearest' | 'gradient_enhanced' | 'dominant_pooling';

export class PerlerBeadGenerator {
  static async generate(
    imageSource: HTMLImageElement,
    targetW: number,
    targetH: number,
    algorithm: Algorithm,
    paletteKey: PaletteKey,
    brightness: number = 0,
    removeBackground: boolean = false,
    backgroundTolerance: number = 30
  ): Promise<{ image: string, grid: ColorInfo[][] }> {
    // 1. Calculate crop and scale (Center Crop)
    const imgW = imageSource.width;
    const imgH = imageSource.height;
    
    const targetRatio = targetW / targetH;
    const imgRatio = imgW / imgH;

    let cropX = 0, cropY = 0, cropW = imgW, cropH = imgH;

    if (imgRatio > targetRatio) {
      // Image is wider, crop width
      cropW = imgH * targetRatio;
      cropX = (imgW - cropW) / 2;
    } else {
      // Image is taller, crop height
      cropH = imgW / targetRatio;
      cropY = (imgH - cropH) / 2;
    }

    const grid: ColorInfo[][] = [];
    const bOffset = brightness * 15; // Slight brightness adjustment

    // 2. Background Removal (Process at higher res than target but lower than original for performance)
    const procW = targetW * 4;
    const procH = targetH * 4;
    const procCanvas = document.createElement('canvas');
    procCanvas.width = procW;
    procCanvas.height = procH;
    const procCtx = procCanvas.getContext('2d', { willReadFrequently: true })!;
    procCtx.drawImage(imageSource, cropX, cropY, cropW, cropH, 0, 0, procW, procH);
    const procData = procCtx.getImageData(0, 0, procW, procH).data;

    const isBackgroundMask = new Uint8Array(procW * procH); // 1 if background, 0 otherwise

    if (removeBackground) {
      const visited = new Uint8Array(procW * procH);
      const queue: [number, number][] = [];
      
      // Add corners
      queue.push([0, 0], [0, procW - 1], [procH - 1, 0], [procH - 1, procW - 1]);
      
      const isBgColor = (idx: number) => {
        const r = procData[idx];
        const g = procData[idx + 1];
        const b = procData[idx + 2];
        const distToWhite = Math.sqrt(Math.pow(255 - r, 2) + Math.pow(255 - g, 2) + Math.pow(255 - b, 2));
        return distToWhite < backgroundTolerance * 2; 
      };

      let head = 0;
      while (head < queue.length) {
        const [r, c] = queue[head++];
        const idx = r * procW + c;
        if (visited[idx]) continue;
        visited[idx] = 1;

        if (isBgColor(idx * 4)) {
          isBackgroundMask[idx] = 1;
          
          // Check neighbors
          if (r > 0) queue.push([r - 1, c]);
          if (r < procH - 1) queue.push([r + 1, c]);
          if (c > 0) queue.push([r, c - 1]);
          if (c < procW - 1) queue.push([r, c + 1]);
        }
      }
    }

    const blockW = procW / targetW;
    const blockH = procH / targetH;

    if (algorithm === 'nearest') {
      for (let r = 0; r < targetH; r++) {
        const row: ColorInfo[] = [];
        for (let c = 0; c < targetW; c++) {
          const pr = Math.floor(r * blockH + blockH / 2);
          const pc = Math.floor(c * blockW + blockW / 2);
          const idx = (pr * procW + pc) * 4;
          
          let rVal = Math.min(255, Math.max(0, procData[idx] + bOffset));
          let gVal = Math.min(255, Math.max(0, procData[idx+1] + bOffset));
          let bVal = Math.min(255, Math.max(0, procData[idx+2] + bOffset));
          
          const color = findClosestColor(rVal, gVal, bVal, paletteKey);
          const info = { ...color };
          if (removeBackground && isBackgroundMask[pr * procW + pc]) {
            info.isExternal = true;
          }
          row.push(info);
        }
        grid.push(row);
      }
    } else if (algorithm === 'dominant_pooling') {
      for (let r = 0; r < targetH; r++) {
        const row: ColorInfo[] = [];
        for (let c = 0; c < targetW; c++) {
          const colorFreq: Map<string, { r: number, g: number, b: number, count: number }> = new Map();
          let bgCount = 0;
          let totalCount = 0;

          const startY = Math.floor(r * blockH);
          const endY = Math.min(Math.floor((r + 1) * blockH), procH);
          const startX = Math.floor(c * blockW);
          const endX = Math.min(Math.floor((c + 1) * blockW), procW);

          for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
              const idx = (y * procW + x) * 4;
              const alpha = procData[idx + 3];
              if (alpha < 10) {
                bgCount++;
                totalCount++;
                continue;
              }

              if (removeBackground && isBackgroundMask[y * procW + x]) {
                bgCount++;
              }

              const rv = Math.min(255, Math.max(0, procData[idx] + bOffset));
              const gv = Math.min(255, Math.max(0, procData[idx+1] + bOffset));
              const bv = Math.min(255, Math.max(0, procData[idx+2] + bOffset));
              
              const key = `${Math.round(rv/10)*10},${Math.round(gv/10)*10},${Math.round(bv/10)*10}`;
              if (!colorFreq.has(key)) {
                colorFreq.set(key, { r: rv, g: gv, b: bv, count: 0 });
              }
              colorFreq.get(key)!.count++;
              totalCount++;
            }
          }

          let dominant = { r: 255, g: 255, b: 255 };
          let maxCount = -1;
          colorFreq.forEach(val => {
            if (val.count > maxCount) {
              maxCount = val.count;
              dominant = { r: val.r, g: val.g, b: val.b };
            }
          });

          const color = findClosestColor(dominant.r, dominant.g, dominant.b, paletteKey);
          const info = { ...color };
          if (removeBackground && bgCount / totalCount > 0.5) {
            info.isExternal = true;
          }
          row.push(info);
        }
        grid.push(row);
      }
    } else {
      // Average or Gradient Enhanced
      const rawGrid: {r: number, g: number, b: number, isBg: boolean}[][] = [];

      for (let r = 0; r < targetH; r++) {
        const row: {r: number, g: number, b: number, isBg: boolean}[] = [];
        for (let c = 0; c < targetW; c++) {
          let sumR = 0, sumG = 0, sumB = 0, count = 0, bgCount = 0;
          const startY = Math.floor(r * blockH);
          const endY = Math.min(Math.floor((r + 1) * blockH), procH);
          const startX = Math.floor(c * blockW);
          const endX = Math.min(Math.floor((c + 1) * blockW), procW);

          for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
              const idx = (y * procW + x) * 4;
              sumR += Math.min(255, Math.max(0, procData[idx] + bOffset));
              sumG += Math.min(255, Math.max(0, procData[idx+1] + bOffset));
              sumB += Math.min(255, Math.max(0, procData[idx+2] + bOffset));
              count++;
              if (removeBackground && isBackgroundMask[y * procW + x]) {
                bgCount++;
              }
            }
          }
          
          if (count === 0) count = 1;
          row.push({ 
            r: sumR / count, 
            g: sumG / count, 
            b: sumB / count, 
            isBg: removeBackground && (bgCount / count > 0.5) 
          });
        }
        rawGrid.push(row);
      }

      if (algorithm === 'gradient_enhanced') {
        const enhancedGrid: {r: number, g: number, b: number, isBg: boolean}[][] = [];
        for (let r = 0; r < targetH; r++) {
          const row: {r: number, g: number, b: number, isBg: boolean}[] = [];
          for (let c = 0; c < targetW; c++) {
            const center = rawGrid[r][c];
            let diffSum = 0;
            let neighbors = 0;
            const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
            
            for (const [dr, dc] of dirs) {
              const nr = r + dr, nc = c + dc;
              if (nr >= 0 && nr < targetH && nc >= 0 && nc < targetW) {
                const neighbor = rawGrid[nr][nc];
                diffSum += Math.abs(center.r - neighbor.r) + 
                           Math.abs(center.g - neighbor.g) + 
                           Math.abs(center.b - neighbor.b);
                neighbors++;
              }
            }
            
            const avgDiff = neighbors > 0 ? diffSum / neighbors : 0;
            
            if (avgDiff < 15) {
              row.push({ ...center });
            } else {
              const weightCenter = 2;
              const weightEdge = -0.1;
              let sumR = center.r * weightCenter;
              let sumG = center.g * weightCenter;
              let sumB = center.b * weightCenter;
              let validNeighbors = 0;

              for (const [dr, dc] of dirs) {
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < targetH && nc >= 0 && nc < targetW) {
                  sumR += rawGrid[nr][nc].r * weightEdge;
                  sumG += rawGrid[nr][nc].g * weightEdge;
                  sumB += rawGrid[nr][nc].b * weightEdge;
                  validNeighbors++;
                }
              }
              
              const missingEdges = 4 - validNeighbors;
              sumR += center.r * (missingEdges * weightEdge);
              sumG += center.g * (missingEdges * weightEdge);
              sumB += center.b * (missingEdges * weightEdge);

              row.push({
                r: Math.min(255, Math.max(0, sumR)),
                g: Math.min(255, Math.max(0, sumG)),
                b: Math.min(255, Math.max(0, sumB)),
                isBg: center.isBg
              });
            }
          }
          enhancedGrid.push(row);
        }

        for (let r = 0; r < targetH; r++) {
          const row: ColorInfo[] = [];
          for (let c = 0; c < targetW; c++) {
            const color = findClosestColor(enhancedGrid[r][c].r, enhancedGrid[r][c].g, enhancedGrid[r][c].b, paletteKey);
            const info = { ...color };
            if (enhancedGrid[r][c].isBg) info.isExternal = true;
            row.push(info);
          }
          grid.push(row);
        }
      } else {
        for (let r = 0; r < targetH; r++) {
          const row: ColorInfo[] = [];
          for (let c = 0; c < targetW; c++) {
            const color = findClosestColor(rawGrid[r][c].r, rawGrid[r][c].g, rawGrid[r][c].b, paletteKey);
            const info = { ...color };
            if (rawGrid[r][c].isBg) info.isExternal = true;
            row.push(info);
          }
          grid.push(row);
        }
      }
    }

    // 3. Render final pattern
    const outCanvas = document.createElement('canvas');
    const outCtx = outCanvas.getContext('2d')!;
    drawPattern(outCtx, grid);

    return {
      image: outCanvas.toDataURL('image/png'),
      grid: grid
    };
  }
}
