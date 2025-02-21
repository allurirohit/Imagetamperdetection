import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { AlertTriangle, Upload, Download, Sun, Moon } from 'lucide-react';
import exifr from 'exifr';
import {
  performErrorLevelAnalysis,
  detectCopyMove,
  calculateOverallConfidence,
  Region
} from './utils/imageAnalysis';
import ImagePreview from './components/ImagePreview';
import ImageAnalysisResult from './components/ImageAnalysisResult';

interface ImageAnalysis {
  fileName: string;
  fileSize: string;
  dimensions: string;
  mimeType: string;
  exifData: any;
  warnings: string[];
  regions: Region[];
  confidence: number;
}

interface ImageData {
  file: File | null;
  preview: string;
  analysis: ImageAnalysis | null;
}

function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [primaryImage, setPrimaryImage] = useState<ImageData>({
    file: null,
    preview: '',
    analysis: null
  });
  const [secondaryImage, setSecondaryImage] = useState<ImageData>({
    file: null,
    preview: '',
    analysis: null
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const analyzeImage = async (file: File): Promise<ImageAnalysis> => {
    const warnings: string[] = [];
    let regions: Region[] = [];
    let confidence = 0;

    try {
      // Get image dimensions
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      // Create canvas for image processing
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Extract EXIF data
      const exifData = await exifr.parse(file);

      // Perform Error Level Analysis
      const elaResults = await performErrorLevelAnalysis(imageData);
      regions = [...regions, ...elaResults.regions];

      // Perform Copy-Move Detection
      const copyMoveResults = await detectCopyMove(imageData);
      regions = [...regions, ...copyMoveResults.regions];

      // Basic analysis and warning checks
      if (!exifData) {
        warnings.push('No EXIF metadata found - this could indicate the image has been edited');
      }

      if (exifData?.ModifyDate && exifData?.CreateDate) {
        const modifyTime = new Date(exifData.ModifyDate).getTime();
        const createTime = new Date(exifData.CreateDate).getTime();
        if (modifyTime < createTime) {
          warnings.push('Modification date is earlier than creation date - possible timestamp manipulation');
        }
      }

      if (file.type !== 'image/jpeg' && exifData?.Make) {
        warnings.push('Non-JPEG image contains camera EXIF data - possible format conversion');
      }

      // Check for resolution inconsistencies
      if (exifData?.ImageWidth && exifData?.ImageHeight) {
        if (exifData.ImageWidth !== img.width || exifData.ImageHeight !== img.height) {
          warnings.push('Image dimensions do not match EXIF data - possible resizing or cropping');
        }
      }

      // Calculate overall confidence
      confidence = calculateOverallConfidence(elaResults, copyMoveResults, {
        exifData,
        warnings
      });

      return {
        fileName: file.name,
        fileSize: formatFileSize(file.size),
        dimensions: `${img.width}x${img.height}`,
        mimeType: file.type,
        exifData,
        warnings,
        regions,
        confidence
      };
    } catch (error) {
      console.error('Error analyzing image:', error);
      warnings.push('Error analyzing image metadata');
      return {
        fileName: file.name,
        fileSize: formatFileSize(file.size),
        dimensions: 'Unknown',
        mimeType: file.type,
        exifData: null,
        warnings,
        regions: [],
        confidence: 0
      };
    }
  };

  const onDropPrimary = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setPrimaryImage({
        file,
        preview: URL.createObjectURL(file),
        analysis: null
      });
    }
  }, []);

  const onDropSecondary = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setSecondaryImage({
        file,
        preview: URL.createObjectURL(file),
        analysis: null
      });
    }
  }, []);

  const { getRootProps: getPrimaryRootProps, getInputProps: getPrimaryInputProps, isDragActive: isPrimaryDragActive } = useDropzone({
    onDrop: onDropPrimary,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif']
    },
    maxFiles: 1
  });

  const { getRootProps: getSecondaryRootProps, getInputProps: getSecondaryInputProps, isDragActive: isSecondaryDragActive } = useDropzone({
    onDrop: onDropSecondary,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif']
    },
    maxFiles: 1
  });

  const handleAnalysis = async () => {
    setLoading(true);
    try {
      if (primaryImage.file) {
        const primaryAnalysis = await analyzeImage(primaryImage.file);
        setPrimaryImage(prev => ({ ...prev, analysis: primaryAnalysis }));
      }
      if (compareMode && secondaryImage.file) {
        const secondaryAnalysis = await analyzeImage(secondaryImage.file);
        setSecondaryImage(prev => ({ ...prev, analysis: secondaryAnalysis }));
      }
    } finally {
      setLoading(false);
    }
  };

  const generateReport = () => {
    let report = '# Image Tampering Analysis Report\n\n';
    
    if (primaryImage.analysis) {
      report += '## Primary Image Analysis\n\n';
      report += `File Name: ${primaryImage.analysis.fileName}\n`;
      report += `File Size: ${primaryImage.analysis.fileSize}\n`;
      report += `Dimensions: ${primaryImage.analysis.dimensions}\n`;
      report += `Format: ${primaryImage.analysis.mimeType}\n`;
      report += `Tampering Confidence: ${primaryImage.analysis.confidence.toFixed(1)}%\n\n`;
      
      if (primaryImage.analysis.regions.length > 0) {
        report += 'Detected Modifications:\n';
        primaryImage.analysis.regions.forEach((region, index) => {
          report += `- Region ${index + 1}: ${(region.confidence * 100).toFixed(1)}% confidence at (${region.x}, ${region.y})\n`;
        });
        report += '\n';
      }

      if (primaryImage.analysis.warnings.length > 0) {
        report += 'Warnings:\n';
        primaryImage.analysis.warnings.forEach(warning => {
          report += `- ${warning}\n`;
        });
        report += '\n';
      }

      if (primaryImage.analysis.exifData) {
        report += 'EXIF Data:\n';
        Object.entries(primaryImage.analysis.exifData).forEach(([key, value]) => {
          report += `- ${key}: ${value}\n`;
        });
        report += '\n';
      }
    }

    if (compareMode && secondaryImage.analysis) {
      report += '## Comparison Image Analysis\n\n';
      report += `File Name: ${secondaryImage.analysis.fileName}\n`;
      report += `File Size: ${secondaryImage.analysis.fileSize}\n`;
      report += `Dimensions: ${secondaryImage.analysis.dimensions}\n`;
      report += `Format: ${secondaryImage.analysis.mimeType}\n`;
      report += `Tampering Confidence: ${secondaryImage.analysis.confidence.toFixed(1)}%\n\n`;
      
      if (secondaryImage.analysis.regions.length > 0) {
        report += 'Detected Modifications:\n';
        secondaryImage.analysis.regions.forEach((region, index) => {
          report += `- Region ${index + 1}: ${(region.confidence * 100).toFixed(1)}% confidence at (${region.x}, ${region.y})\n`;
        });
        report += '\n';
      }

      if (secondaryImage.analysis.warnings.length > 0) {
        report += 'Warnings:\n';
        secondaryImage.analysis.warnings.forEach(warning => {
          report += `- ${warning}\n`;
        });
        report += '\n';
      }

      if (secondaryImage.analysis.exifData) {
        report += 'EXIF Data:\n';
        Object.entries(secondaryImage.analysis.exifData).forEach(([key, value]) => {
          report += `- ${key}: ${value}\n`;
        });
      }
    }

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'image-tampering-analysis-report.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const toggleCompareMode = () => {
    setCompareMode(!compareMode);
    if (!compareMode) {
      setSecondaryImage({
        file: null,
        preview: '',
        analysis: null
      });
    }
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Advanced Image Tampering Detector</h1>
          <div className="flex gap-4">
            <button
              onClick={toggleCompareMode}
              className={`px-4 py-2 rounded-lg font-medium ${
                compareMode 
                  ? 'bg-blue-600 text-white' 
                  : `${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-700'}`
              }`}
            >
              Compare Mode
            </button>
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-full ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg`}
            >
              {darkMode ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
            </button>
          </div>
        </div>

        <div className={`grid ${compareMode ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'} gap-8`}>
          <div className="space-y-6">
            <div
              {...getPrimaryRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                ${isPrimaryDragActive ? 'border-blue-500 bg-blue-50' : `${darkMode ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'}`}
                ${darkMode ? 'bg-gray-800' : 'bg-white'}`}
            >
              <input {...getPrimaryInputProps()} />
              <Upload className={`w-12 h-12 mx-auto mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              <p className="text-lg mb-2">Drag & drop primary image here, or click to select</p>
              <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Supports JPEG, PNG, and GIF
              </p>
            </div>

            {primaryImage.preview && (
              <ImagePreview
                src={primaryImage.preview}
                regions={primaryImage.analysis?.regions || []}
                darkMode={darkMode}
                title="Primary Image Preview"
              />
            )}

            {primaryImage.analysis && (
              <ImageAnalysisResult
                {...primaryImage.analysis}
                darkMode={darkMode}
              />
            )}
          </div>

          {compareMode && (
            <div className="space-y-6">
              <div
                {...getSecondaryRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                  ${isSecondaryDragActive ? 'border-blue -500 bg-blue-50' : `${darkMode ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'}`}
                  ${darkMode ? 'bg-gray-800' : 'bg-white'}`}
              >
                <input {...getSecondaryInputProps()} />
                <Upload className={`w-12 h-12 mx-auto mb-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                <p className="text-lg mb-2">Drag & drop comparison image here, or click to select</p>
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Supports JPEG, PNG, and GIF
                </p>
              </div>

              {secondaryImage.preview && (
                <ImagePreview
                  src={secondaryImage.preview}
                  regions={secondaryImage.analysis?.regions || []}
                  darkMode={darkMode}
                  title="Comparison Image Preview"
                />
              )}

              {secondaryImage.analysis && (
                <ImageAnalysisResult
                  {...secondaryImage.analysis}
                  darkMode={darkMode}
                />
              )}
            </div>
          )}
        </div>

        <div className="mt-8 flex gap-4">
          <button
            onClick={handleAnalysis}
            disabled={loading || (!primaryImage.file || (compareMode && !secondaryImage.file))}
            className={`flex-1 py-3 px-4 rounded-lg font-medium
              ${loading || (!primaryImage.file || (compareMode && !secondaryImage.file))
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'}
              text-white transition-colors`}
          >
            {loading ? 'Analyzing...' : 'Analyze Images'}
          </button>

          {(primaryImage.analysis || secondaryImage.analysis) && (
            <button
              onClick={generateReport}
              className="py-3 px-6 rounded-lg font-medium bg-green-600 hover:bg-green-700 text-white transition-colors flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
              Download Report
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;