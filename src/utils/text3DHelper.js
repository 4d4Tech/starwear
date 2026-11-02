import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TTFLoader } from 'three/examples/jsm/loaders/TTFLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hasNaNPositions } from './inflationEngine.js';

export const GOOGLE_FONTS_API_KEY_STORAGE_KEY = 'starwear_google_fonts_api_key';

export const GOOGLE_FONT_WEIGHT_LABELS = {
  '100': 'Thin',
  '200': 'ExtraLight',
  '300': 'Light',
  '400': 'Regular',
  'regular': 'Regular',
  '500': 'Medium',
  '600': 'SemiBold',
  '700': 'Bold',
  '800': 'ExtraBold',
  '900': 'Black'
};

export const BUILTIN_FONTS = [
  { id: 'helvetiker_bold', name: 'Helvetiker Bold (Modern)', category: 'builtin', source: 'builtin', file: '/fonts/helvetiker_bold.typeface.json' },
  { id: 'helvetiker_regular', name: 'Helvetiker Regular', category: 'builtin', source: 'builtin', file: '/fonts/helvetiker_regular.typeface.json' },
  { id: 'optimer_bold', name: 'Optimer Bold (Geometric)', category: 'builtin', source: 'builtin', file: '/fonts/optimer_bold.typeface.json' },
  { id: 'optimer_regular', name: 'Optimer Regular', category: 'builtin', source: 'builtin', file: '/fonts/optimer_regular.typeface.json' },
  { id: 'gentilis_bold', name: 'Gentilis Bold (Chunky Display)', category: 'builtin', source: 'builtin', file: '/fonts/gentilis_bold.typeface.json' },
  { id: 'gentilis_regular', name: 'Gentilis Regular', category: 'builtin', source: 'builtin', file: '/fonts/gentilis_regular.typeface.json' }
];

/**
 * Curated top 3D-extrusion-friendly Google Fonts across key visual styles.
 * Every font below has verified CORS-enabled .ttf outlines for Three.js TTFLoader.
 */
export const CURATED_GOOGLE_FONTS = [
  // Sci-Fi & Cyber
  { family: 'Orbitron', category: 'scifi', defaultWeight: '700', weights: ['400', '500', '600', '700', '800', '900'] },
  { family: 'Audiowide', category: 'scifi', defaultWeight: '400', weights: ['400'] },
  { family: 'Rajdhani', category: 'scifi', defaultWeight: '700', weights: ['400', '500', '600', '700'] },
  { family: 'Michroma', category: 'scifi', defaultWeight: '400', weights: ['400'] },
  { family: 'Chakra Petch', category: 'scifi', defaultWeight: '700', weights: ['400', '500', '600', '700'] },
  { family: 'Exo 2', category: 'scifi', defaultWeight: '800', weights: ['400', '600', '700', '800', '900'] },
  { family: 'Syncopate', category: 'scifi', defaultWeight: '700', weights: ['400', '700'] },
  { family: 'Press Start 2P', category: 'scifi', defaultWeight: '400', weights: ['400'] },

  // Bold Display & Streetwear
  { family: 'Bebas Neue', category: 'display', defaultWeight: '400', weights: ['400'] },
  { family: 'Anton', category: 'display', defaultWeight: '400', weights: ['400'] },
  { family: 'Russo One', category: 'display', defaultWeight: '400', weights: ['400'] },
  { family: 'Righteous', category: 'display', defaultWeight: '400', weights: ['400'] },
  { family: 'Bungee', category: 'display', defaultWeight: '400', weights: ['400'] },
  { family: 'Black Ops One', category: 'display', defaultWeight: '400', weights: ['400'] },
  { family: 'Teko', category: 'display', defaultWeight: '700', weights: ['400', '500', '600', '700'] },
  { family: 'Unbounded', category: 'display', defaultWeight: '800', weights: ['400', '600', '700', '800', '900'] },
  { family: 'Syne', category: 'display', defaultWeight: '800', weights: ['400', '600', '700', '800'] },
  { family: 'Archivo Black', category: 'display', defaultWeight: '400', weights: ['400'] },
  { family: 'Bangers', category: 'display', defaultWeight: '400', weights: ['400'] },
  { family: 'Titan One', category: 'display', defaultWeight: '400', weights: ['400'] },

  // Modern Sans-Serif
  { family: 'Montserrat', category: 'sans-serif', defaultWeight: '800', weights: ['400', '500', '600', '700', '800', '900'] },
  { family: 'Poppins', category: 'sans-serif', defaultWeight: '700', weights: ['400', '500', '600', '700', '800', '900'] },
  { family: 'Oswald', category: 'sans-serif', defaultWeight: '700', weights: ['400', '500', '600', '700'] },
  { family: 'Space Grotesk', category: 'sans-serif', defaultWeight: '700', weights: ['400', '500', '600', '700'] },
  { family: 'Inter', category: 'sans-serif', defaultWeight: '800', weights: ['400', '600', '700', '800', '900'] },
  { family: 'Outfit', category: 'sans-serif', defaultWeight: '800', weights: ['400', '600', '700', '800', '900'] },
  { family: 'Raleway', category: 'sans-serif', defaultWeight: '800', weights: ['400', '600', '700', '800', '900'] },
  { family: 'Rubik', category: 'sans-serif', defaultWeight: '800', weights: ['400', '600', '700', '800', '900'] },

  // Luxury & Editorial Serif / Slab
  { family: 'Cinzel', category: 'serif', defaultWeight: '700', weights: ['400', '600', '700', '800', '900'] },
  { family: 'Playfair Display', category: 'serif', defaultWeight: '700', weights: ['400', '600', '700', '800', '900'] },
  { family: 'Cinzel Decorative', category: 'serif', defaultWeight: '700', weights: ['400', '700', '900'] },
  { family: 'Abril Fatface', category: 'serif', defaultWeight: '400', weights: ['400'] },
  { family: 'Cormorant Garamond', category: 'serif', defaultWeight: '700', weights: ['400', '600', '700'] },
  { family: 'Alfa Slab One', category: 'serif', defaultWeight: '400', weights: ['400'] },
  { family: 'DM Serif Display', category: 'serif', defaultWeight: '400', weights: ['400'] },

  // Script, Brush & Signature
  { family: 'Permanent Marker', category: 'handwriting', defaultWeight: '400', weights: ['400'] },
  { family: 'Pacifico', category: 'handwriting', defaultWeight: '400', weights: ['400'] },
  { family: 'Lobster', category: 'handwriting', defaultWeight: '400', weights: ['400'] },
  { family: 'Satisfy', category: 'handwriting', defaultWeight: '400', weights: ['400'] },
  { family: 'Dancing Script', category: 'handwriting', defaultWeight: '700', weights: ['400', '600', '700'] },
  { family: 'Creepster', category: 'handwriting', defaultWeight: '400', weights: ['400'] },

  // Monospace & Pixel
  { family: 'JetBrains Mono', category: 'monospace', defaultWeight: '700', weights: ['400', '600', '700', '800'] },
  { family: 'Space Mono', category: 'monospace', defaultWeight: '700', weights: ['400', '700'] },
  { family: 'Silkscreen', category: 'monospace', defaultWeight: '700', weights: ['400', '700'] }
];

export function normalizeGoogleVariant(variant = '700') {
  const raw = String(variant || '700').trim().toLowerCase();
  if (!raw || raw === 'regular' || raw === 'normal') return '400';
  if (raw === 'italic') return '400italic';
  return raw;
}

export function buildGoogleFontId(family, variant = '700') {
  const cleanFamily = String(family || 'Orbitron').trim();
  const cleanVariant = normalizeGoogleVariant(variant);
  return `gf:${cleanFamily}:${cleanVariant}`;
}

export function buildDeterministicFontsourceTTFUrl(family, variant = '700', subset = 'latin') {
  const slug = String(family || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
  const norm = normalizeGoogleVariant(variant);
  const isItalic = norm.endsWith('italic');
  const weight = norm.replace('italic', '') || '400';
  const style = isItalic ? 'italic' : 'normal';
  return `https://cdn.jsdelivr.net/fontsource/fonts/${slug}@latest/${subset}-${weight}-${style}.ttf`;
}

export const AVAILABLE_FONTS = [
  ...BUILTIN_FONTS,
  ...CURATED_GOOGLE_FONTS.map((gf) => {
    const id = buildGoogleFontId(gf.family, gf.defaultWeight);
    const weightLabel = GOOGLE_FONT_WEIGHT_LABELS[gf.defaultWeight] || gf.defaultWeight;
    return {
      id,
      name: `${gf.family}${gf.weights.length > 1 ? ` ${weightLabel}` : ''} (Google Font)`,
      family: gf.family,
      variant: gf.defaultWeight,
      weights: gf.weights,
      category: gf.category,
      source: 'google',
      file: buildDeterministicFontsourceTTFUrl(gf.family, gf.defaultWeight)
    };
  })
];

export const TEXT_MATERIAL_PRESETS = [
  { id: 'neon_cyan', name: 'Neon Cyber Cyan', color: '#38bdf8', emissive: '#0284c7', emissiveIntensity: 0.6, metalness: 0.8, roughness: 0.2 },
  { id: 'gold_metallic', name: '24K Polished Gold', color: '#f59e0b', emissive: '#78350f', emissiveIntensity: 0.2, metalness: 0.95, roughness: 0.15 },
  { id: 'obsidian_chrome', name: 'Obsidian Chrome', color: '#18181b', emissive: '#000000', emissiveIntensity: 0.0, metalness: 0.9, roughness: 0.1 },
  { id: 'crimson_glow', name: 'Crimson Glow', color: '#f43f5e', emissive: '#9f1239', emissiveIntensity: 0.7, metalness: 0.5, roughness: 0.3 },
  { id: 'emerald_matrix', name: 'Emerald Matrix', color: '#10b981', emissive: '#065f46', emissiveIntensity: 0.5, metalness: 0.7, roughness: 0.25 },
  { id: 'titanium_white', name: 'Titanium White', color: '#f8fafc', emissive: '#000000', emissiveIntensity: 0.0, metalness: 0.3, roughness: 0.3 }
];

const fontCache = new Map();
const fontInflightCache = new Map();
const injectedGoogleStylesheets = new Set();
const fontLoader = new FontLoader();
const ttfLoader = new TTFLoader();

let cachedGoogleCatalog = null;
let cachedGoogleCatalogSource = null;
let cachedGoogleCatalogPromise = null;
const googleApiFilesByFamily = new Map();

/**
 * Returns configured Google Fonts Developer API key from Vite env or localStorage.
 */
export function getGoogleFontsApiKey() {
  try {
    const envKey = typeof import.meta !== 'undefined' && import.meta.env
      ? (import.meta.env.VITE_GOOGLE_FONTS_API_KEY || '').trim()
      : '';
    if (envKey) return envKey;
  } catch {
    // ignore env access errors
  }
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return (window.localStorage.getItem(GOOGLE_FONTS_API_KEY_STORAGE_KEY) || '').trim();
    }
  } catch {
    // ignore storage errors
  }
  return '';
}

/**
 * Persists a user-supplied Google Fonts Developer API key in localStorage and invalidates catalog cache.
 */
export function setGoogleFontsApiKey(apiKey = '') {
  const trimmed = String(apiKey || '').trim();
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (trimmed) {
        window.localStorage.setItem(GOOGLE_FONTS_API_KEY_STORAGE_KEY, trimmed);
      } else {
        window.localStorage.removeItem(GOOGLE_FONTS_API_KEY_STORAGE_KEY);
      }
    }
  } catch {
    // ignore storage errors
  }
  cachedGoogleCatalog = null;
  cachedGoogleCatalogSource = null;
  cachedGoogleCatalogPromise = null;
}

/**
 * Parses a fontFamily string + optional text item config into either a builtin font or a Google Font spec.
 */
export function parseGoogleFontSpec(fontId = 'helvetiker_bold', textConfig = null) {
  const raw = String(fontId || textConfig?.fontFamily || 'helvetiker_bold').trim();

  // 1. Check built-in local typeface JSONs first
  const builtin = BUILTIN_FONTS.find((f) => f.id === raw);
  if (builtin) {
    return {
      isGoogle: false,
      id: builtin.id,
      name: builtin.name,
      file: builtin.file
    };
  }

  // 2. Explicit gf:<Family>:<variant> or google:<Family>:<variant>
  if (raw.startsWith('gf:') || raw.startsWith('google:') || raw.startsWith('gfont:')) {
    const parts = raw.split(':');
    const family = (parts[1] || textConfig?.googleFontFamily || 'Orbitron').trim();
    const variant = normalizeGoogleVariant(parts[2] || textConfig?.googleFontVariant || '700');
    return {
      isGoogle: true,
      id: buildGoogleFontId(family, variant),
      family,
      variant,
      fontUrl: textConfig?.fontUrl || null
    };
  }

  // 3. Explicit googleFontFamily on textConfig
  if (textConfig?.googleFontFamily) {
    const family = String(textConfig.googleFontFamily).trim();
    const variant = normalizeGoogleVariant(textConfig.googleFontVariant || '700');
    return {
      isGoogle: true,
      id: buildGoogleFontId(family, variant),
      family,
      variant,
      fontUrl: textConfig?.fontUrl || null
    };
  }

  // 4. Plain Google Font family name (e.g. "Orbitron", "Bebas Neue" from AI Scene API)
  const curatedMatch = CURATED_GOOGLE_FONTS.find(
    (gf) => gf.family.toLowerCase() === raw.toLowerCase()
  );
  if (curatedMatch) {
    return {
      isGoogle: true,
      id: buildGoogleFontId(curatedMatch.family, curatedMatch.defaultWeight),
      family: curatedMatch.family,
      variant: curatedMatch.defaultWeight,
      fontUrl: textConfig?.fontUrl || null
    };
  }

  // Legacy droid_* fallback to helvetiker
  if (raw.startsWith('droid_')) {
    const fallback = raw.includes('bold') ? BUILTIN_FONTS[0] : BUILTIN_FONTS[1];
    return {
      isGoogle: false,
      id: fallback.id,
      name: fallback.name,
      file: fallback.file
    };
  }

  // Any other non-empty font name without underscores: treat as a Google Font family name
  if (raw && !raw.includes('_')) {
    return {
      isGoogle: true,
      id: buildGoogleFontId(raw, '700'),
      family: raw,
      variant: '700',
      fontUrl: textConfig?.fontUrl || null
    };
  }

  return {
    isGoogle: false,
    id: BUILTIN_FONTS[0].id,
    name: BUILTIN_FONTS[0].name,
    file: BUILTIN_FONTS[0].file
  };
}

/**
 * Formats a human-readable display label for any built-in or Google Font identifier.
 */
export function formatFontDisplayName(fontId, textConfig = null) {
  const spec = parseGoogleFontSpec(fontId, textConfig);
  if (!spec.isGoogle) {
    const shortMap = {
      helvetiker_bold: 'Helvetiker Bold',
      helvetiker_regular: 'Helvetiker Regular',
      optimer_bold: 'Optimer Bold',
      optimer_regular: 'Optimer Regular',
      gentilis_bold: 'Gentilis Bold',
      gentilis_regular: 'Gentilis Regular'
    };
    return shortMap[spec.id] || spec.name || spec.id;
  }
  const weightNum = spec.variant.replace('italic', '') || '400';
  const isItalic = spec.variant.endsWith('italic');
  const weightLabel = GOOGLE_FONT_WEIGHT_LABELS[weightNum] || weightNum;
  return `${spec.family} ${weightLabel}${isItalic ? ' Italic' : ''}`.trim();
}

/**
 * Injects a Google Fonts CSS2 stylesheet <link> into document.head for crisp 2D UI previews.
 */
export function loadGoogleFontStylesheet(family, variants = ['400', '700']) {
  if (typeof document === 'undefined' || !family) return;
  const cleanFamily = String(family).trim();
  if (!cleanFamily) return;

  const normWeights = Array.from(
    new Set(
      (Array.isArray(variants) ? variants : [variants])
        .map((v) => String(v || '400').replace(/[^0-9]/g, '') || '400')
    )
  ).sort((a, b) => Number(a) - Number(b));

  const key = `${cleanFamily}::${normWeights.join(',')}`;
  if (injectedGoogleStylesheets.has(key)) return;
  injectedGoogleStylesheets.add(key);

  const encodedFamily = encodeURIComponent(cleanFamily).replace(/%20/g, '+');
  const weightAxis = normWeights.length > 0 ? `:wght@${normWeights.join(';')}` : '';
  const href = `https://fonts.googleapis.com/css2?family=${encodedFamily}${weightAxis}&display=swap`;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.starwearGfont = key;
  document.head.appendChild(link);
}

/**
 * Fetches the full searchable Google Fonts catalog (1,500–1,980+ fonts).
 * - Uses official Google Fonts Developer API v1 (`webfonts/v1/webfonts?sort=popularity`) when an API key is configured.
 * - Automatically falls back to the keyless CORS Google Fonts catalog (`api.fontsource.org/v1/fonts?type=google`) + curated presets.
 */
export async function fetchGoogleFontsCatalog({ apiKey, forceRefresh = false } = {}) {
  const resolvedKey = (apiKey !== undefined ? String(apiKey).trim() : getGoogleFontsApiKey());
  const desiredSource = resolvedKey ? `google_api:${resolvedKey.slice(0, 8)}` : 'keyless_catalog';

  if (!forceRefresh && cachedGoogleCatalog && cachedGoogleCatalogSource === desiredSource) {
    return { fonts: cachedGoogleCatalog, source: resolvedKey ? 'google_api' : 'keyless_catalog' };
  }

  if (!forceRefresh && cachedGoogleCatalogPromise && cachedGoogleCatalogSource === desiredSource) {
    return cachedGoogleCatalogPromise;
  }

  cachedGoogleCatalogSource = desiredSource;

  cachedGoogleCatalogPromise = (async () => {
    const curatedMap = new Map(
      CURATED_GOOGLE_FONTS.map((c, idx) => [c.family.toLowerCase(), { ...c, curatedRank: idx }])
    );

    // Path A: Official Google Fonts Developer API v1 (when API key is provided)
    if (resolvedKey) {
      try {
        const url = `https://www.googleapis.com/webfonts/v1/webfonts?key=${encodeURIComponent(resolvedKey)}&sort=popularity`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Google Fonts API HTTP ${res.status}`);
        }
        const data = await res.json();
        if (Array.isArray(data.items) && data.items.length > 0) {
          const normalized = data.items.map((item, idx) => {
            const curated = curatedMap.get(item.family.toLowerCase());
            const filesMap = item.files || {};
            googleApiFilesByFamily.set(item.family.toLowerCase(), filesMap);

            const weights = (item.variants || ['regular'])
              .filter((v) => !String(v).includes('italic'))
              .map((v) => normalizeGoogleVariant(v));
            const uniqueWeights = weights.length > 0 ? Array.from(new Set(weights)) : ['400'];
            const defaultWeight = curated?.defaultWeight && uniqueWeights.includes(curated.defaultWeight)
              ? curated.defaultWeight
              : (uniqueWeights.includes('700') ? '700' : uniqueWeights[0]);

            return {
              family: item.family,
              category: curated?.category || item.category || 'sans-serif',
              googleCategory: item.category || 'sans-serif',
              weights: uniqueWeights,
              variants: (item.variants || ['regular']).map(normalizeGoogleVariant),
              defaultWeight,
              files: filesMap,
              curated: Boolean(curated),
              popularityRank: idx
            };
          });

          cachedGoogleCatalog = normalized;
          return { fonts: normalized, source: 'google_api' };
        }
      } catch (err) {
        console.warn('[text3DHelper] Google Fonts Developer API v1 request failed, falling back to keyless Google Fonts catalog:', err);
      }
    }

    // Path B: Keyless CORS Google Fonts Catalog (Fontsource Google Fonts Mirror - 1,980+ Google Fonts)
    try {
      const res = await fetch('https://api.fontsource.org/v1/fonts?type=google');
      if (!res.ok) throw new Error(`Fontsource catalog HTTP ${res.status}`);
      const items = await res.json();
      if (Array.isArray(items) && items.length > 0) {
        const mapped = items.map((item, idx) => {
          const curated = curatedMap.get(item.family.toLowerCase());
          const uniqueWeights = Array.isArray(item.weights) && item.weights.length > 0
            ? item.weights.map((w) => String(w))
            : ['400'];
          const defaultWeight = curated?.defaultWeight && uniqueWeights.includes(curated.defaultWeight)
            ? curated.defaultWeight
            : (uniqueWeights.includes('700') ? '700' : uniqueWeights[0]);

          return {
            family: item.family,
            slug: item.id,
            defSubset: item.defSubset || 'latin',
            category: curated?.category || item.category || 'sans-serif',
            googleCategory: item.category || 'sans-serif',
            weights: uniqueWeights,
            variants: uniqueWeights,
            defaultWeight,
            curated: Boolean(curated),
            curatedRank: curated ? curated.curatedRank : 9999,
            popularityRank: idx
          };
        });

        // Sort curated 3D fonts first, then alphabetically / catalog order
        mapped.sort((a, b) => {
          if (a.curated !== b.curated) return a.curated ? -1 : 1;
          if (a.curated && b.curated) return a.curatedRank - b.curatedRank;
          return a.family.localeCompare(b.family);
        });

        cachedGoogleCatalog = mapped;
        return { fonts: mapped, source: 'keyless_catalog' };
      }
    } catch (err) {
      console.warn('[text3DHelper] Keyless full catalog fetch failed, using built-in curated Google Fonts:', err);
    }

    // Path C: Offline / Resilient Curated Fallback (44 Google Fonts)
    const fallbackFonts = CURATED_GOOGLE_FONTS.map((gf, idx) => ({
      family: gf.family,
      category: gf.category,
      googleCategory: gf.category === 'scifi' ? 'display' : gf.category,
      weights: gf.weights,
      variants: gf.weights,
      defaultWeight: gf.defaultWeight,
      curated: true,
      curatedRank: idx,
      popularityRank: idx
    }));
    cachedGoogleCatalog = fallbackFonts;
    return { fonts: fallbackFonts, source: 'curated_fallback' };
  })();

  return cachedGoogleCatalogPromise;
}

/**
 * Resolves a direct CORS-enabled .ttf URL for any Google Font family & weight/variant.
 */
export async function resolveGoogleFontTTFUrl(family, variant = '700', options = {}) {
  const cleanFamily = String(family || 'Orbitron').trim();
  const normVariant = normalizeGoogleVariant(variant);
  const rawApiVariant = normVariant === '400' ? 'regular' : (normVariant === '400italic' ? 'italic' : normVariant);

  // 1. If explicit cached files map from Google Fonts Developer API v1 is already loaded, use direct fonts.gstatic.com TTF
  const lowerFam = cleanFamily.toLowerCase();
  const knownFiles = googleApiFilesByFamily.get(lowerFam);
  if (knownFiles) {
    const directUrl = knownFiles[rawApiVariant] || knownFiles[normVariant] || knownFiles.regular || Object.values(knownFiles)[0];
    if (directUrl) return directUrl.replace(/^http:/, 'https:');
  }

  // 2. If a Google Fonts Developer API key is configured, query single-family metadata from official API
  const apiKey = options.apiKey !== undefined ? String(options.apiKey).trim() : getGoogleFontsApiKey();
  if (apiKey) {
    try {
      const apiUrl = `https://www.googleapis.com/webfonts/v1/webfonts?key=${encodeURIComponent(apiKey)}&family=${encodeURIComponent(cleanFamily)}`;
      const res = await fetch(apiUrl);
      if (res.ok) {
        const data = await res.json();
        const item = data?.items?.[0];
        if (item?.files) {
          googleApiFilesByFamily.set(lowerFam, item.files);
          const directUrl = item.files[rawApiVariant] || item.files[normVariant] || item.files.regular || Object.values(item.files)[0];
          if (directUrl) return directUrl.replace(/^http:/, 'https:');
        }
      }
    } catch {
      // Fall through to CDN TTF resolution
    }
  }

  // 3. Deterministic jsDelivr Fontsource Google Font TTF URL (fast single-hop CDN)
  const subset = options.defSubset || 'latin';
  const deterministicUrl = buildDeterministicFontsourceTTFUrl(cleanFamily, normVariant, subset);
  try {
    const headRes = await fetch(deterministicUrl, { method: 'HEAD' });
    if (headRes.ok) {
      return deterministicUrl;
    }
  } catch {
    // Fall through to metadata lookup
  }

  // 4. Query Fontsource per-font metadata endpoint to pick exact available weight/subset TTF
  const slug = (options.slug || cleanFamily).toLowerCase().trim().replace(/\s+/g, '-');
  try {
    const metaRes = await fetch(`https://api.fontsource.org/v1/fonts/${encodeURIComponent(slug)}`);
    if (metaRes.ok) {
      const meta = await metaRes.json();
      const variantsObj = meta?.variants || {};
      const desiredWeight = normVariant.replace('italic', '') || '400';
      const desiredStyle = normVariant.endsWith('italic') ? 'italic' : 'normal';
      const weightEntry =
        variantsObj[desiredWeight] ||
        variantsObj['700'] ||
        variantsObj['400'] ||
        Object.values(variantsObj)[0];
      const styleEntry = weightEntry?.[desiredStyle] || weightEntry?.normal || Object.values(weightEntry || {})[0];
      const subsetEntry =
        styleEntry?.latin ||
        (meta.defSubset && styleEntry?.[meta.defSubset]) ||
        Object.values(styleEntry || {})[0];
      const resolvedTtf = subsetEntry?.url?.ttf || subsetEntry?.url?.woff;
      if (resolvedTtf) return resolvedTtf;
    }
  } catch (err) {
    console.warn(`[text3DHelper] Metadata lookup failed for Google Font "${cleanFamily}":`, err);
  }

  return deterministicUrl;
}

/**
 * Loads a typeface JSON font OR Google Font (.ttf / .woff via Three.js TTFLoader) and caches it.
 * @param {string} fontId - Built-in ID (e.g. 'helvetiker_bold') or Google Font ID (e.g. 'gf:Orbitron:700')
 * @param {object} [textConfig] - Optional text item object containing cached `fontUrl`, `googleFontFamily`, etc.
 * @returns {Promise<THREE.Font>}
 */
export async function loadTypefaceFont(fontId = 'helvetiker_bold', textConfig = null) {
  const spec = parseGoogleFontSpec(fontId, textConfig);
  const cacheKey = spec.isGoogle
    ? `${spec.id}::${spec.fontUrl || 'auto'}`
    : spec.id;

  if (fontCache.has(cacheKey)) {
    return fontCache.get(cacheKey);
  }
  if (spec.isGoogle && fontCache.has(spec.id)) {
    return fontCache.get(spec.id);
  }
  if (fontInflightCache.has(cacheKey)) {
    return fontInflightCache.get(cacheKey);
  }

  const loadPromise = (async () => {
    try {
      if (!spec.isGoogle) {
        const res = await fetch(spec.file);
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching font ${spec.file}`);
        const json = await res.json();
        const parsedFont = fontLoader.parse(json);
        fontCache.set(spec.id, parsedFont);
        return parsedFont;
      }

      // Google Font: try explicit fontUrl first (fast 1-request path), then resolveGoogleFontTTFUrl fallback
      const candidateUrls = [];
      if (spec.fontUrl && typeof spec.fontUrl === 'string') {
        candidateUrls.push(spec.fontUrl);
      }
      const resolvedUrl = await resolveGoogleFontTTFUrl(spec.family, spec.variant);
      if (resolvedUrl && !candidateUrls.includes(resolvedUrl)) {
        candidateUrls.push(resolvedUrl);
      }
      // Also add 400 regular deterministic fallback in case 700 didn't exist for a single-weight font
      const regularFallbackUrl = buildDeterministicFontsourceTTFUrl(spec.family, '400');
      if (!candidateUrls.includes(regularFallbackUrl)) {
        candidateUrls.push(regularFallbackUrl);
      }

      let lastErr = null;
      for (const url of candidateUrls) {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status} fetching Google Font TTF ${url}`);
          const buffer = await res.arrayBuffer();
          const typefaceJson = ttfLoader.parse(buffer);
          const parsedFont = fontLoader.parse(typefaceJson);
          fontCache.set(cacheKey, parsedFont);
          fontCache.set(spec.id, parsedFont);
          return parsedFont;
        } catch (err) {
          lastErr = err;
        }
      }
      throw lastErr || new Error(`Could not load Google Font "${spec.family}"`);
    } catch (err) {
      console.warn(`[text3DHelper] Failed to load font "${fontId}":`, err);
      // Graceful fallback to default helvetiker_bold so 3D text always renders
      if (spec.id !== 'helvetiker_bold') {
        if (fontCache.has('helvetiker_bold')) {
          return fontCache.get('helvetiker_bold');
        }
        try {
          const fallbackRes = await fetch(BUILTIN_FONTS[0].file);
          if (fallbackRes.ok) {
            const fallbackJson = await fallbackRes.json();
            const fallbackFont = fontLoader.parse(fallbackJson);
            fontCache.set('helvetiker_bold', fallbackFont);
            return fallbackFont;
          }
        } catch {
          // ignore secondary fallback error
        }
      }
      throw err;
    } finally {
      fontInflightCache.delete(cacheKey);
    }
  })();

  fontInflightCache.set(cacheKey, loadPromise);
  return loadPromise;
}

/**
 * Creates an extruded 3D Text Geometry, with native support for:
 * 1. Straight text layouts (left/center/right alignment)
 * 2. Curved & Arched path typography (curveRadius, startAngle, endAngle, letterSpacing)
 */
export function create3DTextGeometry(text, options = {}, font, THREE_LIB = THREE) {
  const size = Math.max(0.01, Number(options.size) || 0.35);
  const depth = Math.max(0.005, Number(options.depth) || 0.08);
  const curveSegments = Math.max(1, Number(options.curveSegments) || 12);
  const bevelEnabled = options.bevelEnabled !== false;
  const bevelThickness = Math.max(0, Number(options.bevelThickness) || 0.015);
  const bevelSize = Math.max(0, Math.min(Number(options.bevelSize) || 0.01, size * 0.25));
  const bevelSegments = Math.max(1, Number(options.bevelSegments) || 4);

  const curveRadius = options.curveRadius !== undefined && options.curveRadius !== null ? Number(options.curveRadius) : 0;
  const str = String(text || 'STAR weAR');

  // If curveRadius is specified and non-zero: Generate arched/curved path typography
  if (curveRadius !== 0 && !isNaN(curveRadius) && str.length > 0) {
    const chars = Array.from(str);
    const n = chars.length;
    const R = Math.abs(curveRadius);
    const letterSpacing = Number(options.letterSpacing) || 0;

    let startRad, endRad;
    const hasAngleSpan = options.startAngle !== undefined && options.endAngle !== undefined &&
      (Number(options.startAngle) !== 0 || Number(options.endAngle) !== 0);

    if (hasAngleSpan) {
      startRad = (Number(options.startAngle) * Math.PI) / 180;
      endRad = (Number(options.endAngle) * Math.PI) / 180;
    } else {
      // Calculate angular span based on font size and character count
      const approxCharWidth = size * 0.65 + letterSpacing;
      const totalSpan = Math.min(Math.PI * 1.8, Math.max(0.1, (n - 1) * (approxCharWidth / R)));
      startRad = -totalSpan / 2;
      endRad = totalSpan / 2;
    }

    const charGeoms = [];
    for (let i = 0; i < n; i++) {
      const char = chars[i];
      const theta = n === 1 ? (startRad + endRad) / 2 : startRad + (i / (n - 1)) * (endRad - startRad);

      if (char.trim() === '') {
        continue;
      }

      let charGeom = null;
      try {
        charGeom = new TextGeometry(char, {
          font: font,
          size: size,
          depth: depth,
          curveSegments: curveSegments,
          bevelEnabled: bevelEnabled,
          bevelThickness: bevelThickness,
          bevelSize: bevelSize,
          bevelOffset: 0,
          bevelSegments: bevelSegments
        });
        if (hasNaNPositions(charGeom)) {
          charGeom.dispose();
          charGeom = new TextGeometry(char, {
            font: font,
            size: size,
            depth: depth,
            curveSegments: curveSegments,
            bevelEnabled: false
          });
        }
      } catch (err) {
        console.warn(`[text3DHelper] Failed to generate character "${char}":`, err);
      }

      if (!charGeom || hasNaNPositions(charGeom)) {
        if (charGeom) charGeom.dispose();
        continue;
      }

      charGeom.center();

      let x, y, rotZ;
      if (curveRadius > 0) {
        // Positive curveRadius: Header rainbow arch (apex at y = 0)
        x = R * Math.sin(theta);
        y = R * (Math.cos(theta) - 1);
        rotZ = -theta;
      } else {
        // Negative curveRadius: Footer smile ribbon arch (trough at y = 0)
        x = R * Math.sin(theta);
        y = R * (1 - Math.cos(theta));
        rotZ = theta;
      }

      charGeom.rotateZ(rotZ);
      charGeom.translate(x, y, 0);
      charGeoms.push(charGeom);
    }

    if (charGeoms.length > 0) {
      try {
        const merged = mergeGeometries(charGeoms, false);
        charGeoms.forEach((g) => g.dispose());
        if (merged && !hasNaNPositions(merged)) {
          merged.computeBoundingBox();
          merged.computeVertexNormals();
          normalizeTextGeometryUVs(merged, THREE_LIB);
          return merged;
        }
      } catch (mergeErr) {
        console.warn('[text3DHelper] mergeGeometries fallback for curved text:', mergeErr);
      }
    }
  }

  // Standard straight line 3D TextGeometry
  let geom = null;
  try {
    geom = new TextGeometry(str, {
      font: font,
      size: size,
      depth: depth,
      curveSegments: curveSegments,
      bevelEnabled: bevelEnabled,
      bevelThickness: bevelThickness,
      bevelSize: bevelSize,
      bevelOffset: 0,
      bevelSegments: bevelSegments
    });
    if (hasNaNPositions(geom)) {
      if (geom) geom.dispose();
      geom = new TextGeometry(str, {
        font: font,
        size: size,
        depth: depth,
        curveSegments: curveSegments,
        bevelEnabled: false
      });
    }
  } catch (err) {
    console.warn('[text3DHelper] TextGeometry generation warning:', err);
  }

  if (!geom || hasNaNPositions(geom)) {
    if (geom) geom.dispose();
    geom = new THREE_LIB.BoxGeometry(size * 2, size, depth);
  }

  geom.computeBoundingBox();

  const align = options.align || 'center';
  if (align === 'center') {
    geom.center();
  } else if (align === 'right' && geom.boundingBox && isFinite(geom.boundingBox.min.x) && isFinite(geom.boundingBox.max.x)) {
    const width = geom.boundingBox.max.x - geom.boundingBox.min.x;
    geom.translate(-width, 0, 0);
  }

  normalizeTextGeometryUVs(geom, THREE_LIB);
  return geom;
}

function normalizeTextGeometryUVs(geom, THREE_LIB = THREE) {
  if (!geom || !geom.attributes?.position) return;
  try {
    geom.computeBoundingBox();
    const bb = geom.boundingBox;
    if (bb && isFinite(bb.min.x) && isFinite(bb.max.x) && isFinite(bb.min.y) && isFinite(bb.max.y)) {
      const rangeX = (bb.max.x - bb.min.x) || 1;
      const rangeY = (bb.max.y - bb.min.y) || 1;
      const pos = geom.attributes.position;
      const uvs = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) {
        uvs[i * 2] = (pos.getX(i) - bb.min.x) / rangeX;
        uvs[i * 2 + 1] = (pos.getY(i) - bb.min.y) / rangeY;
      }
      geom.setAttribute('uv', new THREE_LIB.BufferAttribute(uvs, 2));
    }
  } catch {
    // ignore UV generation fallback errors
  }
}

/**
 * Creates a complete 3D Text Mesh with standard PBR material.
 */
export function create3DTextMesh(config = {}, THREE_LIB = THREE, font) {
  if (!font) return null;

  const geom = create3DTextGeometry(config.text, config, font, THREE_LIB);

  const color = config.color || '#38bdf8';
  const roughness = config.roughness !== undefined ? Number(config.roughness) : 0.25;
  const metalness = config.metalness !== undefined ? Number(config.metalness) : 0.75;
  const emissive = config.emissive || '#000000';
  const emissiveIntensity = config.emissiveIntensity !== undefined ? Number(config.emissiveIntensity) : 0.0;
  const wireframe = Boolean(config.wireframe);

  const mat = new THREE_LIB.MeshStandardMaterial({
    color: new THREE_LIB.Color(color),
    roughness: roughness,
    metalness: metalness,
    emissive: new THREE_LIB.Color(emissive),
    emissiveIntensity: emissiveIntensity,
    wireframe: wireframe,
    side: THREE_LIB.DoubleSide
  });

  const mesh = new THREE_LIB.Mesh(geom, mat);
  mesh.name = config.name || `3D Text - ${config.text || 'STAR weAR'}`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  mesh.position.set(
    Number(config.posX ?? 0),
    Number(config.posY ?? 0.6),
    Number(config.posZ ?? 0)
  );
  mesh.rotation.set(
    ((Number(config.rotX ?? 0)) * Math.PI) / 180,
    ((Number(config.rotY ?? 0)) * Math.PI) / 180,
    ((Number(config.rotZ ?? 0)) * Math.PI) / 180
  );

  const scale = Number(config.scale ?? 1);
  const sx = Number(config.scaleX ?? scale);
  const sy = Number(config.scaleY ?? scale);
  const sz = Number(config.scaleZ ?? scale);
  mesh.scale.set(sx, sy, sz);

  mesh.userData = {
    ...(config || {}),
    is3DText: true,
    textId: config.id,
    initialY: Number(config.posY ?? 0.6)
  };

  return mesh;
}

/**
 * Asynchronously loads fonts and builds a Three.js Group with all extruded 3D typography meshes.
 */
export async function create3DTextsGroup(texts = [], THREE_LIB = THREE) {
  const group = new THREE_LIB.Group();
  group.name = 'custom_3d_texts_group';
  if (!Array.isArray(texts) || texts.length === 0) return group;

  for (const item of texts) {
    if (!item || item.visible === false) continue;
    try {
      const font = await loadTypefaceFont(item.fontFamily || 'helvetiker_bold', item);
      const mesh = create3DTextMesh(item, THREE_LIB, font);
      if (mesh) {
        mesh.visible = item.visible !== false;
        group.add(mesh);
      }
    } catch (err) {
      console.warn('[text3DHelper] Failed to create 3D text mesh for item:', item, err);
    }
  }

  return group;
}

