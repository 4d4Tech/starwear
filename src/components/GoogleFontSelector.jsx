/* eslint-disable react/prop-types */
import { useState, useEffect, useMemo } from 'react';
import {
  BUILTIN_FONTS,
  CURATED_GOOGLE_FONTS,
  GOOGLE_FONT_WEIGHT_LABELS,
  buildGoogleFontId,
  buildDeterministicFontsourceTTFUrl,
  parseGoogleFontSpec,
  formatFontDisplayName,
  loadGoogleFontStylesheet,
  fetchGoogleFontsCatalog,
  resolveGoogleFontTTFUrl,
  loadTypefaceFont,
  getGoogleFontsApiKey,
  setGoogleFontsApiKey
} from '../utils/text3DHelper';

const CATEGORY_TABS = [
  { id: 'featured', label: 'Featured 3D' },
  { id: 'all', label: 'All Google' },
  { id: 'scifi', label: 'Sci-Fi' },
  { id: 'display', label: 'Display' },
  { id: 'sans-serif', label: 'Sans' },
  { id: 'serif', label: 'Serif' },
  { id: 'handwriting', label: 'Script' },
  { id: 'monospace', label: 'Mono' },
  { id: 'builtin', label: 'Built-in' }
];

export default function GoogleFontSelector({
  value = 'helvetiker_bold',
  textConfig = null,
  previewText = 'STAR weAR',
  onChange,
  compact = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('featured');
  const [visibleLimit, setVisibleLimit] = useState(32);

  const [googleCatalog, setGoogleCatalog] = useState(() =>
    CURATED_GOOGLE_FONTS.map((gf, idx) => ({
      family: gf.family,
      category: gf.category,
      googleCategory: gf.category === 'scifi' ? 'display' : gf.category,
      weights: gf.weights,
      defaultWeight: gf.defaultWeight,
      curated: true,
      curatedRank: idx
    }))
  );
  const [catalogSource, setCatalogSource] = useState('curated_fallback');
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [loadingFontId, setLoadingFontId] = useState(null);
  const [fontLoadError, setFontLoadError] = useState('');

  // Optional Google Fonts Developer API Key panel
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState(() => getGoogleFontsApiKey());

  const activeSpec = useMemo(
    () => parseGoogleFontSpec(value, textConfig),
    [value, textConfig]
  );

  // Load 2D stylesheet for active Google Font so preview banner renders accurately
  useEffect(() => {
    if (activeSpec.isGoogle && activeSpec.family) {
      const weightNum = activeSpec.variant.replace('italic', '') || '400';
      loadGoogleFontStylesheet(activeSpec.family, ['400', weightNum]);
    }
  }, [activeSpec.isGoogle, activeSpec.family, activeSpec.variant]);

  // Fetch full 1,980+ Google Fonts catalog when browser opens (or if searching)
  useEffect(() => {
    if (!isOpen && catalogSource !== 'curated_fallback') return;
    if (!isOpen && !activeSpec.isGoogle) return;

    let cancelled = false;
    setCatalogLoading(true);
    fetchGoogleFontsCatalog()
      .then((res) => {
        if (cancelled) return;
        if (Array.isArray(res?.fonts) && res.fonts.length > 0) {
          setGoogleCatalog(res.fonts);
          setCatalogSource(res.source || 'keyless_catalog');
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, activeSpec.isGoogle, catalogSource]);

  // Reset pagination slice when search or category changes
  useEffect(() => {
    setVisibleLimit(32);
  }, [searchQuery, activeCategory]);

  // Find available weights for the currently selected Google Font
  const activeGoogleEntry = useMemo(() => {
    if (!activeSpec.isGoogle) return null;
    const lower = activeSpec.family.toLowerCase();
    return (
      googleCatalog.find((f) => f.family.toLowerCase() === lower) ||
      CURATED_GOOGLE_FONTS.find((f) => f.family.toLowerCase() === lower) || {
        family: activeSpec.family,
        weights: ['400', '700'],
        defaultWeight: activeSpec.variant || '700'
      }
    );
  }, [activeSpec, googleCatalog]);

  // Combined & filtered font list
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const results = [];

    // Include built-in 3D fonts when appropriate
    if (activeCategory === 'builtin' || activeCategory === 'featured' || (activeCategory === 'all' && q)) {
      BUILTIN_FONTS.forEach((bf) => {
        if (!q || bf.name.toLowerCase().includes(q) || bf.id.toLowerCase().includes(q)) {
          results.push({
            key: `builtin:${bf.id}`,
            isGoogle: false,
            id: bf.id,
            displayName: bf.name.replace(/\s*\(.*\)$/, ''),
            subtitle: bf.name.match(/\((.*)\)/)?.[1] || 'Built-in 3D JSON',
            category: 'builtin'
          });
        }
      });
    }

    if (activeCategory !== 'builtin') {
      for (const gf of googleCatalog) {
        if (q) {
          if (!gf.family.toLowerCase().includes(q)) continue;
        } else {
          if (activeCategory === 'featured' && !gf.curated) continue;
          if (
            activeCategory !== 'featured' &&
            activeCategory !== 'all' &&
            gf.category !== activeCategory &&
            gf.googleCategory !== activeCategory
          ) {
            continue;
          }
        }

        results.push({
          key: `gf:${gf.family}`,
          isGoogle: true,
          family: gf.family,
          defaultWeight: gf.defaultWeight || '700',
          weights: gf.weights || ['400'],
          slug: gf.slug,
          defSubset: gf.defSubset,
          category: gf.category || gf.googleCategory || 'sans-serif',
          curated: Boolean(gf.curated)
        });
      }
    }

    // If user typed an exact search query, rank prefix matches first
    if (q) {
      results.sort((a, b) => {
        const nameA = (a.isGoogle ? a.family : a.displayName).toLowerCase();
        const nameB = (b.isGoogle ? b.family : b.displayName).toLowerCase();
        const startsA = nameA.startsWith(q);
        const startsB = nameB.startsWith(q);
        if (startsA !== startsB) return startsA ? -1 : 1;
        if (Boolean(a.curated) !== Boolean(b.curated)) return a.curated ? -1 : 1;
        return nameA.localeCompare(nameB);
      });
    }

    return results;
  }, [googleCatalog, searchQuery, activeCategory]);

  const visibleItems = useMemo(
    () => filteredItems.slice(0, visibleLimit),
    [filteredItems, visibleLimit]
  );

  // Inject CSS stylesheets ONLY for currently visible Google Font items when dropdown is open
  useEffect(() => {
    if (!isOpen) return;
    visibleItems.forEach((item) => {
      if (item.isGoogle) {
        loadGoogleFontStylesheet(item.family, [item.defaultWeight || '400']);
      }
    });
  }, [isOpen, visibleItems]);

  const handleSelectBuiltin = (builtinId) => {
    setFontLoadError('');
    if (typeof onChange === 'function') {
      onChange({
        fontFamily: builtinId,
        fontUrl: undefined,
        googleFontFamily: undefined,
        googleFontVariant: undefined
      });
    }
  };

  const handleSelectGoogleFont = async (family, variant = '700', meta = {}) => {
    const normVariant = String(variant || '700');
    const nextFontId = buildGoogleFontId(family, normVariant);
    const optimisticUrl = buildDeterministicFontsourceTTFUrl(
      family,
      normVariant,
      meta.defSubset || 'latin'
    );

    setFontLoadError('');
    setLoadingFontId(nextFontId);
    loadGoogleFontStylesheet(family, ['400', normVariant.replace('italic', '') || '400']);

    try {
      const resolvedTtfUrl = await resolveGoogleFontTTFUrl(family, normVariant, {
        slug: meta.slug,
        defSubset: meta.defSubset
      });
      const finalUrl = resolvedTtfUrl || optimisticUrl;

      // Pre-parse and warm 3D font cache so scene extrudes immediately
      await loadTypefaceFont(nextFontId, {
        fontFamily: nextFontId,
        fontUrl: finalUrl,
        googleFontFamily: family,
        googleFontVariant: normVariant
      });

      if (typeof onChange === 'function') {
        onChange({
          fontFamily: nextFontId,
          fontUrl: finalUrl,
          googleFontFamily: family,
          googleFontVariant: normVariant
        });
      }
    } catch (err) {
      console.warn('[GoogleFontSelector] Error loading 3D outlines for font:', family, err);
      setFontLoadError(`Could not extrude "${family}". Try another weight or font.`);
      // Still emit font selection with fallback URL
      if (typeof onChange === 'function') {
        onChange({
          fontFamily: nextFontId,
          fontUrl: optimisticUrl,
          googleFontFamily: family,
          googleFontVariant: normVariant
        });
      }
    } finally {
      setLoadingFontId(null);
    }
  };

  const handleSaveApiKey = async () => {
    setGoogleFontsApiKey(apiKeyDraft);
    setCatalogLoading(true);
    try {
      const res = await fetchGoogleFontsCatalog({ apiKey: apiKeyDraft, forceRefresh: true });
      if (Array.isArray(res?.fonts) && res.fonts.length > 0) {
        setGoogleCatalog(res.fonts);
        setCatalogSource(res.source || 'keyless_catalog');
      }
      setShowApiKeyInput(false);
    } finally {
      setCatalogLoading(false);
    }
  };

  const samplePreview = (previewText || 'STAR weAR').trim().slice(0, 26) || 'STAR weAR';
  const activeWeightNum = activeSpec.isGoogle
    ? Number(activeSpec.variant.replace('italic', '')) || 700
    : 700;

  return (
    <div className="space-y-2">
      {/* Selected Font Trigger Card */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full text-left rounded-xl border transition-all ${
          compact ? 'px-2.5 py-2' : 'px-3 py-2.5'
        } ${
          isOpen
            ? 'bg-neutral-900 border-pink-500/70 ring-1 ring-pink-500/30'
            : 'bg-neutral-900/90 border-neutral-700/90 hover:border-pink-500/50'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-white truncate">
                {formatFontDisplayName(value, textConfig)}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                  activeSpec.isGoogle
                    ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                    : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                }`}
              >
                {activeSpec.isGoogle ? 'Google Font' : 'Built-in'}
              </span>
              {loadingFontId && (
                <span className="text-[10px] text-pink-400 animate-pulse font-medium">
                  Extruding...
                </span>
              )}
            </div>
            <div
              className="text-sm text-neutral-200 truncate mt-1 leading-snug"
              style={
                activeSpec.isGoogle
                  ? {
                      fontFamily: `"${activeSpec.family}", sans-serif`,
                      fontWeight: activeWeightNum
                    }
                  : undefined
              }
            >
              {samplePreview}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 text-neutral-400">
            <span className="text-[10px] font-semibold text-pink-400 hidden sm:inline">
              {isOpen ? 'Close' : 'Browse'}
            </span>
            <span className="material-symbols-outlined text-base">
              {isOpen ? 'expand_less' : 'expand_more'}
            </span>
          </div>
        </div>
      </button>

      {/* Weight / Variant Quick Pills for Multi-Weight Google Fonts */}
      {activeSpec.isGoogle && activeGoogleEntry?.weights?.length > 1 && (
        <div className="flex items-center gap-1 flex-wrap px-0.5">
          <span className="text-[10px] text-neutral-400 mr-1">Weight:</span>
          {activeGoogleEntry.weights.map((w) => {
            const wStr = String(w);
            const isSelected = activeSpec.variant === wStr;
            return (
              <button
                key={wStr}
                type="button"
                onClick={() => handleSelectGoogleFont(activeSpec.family, wStr, activeGoogleEntry)}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                  isSelected
                    ? 'bg-pink-600 text-white shadow'
                    : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:text-white hover:border-neutral-700'
                }`}
              >
                {GOOGLE_FONT_WEIGHT_LABELS[wStr] ? `${wStr} ${GOOGLE_FONT_WEIGHT_LABELS[wStr]}` : wStr}
              </button>
            );
          })}
        </div>
      )}

      {fontLoadError && (
        <p className="text-[10px] text-amber-400 px-1">{fontLoadError}</p>
      )}

      {/* Expandable Searchable Google Fonts Picker */}
      {isOpen && (
        <div className="rounded-xl bg-neutral-950 border border-neutral-800 p-2.5 space-y-2.5 shadow-2xl">
          {/* Search Bar + API Key Toggle */}
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <span className="material-symbols-outlined text-sm text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value.trim() && activeCategory === 'featured') {
                    setActiveCategory('all');
                  }
                }}
                placeholder={`Search ${googleCatalog.length.toLocaleString()}+ Google Fonts...`}
                className="w-full pl-8 pr-7 py-1.5 bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-pink-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                  title="Clear search"
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowApiKeyInput((prev) => !prev)}
              title="Google Fonts Developer API Key Settings (Optional)"
              className={`p-1.5 rounded-lg border text-xs flex items-center justify-center transition-colors ${
                catalogSource === 'google_api'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
              }`}
            >
              <span className="material-symbols-outlined text-sm">key</span>
            </button>
          </div>

          {/* Optional Google Fonts Developer API v1 Key Configuration */}
          {showApiKeyInput && (
            <div className="p-2 rounded-lg bg-neutral-900/90 border border-neutral-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-wider">
                  Google Fonts Developer API Key (Optional)
                </span>
                <span className="text-[9px] text-emerald-400 font-mono">
                  {catalogSource === 'google_api' ? 'Official API v1 Active' : 'Zero-Key Mode Active'}
                </span>
              </div>
              <p className="text-[10px] text-neutral-400 leading-relaxed">
                All {googleCatalog.length.toLocaleString()}+ Google Fonts work automatically without a key. Add a{' '}
                <code className="text-pink-300">googleapis.com/webfonts/v1</code> key (or set{' '}
                <code className="text-pink-300">VITE_GOOGLE_FONTS_API_KEY</code>) to sort by live Google popularity.
              </p>
              <div className="flex items-center gap-1.5">
                <input
                  type="password"
                  value={apiKeyDraft}
                  onChange={(e) => setApiKeyDraft(e.target.value)}
                  placeholder="AIzaSy..."
                  className="flex-1 px-2 py-1 bg-black border border-neutral-700 rounded text-[11px] text-white font-mono focus:outline-none focus:border-pink-500"
                />
                <button
                  type="button"
                  onClick={handleSaveApiKey}
                  className="px-2.5 py-1 rounded bg-pink-600 hover:bg-pink-500 text-white text-[10px] font-bold"
                >
                  Apply
                </button>
              </div>
            </div>
          )}

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
            {CATEGORY_TABS.map((cat) => {
              const isAct = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-2 py-1 rounded-md text-[10px] font-semibold whitespace-nowrap transition-all ${
                    isAct
                      ? 'bg-pink-600 text-white shadow'
                      : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800/80'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Font Results Grid / List */}
          <div
            className={`overflow-y-auto space-y-1 pr-1 ${
              compact ? 'max-h-56' : 'max-h-64'
            }`}
          >
            {catalogLoading && filteredItems.length === 0 ? (
              <div className="py-6 text-center text-xs text-neutral-400 animate-pulse">
                Loading Google Fonts catalog...
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="py-5 text-center space-y-2">
                <p className="text-xs text-neutral-400">
                  No catalog match for &ldquo;{searchQuery}&rdquo;.
                </p>
                {searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => handleSelectGoogleFont(searchQuery.trim(), '700')}
                    className="px-3 py-1.5 rounded-lg bg-pink-600/20 border border-pink-500/40 text-pink-300 hover:bg-pink-600/30 text-[11px] font-semibold"
                  >
                    Try loading &ldquo;{searchQuery.trim()}&rdquo; from Google Fonts
                  </button>
                )}
              </div>
            ) : (
              visibleItems.map((item) => {
                const isSelected = item.isGoogle
                  ? activeSpec.isGoogle &&
                    activeSpec.family.toLowerCase() === item.family.toLowerCase()
                  : !activeSpec.isGoogle && activeSpec.id === item.id;

                const targetId = item.isGoogle
                  ? buildGoogleFontId(item.family, item.defaultWeight)
                  : item.id;
                const isThisLoading = loadingFontId === targetId;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      if (item.isGoogle) {
                        handleSelectGoogleFont(item.family, item.defaultWeight, item);
                      } else {
                        handleSelectBuiltin(item.id);
                      }
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'bg-pink-600/15 border-pink-500/60 text-white'
                        : 'bg-neutral-900/60 border-neutral-800/80 hover:border-neutral-700 hover:bg-neutral-900 text-neutral-200'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-neutral-300 truncate">
                          {item.isGoogle ? item.family : item.displayName}
                        </span>
                        {item.curated && (
                          <span className="text-[8px] px-1 py-0.2 rounded bg-pink-500/15 text-pink-300 uppercase font-bold">
                            3D Pick
                          </span>
                        )}
                        <span className="text-[9px] text-neutral-500 capitalize">
                          {item.category}
                        </span>
                      </div>
                      <div
                        className="text-sm text-white truncate mt-0.5"
                        style={
                          item.isGoogle
                            ? {
                                fontFamily: `"${item.family}", sans-serif`,
                                fontWeight: Number(item.defaultWeight) || 400
                              }
                            : undefined
                        }
                      >
                        {samplePreview}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      {item.isGoogle && item.weights?.length > 1 && (
                        <span className="text-[9px] text-neutral-500 font-mono">
                          {item.weights.length}w
                        </span>
                      )}
                      {isThisLoading ? (
                        <span className="text-[10px] text-pink-400 font-semibold animate-pulse">
                          ...
                        </span>
                      ) : isSelected ? (
                        <span className="material-symbols-outlined text-sm text-pink-400">
                          check_circle
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })
            )}

            {filteredItems.length > visibleLimit && (
              <button
                type="button"
                onClick={() => setVisibleLimit((prev) => prev + 40)}
                className="w-full py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[11px] font-semibold text-pink-400 transition-colors"
              >
                Show More Fonts ({filteredItems.length - visibleLimit} remaining)
              </button>
            )}
          </div>

          {/* Footer info */}
          <div className="flex items-center justify-between pt-1 border-t border-neutral-900 text-[10px] text-neutral-500">
            <span>
              {filteredItems.length.toLocaleString()} {filteredItems.length === 1 ? 'font' : 'fonts'} available
            </span>
            <span>
              {catalogSource === 'google_api'
                ? 'Google Fonts API v1 (Live TTF)'
                : `Google Fonts Library (${googleCatalog.length.toLocaleString()} TTF)`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
