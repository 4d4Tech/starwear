/* eslint-disable react/prop-types */
import { useState, useEffect } from 'react';
import {
  getPreRenderedThumbnail,
  captureModelThumbnail,
  getCategoryProcedural3D
} from '../utils/modelThumbnailRenderer';

export default function Model3DThumbnail({
  modelUrl,
  lightingConfig = null,
  fallbackImageUrl,
  category = 'Apparel',
  subcategory = '',
  cleanName = '',
  alt = '',
  className = '',
  imgClassName = '',
  aspectRatio = '',
  badge = true,
  interactiveOnHover = true,
  showPlaceholderIcon = true,
  onClick
}) {
  const procedural = getCategoryProcedural3D(category, subcategory);
  const displayName = cleanName || alt || procedural.label;

  // 1. Synchronous initial resolution: check if pre-rendered or cached (only when no custom lighting is configured)
  const initialThumb = !lightingConfig
    ? (getPreRenderedThumbnail(modelUrl) ||
       getPreRenderedThumbnail(cleanName) ||
       getPreRenderedThumbnail(displayName))
    : null;

  const [thumbnailSrc, setThumbnailSrc] = useState(initialThumb);
  const [isLoading, setIsLoading] = useState(!initialThumb && !!modelUrl);
  const [loadFailed, setLoadFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  // 2. Resolve or dynamically render 3D model thumbnail
  useEffect(() => {
    let isMounted = true;

    // Check pre-rendered static catalog again if props changed (only if no custom lighting)
    if (!lightingConfig) {
      const staticMatch =
        getPreRenderedThumbnail(modelUrl) ||
        getPreRenderedThumbnail(cleanName) ||
        getPreRenderedThumbnail(displayName);

      if (staticMatch) {
        setThumbnailSrc(staticMatch);
        setIsLoading(false);
        setLoadFailed(false);
        return;
      }
    }

    if (!modelUrl) {
      // If no 3D model, fallback to image if provided
      if (fallbackImageUrl) {
        setThumbnailSrc(fallbackImageUrl);
      } else {
        setThumbnailSrc(null);
      }
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadFailed(false);

    captureModelThumbnail(modelUrl, lightingConfig)
      .then((dataUrl) => {
        if (!isMounted) return;
        if (dataUrl) {
          setThumbnailSrc(dataUrl);
          setIsLoading(false);
        } else if (fallbackImageUrl) {
          setThumbnailSrc(fallbackImageUrl);
          setIsLoading(false);
        } else {
          setLoadFailed(true);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('3D thumbnail resolution error:', err);
        if (fallbackImageUrl) {
          setThumbnailSrc(fallbackImageUrl);
        } else {
          setLoadFailed(true);
        }
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [modelUrl, fallbackImageUrl, cleanName, displayName, JSON.stringify(lightingConfig)]);

  const activeBadgeText =
    typeof badge === 'string'
      ? badge
      : badge
      ? modelUrl?.toLowerCase().endsWith('.glb')
        ? '3D GLB'
        : '3D MESH'
      : null;

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden flex items-center justify-center bg-gradient-to-b from-[#111827] via-[#0b0f17] to-[#030712] select-none ${
        aspectRatio || ''
      } ${className}`}
      title={displayName}
    >
      {/* Subtle Studio Showroom Radial Backdrop */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.08)_0%,transparent_70%)] pointer-events-none" />

      {/* Cyber Grid Accent Overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)',
          backgroundSize: '16px 16px'
        }}
      />

      {/* 1. Successful 3D Thumbnail Image */}
      {thumbnailSrc && !loadFailed ? (
        <div className="relative w-full h-full flex items-center justify-center p-2">
          <img
            src={thumbnailSrc}
            alt={displayName}
            onLoad={() => setImgLoaded(true)}
            onError={() => {
              // If image fails, fallback to procedural 3D card
              if (fallbackImageUrl && thumbnailSrc !== fallbackImageUrl) {
                setThumbnailSrc(fallbackImageUrl);
              } else {
                setLoadFailed(true);
              }
            }}
            className={`w-full h-full object-contain filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.8)] transition-all duration-500 ${
              interactiveOnHover ? 'group-hover:scale-108 group-hover:drop-shadow-[0_16px_32px_rgba(56,189,248,0.25)]' : ''
            } ${imgLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'} ${imgClassName}`}
            loading="lazy"
          />

          {/* Shimmer loading mask while image downloads */}
          {!imgLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
            </div>
          )}
        </div>
      ) : isLoading ? (
        /* 2. Loading State: Futuristic 3D Mesh Wireframe Pulse */
        <div className="flex flex-col items-center justify-center gap-2 p-4 text-center z-10 animate-pulse">
          <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-cyan-950/40 border border-cyan-500/30 shadow-[0_0_20px_rgba(56,189,248,0.15)]">
            <span className="material-symbols-outlined text-2xl text-cyan-400 animate-spin">
              progress_activity
            </span>
          </div>
          <span className="font-mono text-[9px] font-bold text-cyan-300 tracking-widest uppercase">
            Rendering 3D...
          </span>
        </div>
      ) : (
        /* 3. Fallback Procedural 3D Category Wireframe Silhouette */
        <div className="relative flex flex-col items-center justify-center gap-1.5 p-3 text-center z-10">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center border shadow-lg transition-transform duration-300 group-hover:scale-110"
            style={{
              backgroundColor: `${procedural.color}15`,
              borderColor: `${procedural.color}40`,
              boxShadow: `0 0 25px ${procedural.color}20`
            }}
          >
            {showPlaceholderIcon && (
              <span
                className="material-symbols-outlined text-2xl transition-all duration-300"
                style={{ color: procedural.color }}
              >
                {procedural.icon}
              </span>
            )}
          </div>
          <span
            className="font-mono text-[9px] font-bold tracking-widest uppercase mt-1"
            style={{ color: procedural.color }}
          >
            {procedural.label}
          </span>
        </div>
      )}

      {/* Format Badge (e.g. "3D GLB") */}
      {activeBadgeText && (
        <div className="absolute top-2 left-2 z-10 pointer-events-none">
          <div className="px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md border border-white/10 text-cyan-300 font-mono text-[9px] font-bold tracking-wider flex items-center gap-1 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>{activeBadgeText}</span>
          </div>
        </div>
      )}
    </div>
  );
}
