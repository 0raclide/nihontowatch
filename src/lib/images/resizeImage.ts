/** Resize image to max dimension, return as Blob.
 *  Uses step-down resizing (halving) to avoid pixelation when shrinking
 *  large images — single-step canvas downscale produces jagged artifacts
 *  for reductions greater than 2×. */
export async function resizeImage(file: File, maxDim = 2048, quality = 0.85): Promise<Blob> {
  return new Promise((resolve) => {
    const img = document.createElement('img');
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const { width, height } = img;
      if (width <= maxDim && height <= maxDim) {
        resolve(file);
        return;
      }

      // Compute final target dimensions
      let targetW: number, targetH: number;
      if (width > height) {
        targetW = maxDim;
        targetH = Math.round((height / width) * maxDim);
      } else {
        targetH = maxDim;
        targetW = Math.round((width / height) * maxDim);
      }

      // Step-down: halve repeatedly until within 2× of target, then final resize.
      // This avoids the pixelation that canvas bilinear produces on large jumps.
      let curW = width;
      let curH = height;
      let src: HTMLImageElement | HTMLCanvasElement = img;

      while (curW > targetW * 2 || curH > targetH * 2) {
        curW = Math.round(curW / 2);
        curH = Math.round(curH / 2);
        const step = document.createElement('canvas');
        step.width = curW;
        step.height = curH;
        const sCtx = step.getContext('2d')!;
        sCtx.drawImage(src, 0, 0, curW, curH);
        src = step;
      }

      // Final resize to exact target
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(src, 0, 0, targetW, targetH);
      canvas.toBlob(
        blob => resolve(blob || file),
        'image/jpeg',
        quality
      );
    };
    img.src = objectUrl;
  });
}
