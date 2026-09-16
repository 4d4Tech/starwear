// src/utils/meshTemplates.js

import { templatesStorage } from '../firebase';
import { ref, listAll, getDownloadURL } from 'firebase/storage';

export const TEMPLATES_BUCKET_NAME = '3dtemplates';
export const TEMPLATES_BUCKET_URL = `https://storage.googleapis.com/${TEMPLATES_BUCKET_NAME}`;
export const TEMPLATES_API_URL = `https://storage.googleapis.com/storage/v1/b/${TEMPLATES_BUCKET_NAME}/o`;

const SUPPORTED_3D_EXTS = new Set(['glb', 'gltf', 'obj', 'fbx', 'stl', 'ply', 'dae']);

export function formatTitle(str) {
  if (!str) return '';
  return str
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function cleanModelName(filename) {
  const base = filename.replace(/\.[^/.]+$/, '');
  return formatTitle(base)
    .replace(/\(1\)/g, '(Alt 1)')
    .replace(/\(2\)/g, '(Alt 2)')
    .replace(/\(3\)/g, '(Alt 3)')
    .replace(/V(\d+)/gi, 'v$1');
}

export function getCategoryIcon(cat, subcat) {
  const c = (cat || '').toLowerCase();
  const s = (subcat || '').toLowerCase();
  if (c.includes('cloth') || c.includes('wear') || c.includes('apparel')) {
    if (s.includes('jacket') || s.includes('hoodie') || s.includes('coat')) return 'dry_cleaning';
    if (s.includes('shirt') || s.includes('top') || s.includes('tee')) return 'apparel';
    if (s.includes('pant') || s.includes('jean') || s.includes('trouser')) return 'straighten';
    return 'checkroom';
  }
  if (c.includes('shoe') || s.includes('shoe') || s.includes('sneaker')) return 'roller_skating';
  if (c.includes('hat') || s.includes('hat') || s.includes('cap')) return 'sports_martial_arts';
  if (c.includes('furniture')) return 'chair';
  if (c.includes('vehicle') || c.includes('car')) return 'directions_car';
  if (c.includes('character') || c.includes('avatar') || c.includes('body')) return 'person';
  return 'deployed_code';
}

/**
 * Parses an object path from the 3dtemplates bucket into a structured template model.
 */
export function parseTemplateFromPath(fullPath, metadata = {}) {
  const cleanPath = fullPath.replace(/^\/+/, '');
  const segments = cleanPath.split('/');

  let category = 'General';
  let subcategory = 'General';
  let filename = '';

  if (segments.length === 1) {
    filename = segments[0];
  } else if (segments.length === 2) {
    category = formatTitle(segments[0]);
    filename = segments[1];
  } else {
    category = formatTitle(segments[0]);
    subcategory = segments.slice(1, -1).map(formatTitle).join(' / ');
    filename = segments[segments.length - 1];
  }

  const ext = filename.split('.').pop().toLowerCase();
  const cleanName = cleanModelName(filename);
  const id = cleanPath.replace(/[^a-zA-Z0-9_-]/g, '-');
  const icon = getCategoryIcon(category, subcategory);

  // Encode each segment of the path so spaces (e.g. "hoodie (1).glb") are preserved properly in URL
  const encodedPath = cleanPath
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  const url = metadata.downloadUrl || `${TEMPLATES_BUCKET_URL}/${encodedPath}`;

  return {
    id,
    relPath: cleanPath,
    category,
    subcategory,
    filename,
    cleanName,
    ext: ext.toUpperCase(),
    url,
    icon,
    bucket: TEMPLATES_BUCKET_NAME,
    size: metadata.size ? parseInt(metadata.size, 10) : undefined,
    updated: metadata.updated
  };
}

export function sortTemplates(templates) {
  return [...templates].sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    if (a.subcategory !== b.subcategory) return a.subcategory.localeCompare(b.subcategory);
    return a.cleanName.localeCompare(b.cleanName);
  });
}

/**
 * Static baseline catalog for instant synchronous initial render,
 * pre-configured to read from the 3dtemplates storage bucket.
 */
const BASELINE_PATHS = [
  'clothes/jackets/hoodie.glb',
  'clothes/jackets/hoodie_v2.glb',
  'clothes/jackets/hoodie (1).glb',
  'clothes/shirts/casual_shirt.glb',
  'clothes/shirts/standard_t-shirt.glb',
  'clothes/shirts/white_t-shirt_with_print.glb'
];

export function getStaticTemplatesFallback() {
  const templates = BASELINE_PATHS.map((p) => parseTemplateFromPath(p));
  return sortTemplates(templates);
}

// In-memory cache of templates fetched from the 3dtemplates bucket
let cachedTemplates = getStaticTemplatesFallback();

/**
 * Synchronous getter returning cached or baseline templates from the 3dtemplates bucket.
 */
export function getMeshTemplates() {
  return cachedTemplates;
}

/**
 * Recursively lists all files in a Firebase Storage directory reference.
 */
async function listAllRecursive(storageRef) {
  const res = await listAll(storageRef);
  let files = [...res.items];
  for (const folderRef of res.prefixes) {
    const subFiles = await listAllRecursive(folderRef);
    files = files.concat(subFiles);
  }
  return files;
}

/**
 * Asynchronously fetches and parses the live list of 3D templates
 * from the "3dtemplates" storage bucket.
 */
export async function fetchTemplatesFromBucket() {
  // Strategy 1: Fast direct Google Cloud Storage JSON API (public read on bucket)
  try {
    const res = await fetch(TEMPLATES_API_URL);
    if (res.ok) {
      const data = await res.json();
      const items = (data.items || []).filter((item) => {
        if (!item.name || item.name.includes('.DS_Store')) return false;
        const ext = item.name.split('.').pop().toLowerCase();
        return SUPPORTED_3D_EXTS.has(ext);
      });

      if (items.length > 0) {
        const parsed = items.map((item) => parseTemplateFromPath(item.name, item));
        const sorted = sortTemplates(parsed);
        cachedTemplates = sorted;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('3dtemplates-updated', { detail: sorted }));
        }
        return sorted;
      }
    }
  } catch (apiErr) {
    console.warn('GCS REST API list failed, falling back to Firebase Storage SDK:', apiErr);
  }

  // Strategy 2: Firebase Storage client SDK listAll on templatesStorage (gs://3dtemplates)
  try {
    if (templatesStorage) {
      const rootRef = ref(templatesStorage, '');
      const storageItems = await listAllRecursive(rootRef);
      const validItems = storageItems.filter((itemRef) => {
        const ext = itemRef.name.split('.').pop().toLowerCase();
        return SUPPORTED_3D_EXTS.has(ext);
      });

      if (validItems.length > 0) {
        const templates = await Promise.all(
          validItems.map(async (itemRef) => {
            let downloadUrl = '';
            try {
              downloadUrl = await getDownloadURL(itemRef);
            } catch {
              // Fallback to direct public GCS URL
            }
            return parseTemplateFromPath(itemRef.fullPath, { downloadUrl });
          })
        );
        const sorted = sortTemplates(templates);
        cachedTemplates = sorted;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('3dtemplates-updated', { detail: sorted }));
        }
        return sorted;
      }
    }
  } catch (sdkErr) {
    console.warn('Firebase Storage SDK list failed:', sdkErr);
  }

  // Fallback to static catalog pointing to the 3dtemplates bucket
  return cachedTemplates;
}

export function getTemplateCategories(templates) {
  const cats = new Set();
  (templates || []).forEach((t) => cats.add(t.category));
  return Array.from(cats);
}

export function getTemplateSubcategories(templates, selectedCategory) {
  const subcats = new Set();
  (templates || [])
    .filter((t) => !selectedCategory || selectedCategory === 'All' || t.category === selectedCategory)
    .forEach((t) => subcats.add(t.subcategory));
  return Array.from(subcats);
}
