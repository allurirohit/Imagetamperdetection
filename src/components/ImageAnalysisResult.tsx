import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Region } from '../utils/imageAnalysis';

interface Props {
  fileName: string;
  fileSize: string;
  dimensions: string;
  mimeType: string;
  confidence: number;
  warnings: string[];
  exifData: any;
  regions: Region[];
  darkMode: boolean;
}

const ImageAnalysisResult: React.FC<Props> = ({
  fileName,
  fileSize,
  dimensions,
  mimeType,
  confidence,
  warnings,
  exifData,
  regions,
  darkMode
}) => {
  const getConfidenceColor = (confidence: number) => {
    if (confidence < 30) return 'text-green-500';
    if (confidence < 70) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className={`p-6 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Analysis Results</h2>
        <div className={`text-2xl font-bold ${getConfidenceColor(confidence)}`}>
          {confidence.toFixed(1)}% Tampered
        </div>
      </div>
      
      <div className="space-y-4">
        <div>
          <h3 className="font-medium mb-2">Basic Information</h3>
          <ul className={`space-y-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            <li>File Name: {fileName}</li>
            <li>File Size: {fileSize}</li>
            <li>Dimensions: {dimensions}</li>
            <li>Format: {mimeType}</li>
          </ul>
        </div>

        {regions.length > 0 && (
          <div>
            <h3 className="font-medium mb-2">Detected Modifications</h3>
            <ul className={`space-y-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {regions.map((region, index) => (
                <li key={index}>
                  Region {index + 1}: {(region.confidence * 100).toFixed(1)}% confidence
                  <span className="text-sm ml-2">
                    (at {region.x}, {region.y})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {warnings.length > 0 && (
          <div className={`mt-6 p-4 rounded-lg ${darkMode ? 'bg-red-900/20' : 'bg-red-50'} border ${darkMode ? 'border-red-800' : 'border-red-200'}`}>
            <div className="flex items-center mb-2">
              <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
              <h3 className="font-medium text-red-500">Potential Issues Detected</h3>
            </div>
            <ul className="list-disc list-inside space-y-1">
              {warnings.map((warning, index) => (
                <li key={index} className={`${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        )}

        {exifData && (
          <div className="mt-6">
            <h3 className="font-medium mb-2">EXIF Metadata</h3>
            <div className={`space-y-1 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {Object.entries(exifData).map(([key, value]) => (
                <div key={key} className="grid grid-cols-2">
                  <span className="font-medium">{key}:</span>
                  <span>{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageAnalysisResult;