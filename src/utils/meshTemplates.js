// src/utils/meshTemplates.js

import { db, storage, templatesStorage } from '../firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, query } from 'firebase/firestore';
import { ref, listAll, getDownloadURL, uploadBytes, deleteObject } from 'firebase/storage';
import { getPreRenderedThumbnail, captureModelThumbnail } from './modelThumbnailRenderer';

export const TEMPLATES_BUCKET_NAME = '3dtemplates';
export const TEMPLATES_BUCKET_URL = `https://storage.googleapis.com/${TEMPLATES_BUCKET_NAME}`;
export const TEMPLATES_API_URL = `https://storage.googleapis.com/storage/v1/b/${TEMPLATES_BUCKET_NAME}/o`;

export const SUPPORTED_3D_EXTS = new Set(['glb', 'gltf', 'obj', 'fbx', 'stl', 'ply', 'dae']);

export const DEFAULT_TEMPLATE_CATEGORIES = [
  {
    name: 'Apparel',
    icon: 'checkroom',
    subcategories: ['Jackets & Coats', 'Hoodies & Sweats', 'T-Shirts & Tops', 'Pants & Bottoms', 'Dresses & Skirts']
  },
  {
    name: 'Characters',
    icon: 'person',
    subcategories: ['Humanoids & Mannequins', 'Avatars & Stylized', 'Robots & Cyber', 'Creatures & Fantasy']
  },
  {
    name: 'Footwear',
    icon: 'roller_skating',
    subcategories: ['Sneakers & Kicks', 'Boots', 'Dress & Casual Shoes']
  },
  {
    name: 'Headwear',
    icon: 'sports_martial_arts',
    subcategories: ['Caps & Hats', 'Beanies', 'Helmets & Visors']
  },
  {
    name: 'Accessories',
    icon: 'watch',
    subcategories: ['Bags & Backpacks', 'Jewelry & Chains', 'Eyewear & Glasses', 'Belts & Straps']
  },
  {
    name: 'Props & Objects',
    icon: 'deployed_code',
    subcategories: ['Tech & Gadgets', 'Furniture & Decor', 'Weapons & Tools', 'Vehicles']
  }
];

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
  const thumbnailUrl =
    metadata.thumbnailUrl ||
    getPreRenderedThumbnail(cleanPath) ||
    getPreRenderedThumbnail(filename) ||
    null;

  return {
    id,
    relPath: cleanPath,
    category,
    subcategory,
    filename,
    cleanName,
    ext: ext.toUpperCase(),
    url,
    thumbnailUrl,
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
 * Fetches all custom model templates uploaded by admins and stored in Firestore.
 */
export async function fetchFirestoreTemplates() {
  try {
    if (!db) return [];
    const q = query(collection(db, 'model_templates'));
    const snap = await getDocs(q);
    const firestoreTemplates = [];

    snap.forEach((docSnap) => {
      const d = docSnap.data();
      const ext = (d.ext || d.filename?.split('.').pop() || 'GLB').toUpperCase();
      const category = formatTitle(d.category) || 'General';
      const subcategory = formatTitle(d.subcategory) || 'General';
      const cleanName = d.cleanName || d.name || cleanModelName(d.filename || 'Template');
      const icon = getCategoryIcon(category, subcategory);

      firestoreTemplates.push({
        id: docSnap.id,
        relPath: d.storagePath || `${category}/${subcategory}/${d.filename}`,
        category,
        subcategory,
        filename: d.filename || `${cleanName}.${ext.toLowerCase()}`,
        cleanName,
        ext,
        url: d.url,
        thumbnailUrl: d.thumbnailUrl || null,
        thumbnailStoragePath: d.thumbnailStoragePath || null,
        storagePath: d.storagePath || null,
        icon,
        bucket: 'firestore',
        size: d.size ? parseInt(d.size, 10) : undefined,
        description: d.description || '',
        tags: Array.isArray(d.tags) ? d.tags : [],
        isHumanoid: !!d.isHumanoid,
        source: 'uploaded',
        createdAt: d.createdAt,
        updated: d.updatedAt || d.createdAt
      });
    });

    return firestoreTemplates;
  } catch (err) {
    console.warn('Failed to fetch templates from Firestore model_templates:', err);
    return [];
  }
}

/**
 * Asynchronously fetches and parses the live list of 3D templates
 * from both the "3dtemplates" storage bucket and Firestore custom uploads.
 */
export async function fetchTemplatesFromBucket() {
  let bucketTemplates = [];

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
        bucketTemplates = items.map((item) => parseTemplateFromPath(item.name, item));
      }
    }
  } catch (apiErr) {
    console.warn('GCS REST API list failed, falling back to Firebase Storage SDK:', apiErr);
  }

  // Strategy 2: Firebase Storage client SDK listAll on templatesStorage (gs://3dtemplates)
  if (bucketTemplates.length === 0) {
    try {
      if (templatesStorage) {
        const rootRef = ref(templatesStorage, '');
        const storageItems = await listAllRecursive(rootRef);
        const validItems = storageItems.filter((itemRef) => {
          const ext = itemRef.name.split('.').pop().toLowerCase();
          return SUPPORTED_3D_EXTS.has(ext);
        });

        if (validItems.length > 0) {
          bucketTemplates = await Promise.all(
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
        }
      }
    } catch (sdkErr) {
      console.warn('Firebase Storage SDK list failed:', sdkErr);
    }
  }

  // Fallback to static baseline if bucket yielded nothing
  if (bucketTemplates.length === 0) {
    bucketTemplates = getStaticTemplatesFallback();
  }

  // Strategy 3: Query custom templates uploaded via Admin into Firestore
  const firestoreTemplates = await fetchFirestoreTemplates();

  // Combine and deduplicate by id
  const map = new Map();
  bucketTemplates.forEach((t) => map.set(t.id, t));
  firestoreTemplates.forEach((t) => map.set(t.id, t));

  const sorted = sortTemplates(Array.from(map.values()));
  cachedTemplates = sorted;

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('3dtemplates-updated', { detail: sorted }));
  }

  return sorted;
}

/**
 * Upload a new 3D model template with category, subcategory, and optional thumbnail.
 * Saves to Firebase Storage and registers in Firestore model_templates.
 */
export async function uploadModelTemplate({
  file,
  thumbnailFile,
  name,
  category = 'Apparel',
  subcategory = 'General',
  description = '',
  tags = [],
  isHumanoid = false,
  onProgress = () => {}
}) {
  if (!file) throw new Error('No 3D model file provided for upload.');

  const ext = file.name.split('.').pop().toLowerCase();
  if (!SUPPORTED_3D_EXTS.has(ext)) {
    throw new Error(`Unsupported 3D file format .${ext}. Supported: GLB, GLTF, FBX, OBJ, STL, PLY, DAE`);
  }

  const cleanName = (name && name.trim()) ? name.trim() : cleanModelName(file.name);
  const formattedCategory = formatTitle(category) || 'General';
  const formattedSubcategory = formatTitle(subcategory) || 'General';

  const timestamp = Date.now();
  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const templateId = `tpl_${timestamp}_${safeFilename.replace(/\.[^/.]+$/, '').toLowerCase()}`;

  // 1. Upload 3D Model File
  onProgress({ step: 'MODEL_UPLOAD', progress: 20, message: `Uploading 3D model "${file.name}"...` });
  const modelStoragePath = `model_templates/${formattedCategory}/${formattedSubcategory}/${timestamp}_${safeFilename}`;
  const modelStorageRef = ref(storage, modelStoragePath);
  await uploadBytes(modelStorageRef, file);
  const modelUrl = await getDownloadURL(modelStorageRef);
  onProgress({ step: 'MODEL_DONE', progress: 65, message: '3D model file uploaded successfully.' });

  // 2. Upload Thumbnail (if provided, or auto-generate snapshot)
  let thumbnailUrl = null;
  let thumbnailStoragePath = null;
  let finalThumbFile = thumbnailFile;

  if (!finalThumbFile && typeof window !== 'undefined') {
    try {
      onProgress({ step: 'AUTO_THUMB', progress: 70, message: 'Auto-generating 3D model thumbnail preview...' });
      const dataUrl = await captureModelThumbnail(file);
      if (dataUrl && dataUrl.startsWith('data:image/')) {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        finalThumbFile = new File([blob], `${safeFilename}_thumb.png`, { type: 'image/png' });
      }
    } catch (err) {
      console.warn('Auto-thumbnail capture notice:', err);
    }
  }

  if (finalThumbFile) {
    onProgress({ step: 'THUMBNAIL_UPLOAD', progress: 75, message: 'Uploading preview thumbnail...' });
    const safeThumbName = finalThumbFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    thumbnailStoragePath = `model_templates/thumbnails/${timestamp}_${safeThumbName}`;
    const thumbStorageRef = ref(storage, thumbnailStoragePath);
    await uploadBytes(thumbStorageRef, finalThumbFile);
    thumbnailUrl = await getDownloadURL(thumbStorageRef);
  }

  // 3. Save Document in Firestore `model_templates`
  onProgress({ step: 'SAVING_METADATA', progress: 90, message: 'Registering in Studio 4D*4 catalog...' });
  const tagList = Array.isArray(tags)
    ? tags
    : typeof tags === 'string'
    ? tags.split(',').map((t) => t.trim()).filter(Boolean)
    : [];

  const templateDocData = {
    id: templateId,
    name: cleanName,
    cleanName: cleanName,
    category: formattedCategory,
    subcategory: formattedSubcategory,
    filename: file.name,
    ext: ext.toUpperCase(),
    size: file.size,
    url: modelUrl,
    storagePath: modelStoragePath,
    thumbnailUrl,
    thumbnailStoragePath,
    description: description.trim(),
    tags: tagList,
    isHumanoid: Boolean(isHumanoid),
    source: 'uploaded',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await setDoc(doc(db, 'model_templates', templateId), templateDocData);

  // 4. Trigger catalog refresh so all views immediately update
  onProgress({ step: 'SYNCING', progress: 100, message: 'Template successfully added to Studio 4D*4!' });
  await fetchTemplatesFromBucket();

  return templateDocData;
}

/**
 * Delete a custom uploaded model template from Firestore and Firebase Storage.
 */
export async function deleteModelTemplate(template) {
  if (!template || !template.id) throw new Error('Invalid template to delete.');

  // 1. Delete Firestore record
  try {
    await deleteDoc(doc(db, 'model_templates', template.id));
  } catch (err) {
    console.warn('Could not delete firestore template document:', err);
  }

  // 2. Delete 3D model file from Storage if custom uploaded
  if (template.storagePath) {
    try {
      const fileRef = ref(storage, template.storagePath);
      await deleteObject(fileRef);
    } catch (err) {
      console.warn('Could not delete 3D model file from storage:', err);
    }
  }

  // 3. Delete thumbnail image from Storage if custom uploaded
  if (template.thumbnailStoragePath) {
    try {
      const thumbRef = ref(storage, template.thumbnailStoragePath);
      await deleteObject(thumbRef);
    } catch (err) {
      console.warn('Could not delete thumbnail image from storage:', err);
    }
  }

  // 4. Refresh live catalog
  return await fetchTemplatesFromBucket();
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
