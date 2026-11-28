import React, { useState, useEffect, useRef } from 'react';
import { generateNormalMap, NORMAL_MAP_PRESETS } from '../utils/normalMapGenerator';

/**
 * Interactive Normal Map Studio & Converter Modal
 * 
 * Allows users to upload any 2D image, preview the converted normal map in real-time,
 * adjust strength/depth, toggle OpenGL/DirectX format, and apply it directly to the material.
 */
export default function NormalMapConverterModal({
  isOpen,
  onClose,
  onApply,
  targetTitle = 'Material',
  initialImageSource = null,
  initialStrength = 3.0
}) {
  const [sourceImage, setSourceImage] = useState(initialImageSource);
  const [sourceFileName, setSourceFileName] = useState('image.png');
  const [strength, setStrength] = useState(initialStrength);
  const [invertY, setInvertY] = useState(false);
  const [invertX, setInvertX] = useState(false);
  const [blurRadius, setBlurRadius] = useState(0);
  const [contrast, setContrast] = useState(1.0);
  const [selectedPreset, setSelectedPreset] = useState('standard');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [viewMode, setViewMode] = useState('split'); // 'split', 'normal', 'source'
  const [convertedResult, setConvertedResult] = useState(null);

  const previewCanvasRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Initialize or update with initial source
  useEffect(() => {
    if (isOpen) {
      if (initialImageSource) {
        setSourceImage(initialImageSource);
        if (typeof initialImageSource === 'string') {
          const parts = initialImageSource.split('/');
          setSourceFileName(parts[parts.length - 1]?.split('?')[0] || 'texture.png');
        } else if (initialImageSource instanceof File) {
          setSourceFileName(initialImageSource.name);
        }
      }
      setStrength(initialStrength || 3.0);
    }
  }, [isOpen, initialImageSource, initialStrength]);

  // Regenerate normal map when parameters or source image change
  useEffect(() => {
    if (!isOpen || !sourceImage) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      setIsProcessing(true);
      setErrorMsg('');

      try {
        const baseName = (sourceFileName || 'texture').replace(/\.[^/.]+$/, '');
        const outFileName = `${baseName}_normal.png`;

        const result = await generateNormalMap(sourceImage, {
          strength,
          invertY,
          invertX,
          blurRadius,
          contrast,
          maxDimension: 1024,
          fileName: outFileName
        });

        setConvertedResult(result);

        // Render to preview canvas
        if (previewCanvasRef.current) {
          const canvas = previewCanvasRef.current;
          canvas.width = result.width;
          canvas.height = result.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(result.canvas, 0, 0);
        }
      } catch (err) {
        console.error('[NormalMapConverterModal] Conversion error:', err);
        setErrorMsg(err.message || 'Failed to convert image to normal map');
      } finally {
        setIsProcessing(false);
      }
    }, 120);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [isOpen, sourceImage, strength, invertY, invertX, blurRadius, contrast, sourceFileName]);

  if (!isOpen) return null;

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSourceImage(file);
    setSourceFileName(file.name);
  };

  const handleApplyPreset = (preset) => {
    setSelectedPreset(preset.id);
    setStrength(preset.strength);
    setBlurRadius(preset.blurRadius);
    setInvertY(preset.invertY);
  };

  const handleApplyToMaterial = async () => {
    if (!sourceImage) {
      setErrorMsg('Please select or upload an image first.');
      return;
    }

    setIsProcessing(true);
    setErrorMsg('');

    try {
      // Re-generate at full high quality (up to 2048) for the actual applied texture
      const baseName = (sourceFileName || 'texture').replace(/\.[^/.]+$/, '');
      const outFileName = `${baseName}_normal.png`;

      const fullResult = await generateNormalMap(sourceImage, {
        strength,
        invertY,
        invertX,
        blurRadius,
        contrast,
        maxDimension: 2048,
        fileName: outFileName
      });

      if (onApply) {
        await onApply(fullResult.file, {
          strength,
          invertY,
          invertX,
          blurRadius
        });
      }

      onClose();
    } catch (err) {
      console.error('[NormalMapConverterModal] Apply failed:', err);
      setErrorMsg('Failed to apply normal map: ' + (err.message || err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadNormalMap = () => {
    if (!convertedResult?.dataUrl) return;
    const a = document.createElement('a');
    a.href = convertedResult.dataUrl;
    const baseName = (sourceFileName || 'texture').replace(/\.[^/.]+$/, '');
    a.download = `${baseName}_normal.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-[#121316] border border-cyan-500/40 rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-zinc-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-500/20 bg-cyan-950/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <span className="material-symbols-outlined text-xl">auto_fix_high</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Convert Image to Normal Map
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {targetTitle}
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Transforms 2D photos, bump textures, and artwork into tangent-space PBR normal vectors
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors"
            title="Close"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* File Upload / Source Selector */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-3.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-md transition-colors">
                <span className="material-symbols-outlined text-base">upload_file</span>
                <span>Choose Image to Convert</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/jpg"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {sourceImage && (
                <div className="text-xs text-zinc-300 flex items-center gap-2 font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="truncate max-w-[220px]">{sourceFileName}</span>
                </div>
              )}
            </div>

            {/* View Mode Selector */}
            <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`px-2.5 py-1 rounded transition-colors ${viewMode === 'split' ? 'bg-cyan-600 text-white font-medium' : 'text-zinc-400 hover:text-white'}`}
              >
                Side-by-Side
              </button>
              <button
                type="button"
                onClick={() => setViewMode('normal')}
                className={`px-2.5 py-1 rounded transition-colors ${viewMode === 'normal' ? 'bg-cyan-600 text-white font-medium' : 'text-zinc-400 hover:text-white'}`}
              >
                Normal Map
              </button>
              <button
                type="button"
                onClick={() => setViewMode('source')}
                className={`px-2.5 py-1 rounded transition-colors ${viewMode === 'source' ? 'bg-cyan-600 text-white font-medium' : 'text-zinc-400 hover:text-white'}`}
              >
                Original Source
              </button>
            </div>
          </div>

          {/* Interactive Preview Viewport */}
          <div className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950/90 relative min-h-[260px] max-h-[340px] flex items-center justify-center p-4">
            {!sourceImage ? (
              <div className="flex flex-col items-center justify-center text-zinc-500 py-12 space-y-3">
                <span className="material-symbols-outlined text-4xl text-zinc-600">add_photo_alternate</span>
                <p className="text-sm font-medium">Select or upload an image above to preview normal map conversion</p>
                <p className="text-xs text-zinc-600">Supports JPG, PNG, WEBP textures and photos</p>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center gap-4">
                {/* Source Image */}
                {(viewMode === 'split' || viewMode === 'source') && (
                  <div className="flex-1 flex flex-col items-center justify-center max-h-[300px]">
                    <span className="text-[10px] font-mono uppercase text-zinc-400 mb-1">Source Image</span>
                    <div className="relative rounded-lg overflow-hidden border border-zinc-700/60 shadow-lg max-h-[260px]">
                      <img
                        src={typeof sourceImage === 'string' ? sourceImage : URL.createObjectURL(sourceImage)}
                        alt="Source"
                        className="max-h-[260px] object-contain"
                      />
                    </div>
                  </div>
                )}

                {/* Converted Normal Map */}
                {(viewMode === 'split' || viewMode === 'normal') && (
                  <div className="flex-1 flex flex-col items-center justify-center max-h-[300px]">
                    <span className="text-[10px] font-mono uppercase text-cyan-300 mb-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">waves</span>
                      Generated Normal Map
                    </span>
                    <div className="relative rounded-lg overflow-hidden border border-cyan-500/40 shadow-lg shadow-cyan-950/40 max-h-[260px]">
                      <canvas
                        ref={previewCanvasRef}
                        className="max-h-[260px] object-contain"
                      />
                      {isProcessing && (
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center text-cyan-400 text-xs gap-2">
                          <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                          <span>Synthesizing normals...</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Presets */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-cyan-400">tune</span>
              Quick Presets
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {NORMAL_MAP_PRESETS.map((preset) => {
                const isActive = selectedPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      isActive
                        ? 'bg-cyan-950/60 border-cyan-500 text-cyan-200 shadow-sm'
                        : 'bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:bg-zinc-800/80 hover:border-zinc-700'
                    }`}
                  >
                    <div className="text-xs font-bold">{preset.name}</div>
                    <div className="text-[10px] text-zinc-400 truncate">{preset.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fine Tuning Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800">
            
            {/* Strength / Depth */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-300">Relief Strength (Depth)</span>
                <span className="font-mono text-cyan-400">{strength.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="10.0"
                step="0.1"
                value={strength}
                onChange={(e) => {
                  setStrength(parseFloat(e.target.value));
                  setSelectedPreset('custom');
                }}
                className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
              />
              <p className="text-[10px] text-zinc-500">Higher values produce deeper crevices and bolder surface relief.</p>
            </div>

            {/* Blur / Smoothing */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-300">Smoothness / Denoise</span>
                <span className="font-mono text-cyan-400">{blurRadius} px</span>
              </div>
              <input
                type="range"
                min="0"
                max="4"
                step="1"
                value={blurRadius}
                onChange={(e) => {
                  setBlurRadius(parseInt(e.target.value, 10));
                  setSelectedPreset('custom');
                }}
                className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
              />
              <p className="text-[10px] text-zinc-500">Smooths out high-frequency digital noise and camera artifacts.</p>
            </div>

            {/* Contrast */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-300">Feature Contrast</span>
                <span className="font-mono text-cyan-400">{contrast.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={contrast}
                onChange={(e) => {
                  setContrast(parseFloat(e.target.value));
                  setSelectedPreset('custom');
                }}
                className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
              />
              <p className="text-[10px] text-zinc-500">Expands the midtone gradients between high and low features.</p>
            </div>

            {/* Invert Toggles */}
            <div className="flex items-center gap-4 pt-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300 select-none">
                <input
                  type="checkbox"
                  checked={invertY}
                  onChange={(e) => {
                    setInvertY(e.target.checked);
                    setSelectedPreset('custom');
                  }}
                  className="rounded bg-zinc-800 border-zinc-700 text-cyan-500 focus:ring-cyan-500/20"
                />
                <span>Invert Green (Y) / DirectX</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300 select-none">
                <input
                  type="checkbox"
                  checked={invertX}
                  onChange={(e) => {
                    setInvertX(e.target.checked);
                    setSelectedPreset('custom');
                  }}
                  className="rounded bg-zinc-800 border-zinc-700 text-cyan-500 focus:ring-cyan-500/20"
                />
                <span>Invert Red (X)</span>
              </label>
            </div>

          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">error</span>
              <span>{errorMsg}</span>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-cyan-500/20 bg-zinc-950">
          <button
            type="button"
            onClick={handleDownloadNormalMap}
            disabled={!convertedResult}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-xs text-zinc-200 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            title="Download generated PNG file"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            <span>Download PNG</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleApplyToMaterial}
              disabled={!sourceImage || isProcessing}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              {isProcessing ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                  <span>Applying to Material...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  <span>Apply Normal Map to Material</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
