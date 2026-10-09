import { CURATED_COLLECTION } from '../pages/Shop';

/**
 * Resolves 3D model properties (modelUrl, fallbackImage, category, cleanName)
 * for a cart or checkout item.
 *
 * @param {Object} item - Cart item object
 * @param {Object} remoteAssets - Optional map of assets from Firestore
 * @returns {Object} { modelUrl, fallbackImage, category, cleanName }
 */
export function resolveCartItemModel(item, remoteAssets = {}) {
  if (!item) {
    return { modelUrl: '', fallbackImage: '', category: 'Apparel', cleanName: '' };
  }

  const rawId = item.baseId || item.id || '';
  // Strip size/color suffix if present (e.g. "aether-chrono-trench-M-TitaniumSilver")
  const idPrefix = rawId.split('-')[0];

  let modelUrl =
    item.modelUrl ||
    item.model_url ||
    item.glb_url ||
    item.gltf_url ||
    item.gltf_file_path ||
    '';
  let fallbackImage = item.thumbnailUrl || item.image || item.imageUrl || '';
  let category = item.category || 'Apparel';
  let cleanName = item.cleanName || item.name || item.id || '';

  // 1. Check against CURATED_COLLECTION
  if (Array.isArray(CURATED_COLLECTION)) {
    const curatedMatch = CURATED_COLLECTION.find(
      (c) =>
        c.id === rawId ||
        c.id === idPrefix ||
        rawId.startsWith(c.id) ||
        (item.name && c.name?.toLowerCase() === item.name?.toLowerCase())
    );

    if (curatedMatch) {
      if (!modelUrl) {
        modelUrl = curatedMatch.model_url || curatedMatch.glb_url || '';
      }
      if (!fallbackImage || fallbackImage.includes('googleusercontent.com')) {
        fallbackImage = curatedMatch.thumbnailUrl || curatedMatch.imageUrl || '';
      }
      category = curatedMatch.category || category;
      if (!cleanName || cleanName === item.id) {
        cleanName = curatedMatch.name;
      }
    }
  }

  // 2. Check remoteAssets map (from Firestore)
  if (remoteAssets && typeof remoteAssets === 'object') {
    const remoteMatch =
      remoteAssets[rawId] ||
      remoteAssets[idPrefix] ||
      (item.name &&
        Object.values(remoteAssets).find(
          (a) => (a.name || a.id)?.toLowerCase() === item.name?.toLowerCase()
        ));

    if (remoteMatch) {
      if (!modelUrl) {
        modelUrl =
          remoteMatch.gltf_url ||
          remoteMatch.modelUrl ||
          remoteMatch.model_url ||
          remoteMatch.glb_url ||
          remoteMatch.gltf_file_path ||
          '';
      }
      if (!fallbackImage || fallbackImage.includes('googleusercontent.com')) {
        fallbackImage =
          remoteMatch.thumbnailUrl ||
          remoteMatch.imageUrl ||
          remoteMatch.image ||
          '';
      }
      category = remoteMatch.category || category;
      if (!cleanName || cleanName === item.id) {
        cleanName = remoteMatch.name || remoteMatch.id;
      }
    }
  }

  return { modelUrl, fallbackImage, category, cleanName };
}
