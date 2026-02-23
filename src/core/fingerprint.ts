export async function getBrowserFingerprint(): Promise<string> {
  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(fallbackFingerprint());
          return;
        }
        
        canvas.width = 200;
        canvas.height = 50;
        
        // Text with specific font and styling to capture rendering differences
        ctx.textBaseline = "top";
        ctx.font = "14px 'Arial'";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "#f60";
        ctx.fillRect(125, 1, 62, 20);
        
        ctx.fillStyle = "#069";
        ctx.fillText("Perler Pattern Factory", 2, 15);
        ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
        ctx.fillText("Perler Pattern Factory", 4, 17);
        
        const dataURL = canvas.toDataURL();
        
        // Combine with screen resolution and color depth
        const screenInfo = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        const rawString = `${dataURL}|${screenInfo}|${timezone}`;
        
        // Simple hash function
        let hash = 0;
        for (let i = 0; i < rawString.length; i++) {
          const char = rawString.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; // Convert to 32bit integer
        }
        
        resolve(Math.abs(hash).toString(16));
      } catch (e) {
        resolve(fallbackFingerprint());
      }
    }, 0);
  });
}

function fallbackFingerprint() {
  return Math.random().toString(36).substring(2, 15);
}
