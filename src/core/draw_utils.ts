import { ColorInfo } from './color_utils';

export function getLuminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function drawPattern(
  ctx: CanvasRenderingContext2D,
  grid: ColorInfo[][],
  cellSize: number = 40,
  margin: number = 60,
  selectedColorCodes: string[] = []
) {
  const rows = grid.length;
  const cols = grid[0].length;
  const hasSelection = selectedColorCodes.length > 0;

  // Calculate statistics
  const statsMap = new Map<string, { color: ColorInfo, count: number }>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c];
      if (cell.isExternal) continue; // Skip background in stats
      if (!statsMap.has(cell.code)) {
        statsMap.set(cell.code, { color: cell, count: 0 });
      }
      statsMap.get(cell.code)!.count++;
    }
  }
  const stats = Array.from(statsMap.values()).sort((a, b) => b.count - a.count);

  const gridWidth = cols * cellSize;
  const gridHeight = rows * cellSize;

  const statItemWidth = Math.max(120, cellSize * 3);
  const statItemHeight = cellSize;
  const statSpacingX = 20;
  const statSpacingY = 20;

  const maxStatsPerRow = Math.max(1, Math.floor(gridWidth / (statItemWidth + statSpacingX)));
  const statsRows = Math.ceil(stats.length / maxStatsPerRow);
  const statsSectionHeight = statsRows * (statItemHeight + statSpacingY);

  const width = Math.max(gridWidth + margin * 2, statItemWidth + margin * 2);
  const height = gridHeight + margin * 2.5 + statsSectionHeight + margin;

  const offsetX = (width - gridWidth) / 2;
  const offsetY = margin;

  ctx.canvas.width = width;
  ctx.canvas.height = height;

  // Fill background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${cellSize * 0.35}px sans-serif`;

  // Draw cells
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const color = grid[r][c];
      const isSelected = selectedColorCodes.includes(color.code);
      const x = offsetX + c * cellSize;
      const y = offsetY + r * cellSize;

      // Focus mode: reduce opacity for non-selected
      if (color.isExternal) {
        ctx.globalAlpha = 0.1; // Background is very faint
      } else if (hasSelection && !isSelected) {
        ctx.globalAlpha = 0.3;
      } else {
        ctx.globalAlpha = 1.0;
      }

      // Fill cell
      if (color.isExternal) {
        ctx.fillStyle = '#f3f4f6'; // Light gray for background
      } else {
        ctx.fillStyle = `rgb(${color.rgb[0]}, ${color.rgb[1]}, ${color.rgb[2]})`;
      }
      ctx.fillRect(x, y, cellSize, cellSize);

      // Draw grid line
      ctx.strokeStyle = '#e5e7eb'; // gray-200
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, cellSize, cellSize);

      // Draw text
      if (!color.isExternal) {
        const lum = getLuminance(color.rgb[0], color.rgb[1], color.rgb[2]);
        ctx.fillStyle = lum > 128 ? '#111827' : '#ffffff';
        ctx.fillText(color.code, x + cellSize / 2, y + cellSize / 2);
      }
      
      ctx.globalAlpha = 1.0;
    }
  }

  // Draw thick borders for selected colors
  if (hasSelection) {
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const color = grid[r][c];
        if (selectedColorCodes.includes(color.code)) {
          const x = offsetX + c * cellSize;
          const y = offsetY + r * cellSize;

          // Check neighbors
          const neighbors = [
            { dr: -1, dc: 0, side: 'top' },
            { dr: 1, dc: 0, side: 'bottom' },
            { dr: 0, dc: -1, side: 'left' },
            { dr: 0, dc: 1, side: 'right' }
          ];

          for (const { dr, dc, side } of neighbors) {
            const nr = r + dr;
            const nc = c + dc;
            let isEdge = false;

            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) {
              isEdge = true;
            } else if (grid[nr][nc].code !== color.code) {
              isEdge = true;
            }

            if (isEdge) {
              ctx.beginPath();
              if (side === 'top') {
                ctx.moveTo(x, y);
                ctx.lineTo(x + cellSize, y);
              } else if (side === 'bottom') {
                ctx.moveTo(x, y + cellSize);
                ctx.lineTo(x + cellSize, y + cellSize);
              } else if (side === 'left') {
                ctx.moveTo(x, y);
                ctx.lineTo(x, y + cellSize);
              } else if (side === 'right') {
                ctx.moveTo(x + cellSize, y);
                ctx.lineTo(x + cellSize, y + cellSize);
              }
              ctx.stroke();
            }
          }
        }
      }
    }
  }

  // Draw thick grid lines every 10 cells
  ctx.strokeStyle = '#4b5563'; // gray-600
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let c = 10; c < cols; c += 10) {
    const x = offsetX + c * cellSize;
    ctx.moveTo(x, offsetY);
    ctx.lineTo(x, offsetY + gridHeight);
  }
  for (let r = 10; r < rows; r += 10) {
    const y = offsetY + r * cellSize;
    ctx.moveTo(offsetX, y);
    ctx.lineTo(offsetX + gridWidth, y);
  }
  ctx.rect(offsetX, offsetY, gridWidth, gridHeight);
  ctx.stroke();

  // Draw coordinates
  ctx.fillStyle = '#374151';
  for (let c = 0; c < cols; c++) {
    const text = (c + 1).toString();
    const isTen = (c + 1) % 10 === 0;
    ctx.font = isTen ? `bold ${margin * 0.4}px sans-serif` : `${margin * 0.3}px sans-serif`;
    const x = offsetX + c * cellSize + cellSize / 2;
    ctx.fillText(text, x, offsetY - margin / 2);
    ctx.fillText(text, x, offsetY + gridHeight + margin / 2);
  }
  for (let r = 0; r < rows; r++) {
    const text = (r + 1).toString();
    const isTen = (r + 1) % 10 === 0;
    ctx.font = isTen ? `bold ${margin * 0.4}px sans-serif` : `${margin * 0.3}px sans-serif`;
    const y = offsetY + r * cellSize + cellSize / 2;
    ctx.fillText(text, offsetX - margin / 2, y);
    ctx.fillText(text, offsetX + gridWidth + margin / 2, y);
  }

  // Draw statistics
  const statsStartY = offsetY + gridHeight + margin * 1.5;
  for (let i = 0; i < stats.length; i++) {
    const stat = stats[i];
    const isSelected = selectedColorCodes.includes(stat.color.code);
    const row = Math.floor(i / maxStatsPerRow);
    const col = i % maxStatsPerRow;
    const actualStatsWidth = Math.min(stats.length, maxStatsPerRow) * (statItemWidth + statSpacingX) - statSpacingX;
    const statsOffsetX = (width - actualStatsWidth) / 2;
    const x = statsOffsetX + col * (statItemWidth + statSpacingX);
    const y = statsStartY + row * (statItemHeight + statSpacingY);

    if (hasSelection && !isSelected) {
      ctx.globalAlpha = 0.3;
    } else {
      ctx.globalAlpha = 1.0;
    }

    ctx.fillStyle = `rgb(${stat.color.rgb[0]}, ${stat.color.rgb[1]}, ${stat.color.rgb[2]})`;
    ctx.fillRect(x, y, cellSize, cellSize);
    
    // Highlight border for selected in stats too
    if (isSelected) {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
    } else {
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
    }
    ctx.strokeRect(x, y, cellSize, cellSize);

    const lum = getLuminance(stat.color.rgb[0], stat.color.rgb[1], stat.color.rgb[2]);
    ctx.fillStyle = lum > 128 ? '#111827' : '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = `bold ${cellSize * 0.35}px sans-serif`;
    ctx.fillText(stat.color.code, x + cellSize / 2, y + cellSize / 2);

    ctx.fillStyle = '#111827';
    ctx.textAlign = 'left';
    ctx.font = `${cellSize * 0.4}px sans-serif`;
    ctx.fillText(` * ${stat.count}`, x + cellSize + 8, y + cellSize / 2);
    
    ctx.globalAlpha = 1.0;
  }
}
