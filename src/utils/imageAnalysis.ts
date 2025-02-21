export interface Point {
  x: number;
  y: number;
}

export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export async function performErrorLevelAnalysis(
  imageData: ImageData,
  quality: number = 0.95
): Promise<{ regions: Region[]; heatmap: number[][] }> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  ctx.putImageData(imageData, 0, 0);

  // Create a compressed version
  const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
  const compressedImage = await createImageFromDataUrl(compressedDataUrl);
  
  // Draw compressed image
  const compressedCanvas = document.createElement('canvas');
  const compressedCtx = compressedCanvas.getContext('2d')!;
  compressedCanvas.width = imageData.width;
  compressedCanvas.height = imageData.height;
  compressedCtx.drawImage(compressedImage, 0, 0);
  
  // Compare original vs compressed
  const originalData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const compressedData = compressedCtx.getImageData(0, 0, canvas.width, canvas.height).data;
  
  const blockSize = 16;
  const regions: Region[] = [];
  const heatmap: number[][] = Array(Math.ceil(canvas.height / blockSize))
    .fill(0)
    .map(() => Array(Math.ceil(canvas.width / blockSize)).fill(0));

  for (let y = 0; y < canvas.height; y += blockSize) {
    for (let x = 0; x < canvas.width; x += blockSize) {
      let diffSum = 0;
      let pixelCount = 0;

      for (let by = 0; by < blockSize && y + by < canvas.height; by++) {
        for (let bx = 0; bx < blockSize && x + bx < canvas.width; bx++) {
          const idx = ((y + by) * canvas.width + (x + bx)) * 4;
          const diff = Math.abs(originalData[idx] - compressedData[idx]) +
                      Math.abs(originalData[idx + 1] - compressedData[idx + 1]) +
                      Math.abs(originalData[idx + 2] - compressedData[idx + 2]);
          diffSum += diff;
          pixelCount++;
        }
      }

      const avgDiff = diffSum / (pixelCount * 3);
      const normalizedDiff = Math.min(avgDiff / 30, 1);
      
      heatmap[Math.floor(y / blockSize)][Math.floor(x / blockSize)] = normalizedDiff;

      if (normalizedDiff > 0.3) {
        regions.push({
          x,
          y,
          width: blockSize,
          height: blockSize,
          confidence: normalizedDiff
        });
      }
    }
  }

  return { regions, heatmap };
}

export async function detectCopyMove(
  imageData: ImageData
): Promise<{ regions: Region[]; confidence: number }> {
  const blockSize = 32;
  const threshold = 5;
  const regions: Region[] = [];
  const blocks: { data: Uint8ClampedArray; x: number; y: number }[] = [];

  // Extract blocks
  for (let y = 0; y < imageData.height - blockSize; y += blockSize) {
    for (let x = 0; x < imageData.width - blockSize; x += blockSize) {
      const blockData = new Uint8ClampedArray(blockSize * blockSize * 4);
      let idx = 0;
      
      for (let by = 0; by < blockSize; by++) {
        for (let bx = 0; bx < blockSize; bx++) {
          const sourceIdx = ((y + by) * imageData.width + (x + bx)) * 4;
          blockData[idx++] = imageData.data[sourceIdx];
          blockData[idx++] = imageData.data[sourceIdx + 1];
          blockData[idx++] = imageData.data[sourceIdx + 2];
          blockData[idx++] = imageData.data[sourceIdx + 3];
        }
      }

      blocks.push({ data: blockData, x, y });
    }
  }

  // Compare blocks
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      if (areBlocksSimilar(blocks[i].data, blocks[j].data, threshold)) {
        const distance = Math.sqrt(
          Math.pow(blocks[i].x - blocks[j].x, 2) +
          Math.pow(blocks[i].y - blocks[j].y, 2)
        );

        if (distance > blockSize * 2) {
          const confidence = calculateSimilarityConfidence(blocks[i].data, blocks[j].data);
          regions.push({
            x: blocks[i].x,
            y: blocks[i].y,
            width: blockSize,
            height: blockSize,
            confidence
          });
          regions.push({
            x: blocks[j].x,
            y: blocks[j].y,
            width: blockSize,
            height: blockSize,
            confidence
          });
        }
      }
    }
  }

  const overallConfidence = regions.length > 0
    ? regions.reduce((sum, r) => sum + r.confidence, 0) / regions.length
    : 0;

  return { regions, confidence: overallConfidence };
}

function areBlocksSimilar(
  block1: Uint8ClampedArray,
  block2: Uint8ClampedArray,
  threshold: number
): boolean {
  let diffSum = 0;
  for (let i = 0; i < block1.length; i += 4) {
    diffSum += Math.abs(block1[i] - block2[i]) +
               Math.abs(block1[i + 1] - block2[i + 1]) +
               Math.abs(block1[i + 2] - block2[i + 2]);
  }
  return (diffSum / (block1.length / 4)) < threshold;
}

function calculateSimilarityConfidence(
  block1: Uint8ClampedArray,
  block2: Uint8ClampedArray
): number {
  let diffSum = 0;
  for (let i = 0; i < block1.length; i += 4) {
    diffSum += Math.abs(block1[i] - block2[i]) +
               Math.abs(block1[i + 1] - block2[i + 1]) +
               Math.abs(block1[i + 2] - block2[i + 2]);
  }
  const avgDiff = diffSum / (block1.length / 4);
  return Math.max(0, 1 - (avgDiff / 255));
}

async function createImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export function calculateOverallConfidence(
  elaResults: { regions: Region[] },
  copyMoveResults: { confidence: number },
  metadata: any
): number {
  let confidence = 0;
  let factors = 0;

  // ELA confidence
  if (elaResults.regions.length > 0) {
    confidence += elaResults.regions.reduce((sum, r) => sum + r.confidence, 0) / elaResults.regions.length;
    factors++;
  }

  // Copy-move confidence
  if (copyMoveResults.confidence > 0) {
    confidence += copyMoveResults.confidence;
    factors++;
  }

  // Metadata analysis confidence
  if (metadata) {
    let metadataConfidence = 1;
    if (!metadata.exifData) metadataConfidence *= 0.7;
    if (metadata.warnings.length > 0) metadataConfidence *= (1 - metadata.warnings.length * 0.1);
    confidence += metadataConfidence;
    factors++;
  }

  return factors > 0 ? (confidence / factors) * 100 : 0;
}