import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchTemplatesFromBucket,
  uploadModelTemplate,
  deleteModelTemplate,
  getTemplateCategories,
  getTemplateSubcategories,
  DEFAULT_TEMPLATE_CATEGORIES,
  SUPPORTED_3D_EXTS,
  cleanModelName,
  getCategoryIcon,
  TEMPLATES_BUCKET_NAME
} from '../utils/meshTemplates';
import Model3DThumbnail from '../components/Model3DThumbnail';

const formatFileSize = (bytes) => {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (dateVal) => {
  if (!dateVal) return 'Pre-installed';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return 'Pre-installed';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return 'Pre-installed';
  }
};

export default function AdminModelTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSubcategory, setSelectedSubcategory] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('all'); // 'all' | 'uploaded' | 'builtin'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  // Upload Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadThumbnail, setUploadThumbnail] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);
  const [templateName, setTemplateName] = useState('');
  const [templateCategory, setTemplateCategory] = useState('Apparel');
  const [customCategory, setCustomCategory] = useState('');
  const [templateSubcategory, setTemplateSubcategory] = useState('Jackets & Coats');
  const [customSubcategory, setCustomSubcategory] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateTags, setTemplateTags] = useState('');
  const [isHumanoid, setIsHumanoid] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStepMessage, setUploadStepMessage] = useState('');
  const [dragActive, setDragActive] = useState(false);

  // Delete State
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast Feedback State
  const [toastMessage, setToastMessage] = useState(null);

  const fileInputRef = useRef(null);
  const thumbInputRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadTemplates = useCallback(async (isManualSync = false) => {
    if (isManualSync) setSyncing(true);
    else setLoading(true);

    try {
      const list = await fetchTemplatesFromBucket();
      setTemplates(list || []);
      if (isManualSync) {
        showToast('Model template catalog synchronized with Studio 4D*4!');
      }
    } catch (err) {
      console.error('Failed to load model templates:', err);
      showToast('Error syncing template library: ' + err.message, 'error');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();

    const handleUpdate = (e) => {
      if (e.detail) {
        setTemplates(e.detail);
      }
    };
    window.addEventListener('3dtemplates-updated', handleUpdate);
    return () => window.removeEventListener('3dtemplates-updated', handleUpdate);
  }, [loadTemplates]);

  // Derived categories from available templates + default presets
  const allCategories = useMemo(() => {
    const set = new Set();
    DEFAULT_TEMPLATE_CATEGORIES.forEach((c) => set.add(c.name));
    getTemplateCategories(templates).forEach((c) => set.add(c));
    return ['All', ...Array.from(set)];
  }, [templates]);

  // Derived subcategories for the active filter
  const currentSubcategories = useMemo(() => {
    return ['All', ...getTemplateSubcategories(templates, selectedCategory)];
  }, [templates, selectedCategory]);

  // Reset subcategory if category changes and current subcategory is not valid
  useEffect(() => {
    if (selectedSubcategory !== 'All' && !currentSubcategories.includes(selectedSubcategory)) {
      setSelectedSubcategory('All');
    }
  }, [selectedCategory, currentSubcategories, selectedSubcategory]);

  // Recommended subcategories for upload modal based on category
  const uploadSubcategoryPresets = useMemo(() => {
    const found = DEFAULT_TEMPLATE_CATEGORIES.find(
      (c) => c.name.toLowerCase() === templateCategory.toLowerCase()
    );
    if (found && found.subcategories) {
      return found.subcategories;
    }
    const fromExisting = getTemplateSubcategories(templates, templateCategory);
    return fromExisting.length > 0 ? fromExisting : ['General'];
  }, [templateCategory, templates]);

  // When modal category changes, default subcategory to first preset
  useEffect(() => {
    if (uploadSubcategoryPresets.length > 0 && templateCategory !== '__NEW__') {
      setTemplateSubcategory(uploadSubcategoryPresets[0]);
    }
  }, [templateCategory, uploadSubcategoryPresets]);

  // Filtered Templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((item) => {
      // Category filter
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false;
      }
      // Subcategory filter
      if (selectedSubcategory !== 'All' && item.subcategory !== selectedSubcategory) {
        return false;
      }
      // Source filter
      if (sourceFilter === 'uploaded' && item.source !== 'uploaded') {
        return false;
      }
      if (sourceFilter === 'builtin' && item.source === 'uploaded') {
        return false;
      }
      // Search query
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchName = item.cleanName?.toLowerCase().includes(q);
        const matchFile = item.filename?.toLowerCase().includes(q);
        const matchCat = item.category?.toLowerCase().includes(q);
        const matchSubcat = item.subcategory?.toLowerCase().includes(q);
        const matchTags = Array.isArray(item.tags) && item.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchName && !matchFile && !matchCat && !matchSubcat && !matchTags) {
          return false;
        }
      }
      return true;
    });
  }, [templates, selectedCategory, selectedSubcategory, sourceFilter, search]);

  // KPI Metrics
  const metrics = useMemo(() => {
    const total = templates.length;
    const uploadedCount = templates.filter((t) => t.source === 'uploaded').length;
    const builtinCount = total - uploadedCount;
    const categoriesCount = new Set(templates.map((t) => t.category)).size;
    const formatsCount = new Set(templates.map((t) => t.ext)).size;
    return { total, uploadedCount, builtinCount, categoriesCount, formatsCount };
  }, [templates]);

  // Handlers for File Selection
  const handleModelFileChange = (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!SUPPORTED_3D_EXTS.has(ext)) {
      alert(`Unsupported 3D file format .${ext}. Please select a .glb, .gltf, .fbx, .obj, .stl, or .ply file.`);
      return;
    }
    setUploadFile(file);
    if (!templateName) {
      setTemplateName(cleanModelName(file.name));
    }
  };

  const handleThumbnailChange = (file) => {
    if (!file) return;
    setUploadThumbnail(file);
    const previewUrl = URL.createObjectURL(file);
    setThumbnailPreview(previewUrl);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleModelFileChange(e.dataTransfer.files[0]);
    }
  };

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadThumbnail(null);
    if (thumbnailPreview) {
      URL.revokeObjectURL(thumbnailPreview);
      setThumbnailPreview(null);
    }
    setTemplateName('');
    setTemplateCategory('Apparel');
    setCustomCategory('');
    setTemplateSubcategory('Jackets & Coats');
    setCustomSubcategory('');
    setTemplateDescription('');
    setTemplateTags('');
    setIsHumanoid(false);
    setIsUploading(false);
    setUploadProgress(0);
    setUploadStepMessage('');
  };

  const handleOpenUploadModal = () => {
    resetUploadForm();
    setIsUploadOpen(true);
  };

  const handleCloseUploadModal = () => {
    if (isUploading) {
      if (!confirm('Upload in progress. Are you sure you want to cancel?')) return;
    }
    resetUploadForm();
    setIsUploadOpen(false);
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      alert('Please select a 3D model file (.glb, .gltf, .fbx, .obj) to upload.');
      return;
    }

    const finalCategory = templateCategory === '__NEW__' ? customCategory.trim() : templateCategory;
    const finalSubcategory = templateSubcategory === '__NEW__' ? customSubcategory.trim() : templateSubcategory;

    if (!finalCategory) {
      alert('Please specify a category for this model template.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(5);
    setUploadStepMessage('Initializing template upload...');

    try {
      await uploadModelTemplate({
        file: uploadFile,
        thumbnailFile: uploadThumbnail,
        name: templateName,
        category: finalCategory,
        subcategory: finalSubcategory || 'General',
        description: templateDescription,
        tags: templateTags,
        isHumanoid,
        onProgress: ({ progress, message }) => {
          setUploadProgress(progress);
          setUploadStepMessage(message);
        }
      });

      showToast(`Model template "${templateName || uploadFile.name}" successfully added to Studio 4D*4!`);
      handleCloseUploadModal();
    } catch (err) {
      console.error('Template upload error:', err);
      alert('Failed to upload model template:\n' + err.message);
      setIsUploading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!templateToDelete) return;
    setIsDeleting(true);
    try {
      await deleteModelTemplate(templateToDelete);
      showToast(`Template "${templateToDelete.cleanName}" removed from catalog.`);
      setTemplateToDelete(null);
    } catch (err) {
      console.error('Failed to delete template:', err);
      showToast('Error deleting template: ' + err.message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const copyUrlToClipboard = (url) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    showToast('3D model download URL copied to clipboard!');
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 py-3 px-4 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold border backdrop-blur-lg animate-slide-up ${
            toastMessage.type === 'error'
              ? 'bg-rose-950/90 text-rose-200 border-rose-500/40'
              : 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40'
          }`}
        >
          <span className="material-symbols-outlined text-base">
            {toastMessage.type === 'error' ? 'error' : 'check_circle'}
          </span>
          <span>{toastMessage.message}</span>
        </div>
      )}

      {/* Page Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-outline-variant/30 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-headline-lg text-2xl md:text-3xl text-on-background font-bold tracking-tight">
              Model Template Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
              Studio 4D*4
            </span>
          </div>
          <p className="text-secondary mt-1 text-sm max-w-2xl">
            Manage, categorize, and upload 3D asset templates available to creators inside Studio 4D*4. Uploaded models immediately sync to the 3D viewport.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => loadTemplates(true)}
            disabled={syncing}
            className="py-2.5 px-3.5 rounded-xl border border-outline-variant hover:bg-surface-container-highest text-xs font-semibold text-on-surface flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Reload templates from GCS Bucket and Firestore"
          >
            <span className={`material-symbols-outlined text-sm ${syncing ? 'animate-spin text-primary' : ''}`}>
              refresh
            </span>
            <span>{syncing ? 'Syncing...' : 'Sync Catalog'}</span>
          </button>

          <Link
            to="/studio44"
            target="_blank"
            rel="noopener noreferrer"
            className="py-2.5 px-3.5 rounded-xl bg-surface-container-highest hover:bg-surface-container text-xs font-semibold text-on-surface border border-outline-variant/50 flex items-center gap-1.5 transition-colors"
            title="Open Studio 4D*4 in a new tab"
          >
            <span className="material-symbols-outlined text-sm text-primary">view_in_ar</span>
            <span>Open Studio 4D*4</span>
            <span className="material-symbols-outlined text-xs text-secondary">open_in_new</span>
          </Link>

          <button
            type="button"
            onClick={handleOpenUploadModal}
            className="py-2.5 px-4 rounded-xl bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold shadow-md shadow-primary/20 flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02]"
          >
            <span className="material-symbols-outlined text-base">cloud_upload</span>
            <span>Upload Template</span>
          </button>
        </div>
      </header>

      {/* KPI Stats Row */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-xl flex items-center justify-between border border-outline-variant/30">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-secondary">Total Templates</span>
            <div className="text-2xl font-bold text-on-background mt-0.5">{metrics.total}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">category</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-xl flex items-center justify-between border border-outline-variant/30">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-secondary">Categories</span>
            <div className="text-2xl font-bold text-on-background mt-0.5">{metrics.categoriesCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">folder</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-xl flex items-center justify-between border border-outline-variant/30">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-secondary">Custom Uploads</span>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {metrics.uploadedCount}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">upload_file</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-xl flex items-center justify-between border border-outline-variant/30">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-secondary">3D Formats</span>
            <div className="text-2xl font-bold text-on-background mt-0.5">{metrics.formatsCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <span className="material-symbols-outlined text-xl">deployed_code</span>
          </div>
        </div>
      </section>

      {/* Filter and Search Controls */}
      <section className="glass-panel p-4 rounded-2xl border border-outline-variant/30 space-y-4">
        {/* Top Filter Row: Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 studio-scroll">
          {allCategories.map((cat) => {
            const count = cat === 'All'
              ? templates.length
              : templates.filter((t) => t.category === cat).length;
            const icon = cat === 'All' ? 'grid_view' : getCategoryIcon(cat, '');
            const isSelected = selectedCategory === cat;

            return (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat);
                  setSelectedSubcategory('All');
                }}
                className={`py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-primary text-on-primary shadow-sm font-bold'
                    : 'bg-surface-container-highest/60 hover:bg-surface-container-highest text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-sm">{icon}</span>
                <span>{cat}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-surface-container text-secondary'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Subcategories Row (if category selected and subcategories available) */}
        {currentSubcategories.length > 2 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 studio-scroll pt-1 border-t border-outline-variant/20">
            <span className="text-[11px] font-mono text-secondary mr-1 uppercase">Subcategory:</span>
            {currentSubcategories.map((subcat) => (
              <button
                key={subcat}
                type="button"
                onClick={() => setSelectedSubcategory(subcat)}
                className={`py-1 px-2.5 rounded-lg text-xs transition-all whitespace-nowrap cursor-pointer ${
                  selectedSubcategory === subcat
                    ? 'bg-secondary text-white font-bold'
                    : 'bg-surface-container-highest/40 hover:bg-surface-container-highest text-secondary'
                }`}
              >
                {subcat}
              </button>
            ))}
          </div>
        )}

        {/* Search, Source Filter & View Switcher */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Search templates by name, file, tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-2 px-3 pl-9 text-xs text-on-background placeholder-secondary focus:outline-none focus:border-primary transition-all"
            />
            <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-secondary text-sm">
              search
            </span>
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2 text-secondary hover:text-on-background text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
            {/* Source Filter Dropdown */}
            <div className="flex items-center gap-1 bg-surface-container-lowest border border-outline-variant rounded-xl p-1">
              <button
                type="button"
                onClick={() => setSourceFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  sourceFilter === 'all'
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                    : 'text-secondary hover:text-on-surface'
                }`}
              >
                All Sources
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter('uploaded')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  sourceFilter === 'uploaded'
                    ? 'bg-emerald-100 text-emerald-950 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-700 shadow-xs'
                    : 'text-secondary hover:text-on-surface'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400"></span>
                <span>Custom ({metrics.uploadedCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter('builtin')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  sourceFilter === 'builtin'
                    ? 'bg-indigo-100 text-indigo-950 border border-indigo-300 dark:bg-indigo-950 dark:text-indigo-200 dark:border-indigo-700 shadow-xs'
                    : 'text-secondary hover:text-on-surface'
                }`}
              >
                Built-in ({metrics.builtinCount})
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-surface-container-lowest border border-outline-variant rounded-xl p-1">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-secondary hover:text-on-surface'
                }`}
                title="Grid Card View"
              >
                <span className="material-symbols-outlined text-sm">grid_view</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-secondary hover:text-on-surface'
                }`}
                title="Table List View"
              >
                <span className="material-symbols-outlined text-sm">view_list</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area: Templates Grid or Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-secondary font-medium">Loading 3D model templates...</span>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl border border-outline-variant/30 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-surface-container-highest mx-auto flex items-center justify-center text-secondary">
            <span className="material-symbols-outlined text-3xl">deployed_code</span>
          </div>
          <div>
            <h3 className="text-base font-bold text-on-background">No model templates match your filter</h3>
            <p className="text-xs text-secondary mt-1 max-w-md mx-auto">
              Try adjusting your category selection or search term, or click "Upload Template" to add a new 3D model to this category.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenUploadModal}
            className="py-2 px-4 rounded-xl bg-primary text-on-primary text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            <span>Upload New Template</span>
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredTemplates.map((template) => {
            const isUploaded = template.source === 'uploaded';

            return (
              <div
                key={template.id}
                className="glass-panel rounded-2xl border border-outline-variant/30 hover:border-primary/50 transition-all flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-lg group"
              >
                {/* Card Top / Preview */}
                <div className="p-4 space-y-3">
                  {/* Badges Bar */}
                  <div className="flex items-center justify-between gap-1 text-[10px]">
                    <span className="font-mono px-2 py-0.5 rounded-md bg-surface-container text-secondary border border-outline-variant/40 truncate max-w-[130px]">
                      {template.category} • {template.subcategory}
                    </span>

                    <div className="flex items-center gap-1">
                      <span className="font-bold font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700">
                        .{template.ext}
                      </span>
                      {isUploaded ? (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-950 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-700 font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse"></span>
                          Custom
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-950 border border-indigo-300 dark:bg-indigo-950 dark:text-indigo-200 dark:border-indigo-700 font-bold">
                          Bucket
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Thumbnail / 3D Model Representation */}
                  <div className="h-36 rounded-xl bg-surface-container-highest/50 border border-outline-variant/20 flex items-center justify-center relative overflow-hidden group-hover:border-primary/30 transition-colors">
                    <Model3DThumbnail
                      modelUrl={template.url}
                      fallbackImageUrl={template.thumbnailUrl}
                      category={template.category}
                      subcategory={template.subcategory}
                      cleanName={template.cleanName}
                      className="w-full h-full"
                      badge={false}
                    />

                    {template.isHumanoid && (
                      <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/90 text-indigo-200 border border-indigo-400/60 text-[9px] font-mono font-bold flex items-center gap-1 shadow-sm z-20">
                        <span className="material-symbols-outlined text-xs">accessibility_new</span>
                        <span>Rig-Ready</span>
                      </div>
                    )}
                  </div>

                  {/* Template Info */}
                  <div>
                    <h3 className="font-bold text-sm text-on-background group-hover:text-primary transition-colors truncate" title={template.cleanName}>
                      {template.cleanName}
                    </h3>
                    <p className="text-[11px] font-mono text-secondary truncate mt-0.5" title={template.filename}>
                      {template.filename}
                    </p>
                  </div>

                  {template.description && (
                    <p className="text-xs text-secondary line-clamp-2 leading-relaxed">
                      {template.description}
                    </p>
                  )}

                  {/* Meta Details: File Size & Date */}
                  <div className="pt-2 border-t border-outline-variant/20 flex items-center justify-between text-[11px] text-secondary font-mono">
                    <span>Size: {formatFileSize(template.size)}</span>
                    <span>{formatDate(template.createdAt || template.updated)}</span>
                  </div>
                </div>

                {/* Card Actions Toolbar */}
                <div className="p-3 bg-surface-container-highest/40 border-t border-outline-variant/20 flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1">
                    <Link
                      to="/studio44"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-1 px-2.5 rounded-lg bg-primary hover:bg-primary/90 text-on-primary text-xs font-semibold flex items-center gap-1 shadow-sm transition-all"
                      title="Launch in Studio 4D*4"
                    >
                      <span className="material-symbols-outlined text-xs">view_in_ar</span>
                      <span>Studio 44</span>
                    </Link>

                    {template.url && (
                      <a
                        href={template.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={template.filename}
                        className="p-1.5 rounded-lg hover:bg-surface-container text-secondary hover:text-on-surface transition-colors"
                        title="Download 3D Model File"
                      >
                        <span className="material-symbols-outlined text-sm">download</span>
                      </a>
                    )}

                    {template.url && (
                      <button
                        type="button"
                        onClick={() => copyUrlToClipboard(template.url)}
                        className="p-1.5 rounded-lg hover:bg-surface-container text-secondary hover:text-on-surface transition-colors cursor-pointer"
                        title="Copy direct download link"
                      >
                        <span className="material-symbols-outlined text-sm">link</span>
                      </button>
                    )}
                  </div>

                  {/* Delete button (for custom uploaded templates) */}
                  {isUploaded && (
                    <button
                      type="button"
                      onClick={() => setTemplateToDelete(template)}
                      className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Delete this template from catalog"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE LIST VIEW */
        <div className="glass-panel rounded-2xl border border-outline-variant/30 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/30 bg-surface-container-highest/60 text-secondary font-mono text-[11px] uppercase">
                  <th className="py-3 px-4">Template</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Subcategory</th>
                  <th className="py-3 px-4">Format</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Added</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {filteredTemplates.map((template) => {
                  const isUploaded = template.source === 'uploaded';

                  return (
                    <tr key={template.id} className="hover:bg-surface-container-highest/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-surface-container border border-outline-variant/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            <Model3DThumbnail
                              modelUrl={template.url}
                              fallbackImageUrl={template.thumbnailUrl}
                              category={template.category}
                              subcategory={template.subcategory}
                              cleanName={template.cleanName}
                              className="w-full h-full"
                              badge={false}
                              interactiveOnHover={false}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-on-background truncate max-w-xs">
                              {template.cleanName}
                            </div>
                            <div className="text-[11px] font-mono text-secondary truncate max-w-xs">
                              {template.filename}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-on-surface">
                        {template.category}
                      </td>
                      <td className="py-3 px-4 text-secondary">
                        {template.subcategory}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px]">
                          .{template.ext}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-secondary">
                        {formatFileSize(template.size)}
                      </td>
                      <td className="py-3 px-4">
                        {isUploaded ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-950 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400"></span>
                            Custom
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-950 border border-indigo-300 dark:bg-indigo-950 dark:text-indigo-200 dark:border-indigo-700">
                            Built-in
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-secondary text-[11px]">
                        {formatDate(template.createdAt || template.updated)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            to="/studio44"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-surface-container text-primary transition-colors"
                            title="Open in Studio 4D*4"
                          >
                            <span className="material-symbols-outlined text-base">view_in_ar</span>
                          </Link>

                          {template.url && (
                            <button
                              type="button"
                              onClick={() => copyUrlToClipboard(template.url)}
                              className="p-1.5 rounded-lg hover:bg-surface-container text-secondary hover:text-on-surface transition-colors cursor-pointer"
                              title="Copy URL"
                            >
                              <span className="material-symbols-outlined text-base">link</span>
                            </button>
                          )}

                          {isUploaded && (
                            <button
                              type="button"
                              onClick={() => setTemplateToDelete(template)}
                              className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Delete template"
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* UPLOAD TEMPLATE MODAL */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in overflow-y-auto">
          <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-3xl shadow-2xl max-w-2xl w-full my-8 overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="p-6 border-b border-outline-variant/30 flex items-center justify-between bg-surface-container-highest/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary text-on-primary flex items-center justify-center shadow-md shadow-primary/20">
                  <span className="material-symbols-outlined text-xl">cloud_upload</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-on-background">Upload 3D Model Template</h2>
                  <p className="text-xs text-secondary">
                    Add a new 3D model into specific categories for Studio 4D*4 creators.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseUploadModal}
                disabled={isUploading}
                className="p-1.5 rounded-xl hover:bg-surface-container text-secondary hover:text-on-surface transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleUploadSubmit} className="p-6 space-y-6">
              {/* 1. 3D Model File Dropzone */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-background block">
                  3D Model File <span className="text-rose-500">*</span>
                </label>

                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
                    dragActive
                      ? 'border-primary bg-primary/5 scale-[1.01]'
                      : uploadFile
                      ? 'border-emerald-500/60 bg-emerald-500/5'
                      : 'border-outline-variant hover:border-primary/60 bg-surface-container-highest/20 hover:bg-surface-container-highest/40'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".glb,.gltf,.fbx,.obj,.stl,.ply,.dae"
                    onChange={(e) => handleModelFileChange(e.target.files?.[0])}
                    className="hidden"
                  />

                  {uploadFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-black/40 border border-emerald-500/40 flex items-center justify-center flex-shrink-0 shadow-md">
                        <Model3DThumbnail
                          modelUrl={uploadFile}
                          cleanName={uploadFile.name}
                          category={templateCategory}
                          className="w-full h-full"
                          badge={false}
                          interactiveOnHover={false}
                        />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-on-background">{uploadFile.name}</p>
                        <p className="text-xs font-mono text-secondary">
                          {formatFileSize(uploadFile.size)} • {uploadFile.name.split('.').pop()?.toUpperCase()}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadFile(null);
                        }}
                        className="ml-auto text-xs text-rose-500 hover:underline p-1 cursor-pointer"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl">view_in_ar</span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-on-background">
                          Click to browse or drag and drop your 3D asset
                        </p>
                        <p className="text-[11px] text-secondary mt-0.5">
                          Supported formats: GLB, GLTF, FBX, OBJ, STL, PLY
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Category & Subcategory Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-on-background block">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={templateCategory}
                    onChange={(e) => setTemplateCategory(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-2 px-3 text-xs text-on-background focus:outline-none focus:border-primary cursor-pointer"
                  >
                    {DEFAULT_TEMPLATE_CATEGORIES.map((cat) => (
                      <option key={cat.name} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                    {allCategories
                      .filter((c) => c !== 'All' && !DEFAULT_TEMPLATE_CATEGORIES.some((d) => d.name === c))
                      .map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    <option value="__NEW__">+ Add New Category...</option>
                  </select>

                  {templateCategory === '__NEW__' && (
                    <input
                      type="text"
                      placeholder="Enter new category name..."
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      required
                      className="w-full mt-2 bg-surface-container-lowest border border-primary rounded-xl py-2 px-3 text-xs text-on-background focus:outline-none"
                    />
                  )}
                </div>

                {/* Subcategory Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-on-background block">
                    Subcategory
                  </label>
                  <select
                    value={templateSubcategory}
                    onChange={(e) => setTemplateSubcategory(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-2 px-3 text-xs text-on-background focus:outline-none focus:border-primary cursor-pointer"
                  >
                    {uploadSubcategoryPresets.map((subcat) => (
                      <option key={subcat} value={subcat}>
                        {subcat}
                      </option>
                    ))}
                    <option value="__NEW__">+ Add New Subcategory...</option>
                  </select>

                  {templateSubcategory === '__NEW__' && (
                    <input
                      type="text"
                      placeholder="Enter new subcategory name..."
                      value={customSubcategory}
                      onChange={(e) => setCustomSubcategory(e.target.value)}
                      required
                      className="w-full mt-2 bg-surface-container-lowest border border-primary rounded-xl py-2 px-3 text-xs text-on-background focus:outline-none"
                    />
                  )}
                </div>
              </div>

              {/* 3. Display Name & Humanoid Toggle */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-on-background block">
                    Template Display Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Vintage Leather Jacket"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    required
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-2 px-3 text-xs text-on-background focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1.5 pb-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isHumanoid}
                      onChange={(e) => setIsHumanoid(e.target.checked)}
                      className="rounded accent-primary w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-on-background flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-primary">accessibility_new</span>
                      Humanoid Rig-Ready
                    </span>
                  </label>
                  <p className="text-[10px] text-secondary">
                    Flags model for 1-click biped rigging in Studio 44.
                  </p>
                </div>
              </div>

              {/* 4. Preview Thumbnail Picker (Optional) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-background block">
                  Preview Thumbnail Image <span className="text-secondary text-[11px] font-normal">(Optional)</span>
                </label>

                <div className="flex items-center gap-4">
                  <div
                    onClick={() => thumbInputRef.current?.click()}
                    className="w-20 h-20 rounded-2xl bg-surface-container border border-dashed border-outline-variant flex items-center justify-center cursor-pointer hover:border-primary transition-colors overflow-hidden flex-shrink-0"
                    title="Upload thumbnail"
                  >
                    <input
                      ref={thumbInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => handleThumbnailChange(e.target.files?.[0])}
                      className="hidden"
                    />
                    {thumbnailPreview ? (
                      <img src={thumbnailPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-2xl text-secondary">add_photo_alternate</span>
                    )}
                  </div>

                  <div className="text-xs text-secondary space-y-1">
                    <p className="font-medium text-on-surface">Upload a clean render or icon image.</p>
                    <p className="text-[11px]">PNG, JPG, or WEBP (Square recommended, 512x512)</p>
                    {uploadThumbnail && (
                      <button
                        type="button"
                        onClick={() => {
                          setUploadThumbnail(null);
                          if (thumbnailPreview) {
                            URL.revokeObjectURL(thumbnailPreview);
                            setThumbnailPreview(null);
                          }
                        }}
                        className="text-xs text-rose-500 hover:underline cursor-pointer block pt-0.5"
                      >
                        Remove image
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 5. Description & Tags */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-on-background block">
                    Description <span className="text-secondary text-[11px] font-normal">(Optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Short summary of the 3D model geometry and materials..."
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-2 px-3 text-xs text-on-background focus:outline-none focus:border-primary resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-on-background block">
                    Search Tags <span className="text-secondary text-[11px] font-normal">(Comma-separated)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. jacket, winter, warm, streetwear"
                    value={templateTags}
                    onChange={(e) => setTemplateTags(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-2 px-3 text-xs text-on-background focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Progress Bar (if uploading) */}
              {isUploading && (
                <div className="p-4 rounded-2xl bg-surface-container-highest/60 border border-outline-variant/30 space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-on-surface flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
                      {uploadStepMessage}
                    </span>
                    <span className="font-mono text-primary font-bold">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-surface-container rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="pt-2 border-t border-outline-variant/30 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseUploadModal}
                  disabled={isUploading}
                  className="py-2.5 px-4 rounded-xl border border-outline-variant hover:bg-surface-container text-xs font-semibold text-secondary hover:text-on-surface transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isUploading || !uploadFile}
                  className="py-2.5 px-6 rounded-xl bg-primary hover:bg-primary/90 text-on-primary text-xs font-bold shadow-md shadow-primary/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base">cloud_upload</span>
                      <span>Upload Template</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {templateToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-scale-up">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-xl">delete_forever</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-on-background">Delete Model Template?</h3>
                <p className="text-xs text-secondary">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Are you sure you want to remove <strong className="text-on-background">"{templateToDelete.cleanName}"</strong> from the Studio 4D*4 catalog? The 3D model and thumbnail files in storage will also be deleted.
            </p>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setTemplateToDelete(null)}
                disabled={isDeleting}
                className="py-2 px-3.5 rounded-xl border border-outline-variant hover:bg-surface-container text-xs font-semibold text-secondary hover:text-on-surface transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="py-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">delete</span>
                    <span>Delete Template</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
