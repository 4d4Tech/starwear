// src/utils/meshTemplates.js

// Vite glob import of all 3D mesh files under ../../meshtemplates/
const rawMeshModules = import.meta.glob('../../meshtemplates/**/*.{glb,gltf,obj,fbx,stl,ply,dae}', {
  eager: true,
  query: '?url',
  import: 'default'
});

function formatTitle(str) {
  if (!str) return '';
  return str
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function cleanModelName(filename) {
  const base = filename.replace(/\.[^/.]+$/, '');
  return formatTitle(base)
    .replace(/\(1\)/g, '(Alt 1)')
    .replace(/\(2\)/g, '(Alt 2)')
    .replace(/\(3\)/g, '(Alt 3)')
    .replace(/V(\d+)/gi, 'v$1');
}

function getCategoryIcon(cat, subcat) {
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
 * Returns an array of parsed 3D mesh template objects discovered from the meshtemplates directory.
 */
export function getMeshTemplates() {
  const templates = [];

  for (const [rawPath, resolvedUrl] of Object.entries(rawMeshModules)) {
    // rawPath is e.g. "../../meshtemplates/clothes/jackets/hoodie.glb"
    const rel = rawPath
      .replace(/^\.\.\/\.\.\/meshtemplates\//, '')
      .replace(/^\.\.\/meshtemplates\//, '')
      .replace(/^meshtemplates\//, '');
    const segments = rel.split('/');

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
    const id = rel.replace(/[^a-zA-Z0-9_-]/g, '-');
    const icon = getCategoryIcon(category, subcategory);

    // Fallback to static public path if resolvedUrl is not available
    const url = resolvedUrl || `/meshtemplates/${rel}`;

    templates.push({
      id,
      relPath: rel,
      category,
      subcategory,
      filename,
      cleanName,
      ext: ext.toUpperCase(),
      url,
      icon
    });
  }

  // Sort by category, then subcategory, then cleanName
  templates.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    if (a.subcategory !== b.subcategory) return a.subcategory.localeCompare(b.subcategory);
    return a.cleanName.localeCompare(b.cleanName);
  });

  return templates;
}

export function getTemplateCategories(templates) {
  const cats = new Set();
  templates.forEach((t) => cats.add(t.category));
  return Array.from(cats);
}

export function getTemplateSubcategories(templates, selectedCategory) {
  const subcats = new Set();
  templates
    .filter((t) => !selectedCategory || selectedCategory === 'All' || t.category === selectedCategory)
    .forEach((t) => subcats.add(t.subcategory));
  return Array.from(subcats);
}
