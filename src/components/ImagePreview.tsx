import React, { useRef, useEffect } from 'react';
import { Region } from '../utils/imageAnalysis';

interface Props {
  src: string;
  regions: Region[];
  darkMode: boolean;
  title: string;
}

const ImagePreview: React.FC<Props> = ({ src, regions, darkMode, title }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw the original image
      ctx.drawImage(img, 0, 0);

      // Draw regions
      regions.forEach(region => {
        ctx.strokeStyle = `rgba(255, 0, 0, ${region.confidence})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(region.x, region.y, region.width, region.height);

        // Add semi-transparent overlay
        ctx.fillStyle = `rgba(255, 0, 0, ${region.confidence * 0.2})`;
        ctx.fillRect(region.x, region.y, region.width, region.height);
      });
    };
    img.src = src;
  }, [src, regions]);

  return (
    <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <canvas
        ref={canvasRef}
        className="max-w-full h-auto rounded-lg"
      />
      {regions.length > 0 && (
        <p className={`mt-2 text-sm ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
          {regions.length} potential tampered {regions.length === 1 ? 'region' : 'regions'} detected
        </p>
      )}
    </div>
  );
};

export default ImagePreview;