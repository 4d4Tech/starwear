/* eslint-disable react/prop-types */
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  getMeshTemplates,
  fetchTemplatesFromBucket,
  getTemplateCategories,
  getTemplateSubcategories,
  TEMPLATES_BUCKET_NAME
} from '../utils/meshTemplates';

export default function MeshTemplateBrowser({
  isOpen = true,
  onClose,
  onSelectTemplate,
  loadingTemplateId = null,
  recentlyAddedId = null,
  mode = 'drawer', // 'drawer' | 'modal' | 'sidebar'
  onToggleExpanded
}) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSubcategory, setSelectedSubcategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [allTemplates, setAllTemplates] = useState(() => getMeshTemplates());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const scrollContainerRef = useRef(null);

  // Sync with 3dtemplates storage bucket on mount and subscribe to bucket updates
  useEffect(() => {
    let isMounted = true;
    async function loadFresh() {
      setIsRefreshing(true);
      try {
        const fresh = await fetchTemplatesFromBucket();
        if (isMounted && fresh && fresh.length > 0) {
          setAllTemplates(fresh);
        }
      } catch (err) {
        console.warn('Could not sync templates with 3dtemplates bucket:', err);
      } finally {
        if (isMounted) setIsRefreshing(false);
      }
    }
    loadFresh();

    const handleUpdate = (e) => {
      if (isMounted && e.detail) {
        setAllTemplates(e.detail);
      }
    };
    window.addEventListener('3dtemplates-updated', handleUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener('3dtemplates-updated', handleUpdate);
    };
  }, []);

  const handleRefreshBucket = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const fresh = await fetchTemplatesFromBucket();
      if (fresh && fresh.length > 0) {
        setAllTemplates(fresh);
      }
    } catch (err) {
      console.warn('Refresh failed:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Compute available categories and subcategories
  const categories = useMemo(() => ['All', ...getTemplateCategories(allTemplates)], [allTemplates]);

  const subcategories = useMemo(() => {
    return ['All', ...getTemplateSubcategories(allTemplates, selectedCategory)];
  }, [allTemplates, selectedCategory]);

  // When category changes, reset subcategory if it's no longer valid
  useEffect(() => {
    if (selectedSubcategory !== 'All' && !subcategories.includes(selectedSubcategory)) {
      setSelectedSubcategory('All');
    }
  }, [selectedCategory, subcategories, selectedSubcategory]);

  // Filter templates based on category, subcategory, and search
  const filteredTemplates = useMemo(() => {
    return allTemplates.filter((item) => {
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false;
      }
      if (selectedSubcategory !== 'All' && item.subcategory !== selectedSubcategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchName = item.cleanName.toLowerCase().includes(query);
        const matchCategory = item.category.toLowerCase().includes(query);
        const matchSubcat = item.subcategory.toLowerCase().includes(query);
        const matchFile = item.filename.toLowerCase().includes(query);
        if (!matchName && !matchCategory && !matchSubcat && !matchFile) {
          return false;
        }
      }
      return true;
    });
  }, [allTemplates, selectedCategory, selectedSubcategory, searchQuery]);

  // Enable horizontal mouse wheel scrolling for the drawer track
  const handleWheel = (e) => {
    if (mode === 'drawer' && scrollContainerRef.current) {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        scrollContainerRef.current.scrollLeft += e.deltaY;
      }
    }
  };

  const scrollByAmount = (amount) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  if (!isOpen) return null;

  // -------------------------------------------------------------------------
  // SIDEBAR EMBEDDED MODE (Used inside Left Outliner Panel)
  // -------------------------------------------------------------------------
  if (mode === 'sidebar') {
    return (
      <div className="flex flex-col h-full space-y-3">
        {/* Storage Bucket Header */}
        <div className="flex items-center justify-between px-1 py-0.5">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>bucket: {TEMPLATES_BUCKET_NAME}</span>
          </div>
          <button
            onClick={handleRefreshBucket}
            disabled={isRefreshing}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors flex items-center gap-1 text-[10px] font-mono cursor-pointer"
            title="Refresh templates from 3dtemplates storage bucket"
          >
            <span className={`material-symbols-outlined text-xs ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`}>
              refresh
            </span>
            <span>{isRefreshing ? 'Syncing...' : 'Sync'}</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 pl-8 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <span className="material-symbols-outlined absolute left-2 top-2 text-sm text-slate-500">
            search
          </span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-2 text-slate-500 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Category & Subcategory Filter Pills */}
        <div className="flex gap-1 overflow-x-auto pb-1 studio-scroll">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                setSelectedSubcategory('All');
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {subcategories.length > 2 && (
          <div className="flex gap-1 overflow-x-auto pb-1 studio-scroll">
            {subcategories.map((subcat) => (
              <button
                key={subcat}
                onClick={() => setSelectedSubcategory(subcat)}
                className={`px-2 py-0.5 rounded-full text-[9px] font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  selectedSubcategory === subcat
                    ? 'bg-indigo-950 text-indigo-300 border border-indigo-500/50'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {subcat}
              </button>
            ))}
          </div>
        )}

        {/* Scrollable vertical list */}
        <div className="flex-1 overflow-y-auto studio-scroll space-y-1.5 pr-1">
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-6 text-slate-500 text-xs">
              No matching 3D templates found.
            </div>
          ) : (
            filteredTemplates.map((template) => {
              const isLoading = loadingTemplateId === template.id;
              const isAdded = recentlyAddedId === template.id;

              return (
                <div
                  key={template.id}
                  onClick={() => !isLoading && onSelectTemplate(template)}
                  className={`p-2 rounded-xl border transition-all cursor-pointer group flex items-center justify-between gap-2 ${
                    isAdded
                      ? 'border-emerald-500/60 bg-emerald-950/20'
                      : 'border-slate-800 hover:border-indigo-500/60 bg-slate-950/50 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-950/80 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform overflow-hidden">
                      {template.thumbnailUrl ? (
                        <img src={template.thumbnailUrl} alt={template.cleanName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-sm text-indigo-400">
                          {template.icon}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-200 truncate group-hover:text-white">
                        {template.cleanName}
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1 font-mono truncate">
                        <span>{template.subcategory}</span>
                        <span>•</span>
                        <span className="text-indigo-400 font-bold">{template.ext}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    disabled={isLoading}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTemplate(template);
                    }}
                    className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-all flex-shrink-0 cursor-pointer ${
                      isLoading
                        ? 'bg-indigo-950 text-indigo-400 animate-pulse'
                        : isAdded
                        ? 'bg-emerald-600 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                    }`}
                  >
                    {isLoading ? (
                      <span className="w-2.5 h-2.5 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin"></span>
                    ) : isAdded ? (
                      <span className="material-symbols-outlined text-xs">done</span>
                    ) : (
                      <span className="material-symbols-outlined text-xs">add</span>
                    )}
                    <span>{isAdded ? 'Added' : 'Add'}</span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // FULL SCREEN MODAL MODE
  // -------------------------------------------------------------------------
  if (mode === 'modal') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-950 border border-indigo-500/30 text-indigo-400">
                <span className="material-symbols-outlined text-xl">category</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  3D Mesh Template Library
                  <span className="text-[11px] font-mono text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded-full border border-indigo-500/30 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>bucket: {TEMPLATES_BUCKET_NAME}</span>
                    <span>•</span>
                    <span>{filteredTemplates.length} models</span>
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Select any category or 3D object to import directly into your active studio scene.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRefreshBucket}
                disabled={isRefreshing}
                className="px-2 py-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1 text-xs border border-slate-800"
                title="Refresh templates from 3dtemplates storage bucket"
              >
                <span className={`material-symbols-outlined text-sm ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`}>
                  refresh
                </span>
                <span className="hidden sm:inline">{isRefreshing ? 'Syncing...' : 'Sync Bucket'}</span>
              </button>
              {onToggleExpanded && (
                <button
                  onClick={onToggleExpanded}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Switch to bottom shelf drawer view"
                >
                  <span className="material-symbols-outlined text-lg">vertical_align_bottom</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="p-3 border-b border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
            {/* Category tabs */}
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setSelectedSubcategory('All');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  {cat === 'All' ? '🌐 All Categories' : cat}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative min-w-[220px]">
              <input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 pl-8 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <span className="material-symbols-outlined absolute left-2.5 top-2 text-sm text-slate-500">
                search
              </span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-500 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Subcategory Filter Pills */}
          {subcategories.length > 1 && (
            <div className="px-4 py-2 border-b border-slate-800 bg-slate-950/30 flex items-center gap-1.5 overflow-x-auto studio-scroll">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mr-1">
                Subcategory:
              </span>
              {subcategories.map((subcat) => (
                <button
                  key={subcat}
                  onClick={() => setSelectedSubcategory(subcat)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                    selectedSubcategory === subcat
                      ? 'bg-indigo-950 text-indigo-300 border border-indigo-500/60 shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {subcat}
                </button>
              ))}
            </div>
          )}

          {/* Grid of Templates */}
          <div className="flex-1 overflow-y-auto studio-scroll p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {filteredTemplates.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400">
                <span className="material-symbols-outlined text-4xl text-slate-600 mb-2">
                  search_off
                </span>
                <p className="text-sm font-semibold">No template 3D models found</p>
                <p className="text-xs text-slate-500 mt-1">
                  Try clearing your search query or choosing another category.
                </p>
              </div>
            ) : (
              filteredTemplates.map((template) => {
                const isLoading = loadingTemplateId === template.id;
                const isAdded = recentlyAddedId === template.id;

                return (
                  <div
                    key={template.id}
                    onClick={() => !isLoading && onSelectTemplate(template)}
                    className={`group relative rounded-2xl border p-4 bg-slate-950/60 hover:bg-slate-800/40 transition-all flex flex-col justify-between cursor-pointer shadow-lg hover:shadow-indigo-500/10 ${
                      isAdded
                        ? 'border-emerald-500/60 ring-1 ring-emerald-500/30'
                        : 'border-slate-800 hover:border-indigo-500/60'
                    }`}
                  >
                    <div>
                      {/* Top badges */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          {template.category} • {template.subcategory}
                        </span>
                        <span className="text-[10px] font-bold font-mono text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-500/30">
                          .{template.ext}
                        </span>
                      </div>

                      {/* Icon / Image Preview Area */}
                      <div className="h-28 rounded-xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800/80 flex items-center justify-center mb-3 group-hover:border-indigo-500/40 transition-colors relative overflow-hidden">
                        {template.thumbnailUrl ? (
                          <img src={template.thumbnailUrl} alt={template.cleanName} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <>
                            <div className="absolute inset-0 bg-indigo-600/5 group-hover:bg-indigo-600/15 transition-colors"></div>
                            <span className="material-symbols-outlined text-5xl text-indigo-400 group-hover:scale-115 transition-transform duration-300">
                              {template.icon}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Model title */}
                      <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                        {template.cleanName}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
                        {template.filename}
                      </p>
                    </div>

                    {/* Action Button */}
                    <button
                      disabled={isLoading}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTemplate(template);
                      }}
                      className={`mt-4 w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md ${
                        isLoading
                          ? 'bg-indigo-950 text-indigo-300 animate-pulse border border-indigo-500/40'
                          : isAdded
                          ? 'bg-emerald-600 text-white'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
                      }`}
                    >
                      {isLoading ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin"></span>
                          <span>Loading 3D Mesh...</span>
                        </>
                      ) : isAdded ? (
                        <>
                          <span className="material-symbols-outlined text-sm">check_circle</span>
                          <span>Added to Scene!</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-sm">add_circle</span>
                          <span>Add to Scene</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // BOTTOM FLOATING DRAWER / SHELF MODE (Default, docking over lower 3D viewport)
  // -------------------------------------------------------------------------
  return (
    <div className="absolute bottom-4 left-4 right-4 z-40 bg-slate-900/95 backdrop-blur-xl border border-slate-800/90 rounded-2xl shadow-2xl flex flex-col max-h-72 overflow-hidden animate-slide-up transition-all">
      {/* Header bar */}
      <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-900/80 select-none">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-950 border border-indigo-500/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-xs text-indigo-400">deployed_code</span>
          </div>
          <span className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
            3D Templates
            <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950 px-1.5 py-0.5 rounded border border-indigo-500/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{TEMPLATES_BUCKET_NAME}</span>
              <span>({filteredTemplates.length})</span>
            </span>
          </span>
          <button
            onClick={handleRefreshBucket}
            disabled={isRefreshing}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors flex items-center gap-0.5 text-[10px] cursor-pointer"
            title="Refresh templates from 3dtemplates storage bucket"
          >
            <span className={`material-symbols-outlined text-xs ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`}>
              refresh
            </span>
          </button>
        </div>

        {/* Category Tabs in Header */}
        <div className="hidden sm:flex items-center gap-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                setSelectedSubcategory('All');
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2">
          <div className="relative w-36 sm:w-48">
            <input
              type="text"
              placeholder="Filter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 pl-7 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            <span className="material-symbols-outlined absolute left-2 top-1.5 text-xs text-slate-500">
              search
            </span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1 text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {onToggleExpanded && (
            <button
              onClick={onToggleExpanded}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
              title="Expand into full grid modal"
            >
              <span className="material-symbols-outlined text-sm">open_in_full</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
            title="Minimize shelf"
          >
            <span className="material-symbols-outlined text-sm">keyboard_arrow_down</span>
          </button>
        </div>
      </div>

      {/* Subcategory Filter Strip */}
      {subcategories.length > 1 && (
        <div className="px-4 py-1.5 border-b border-slate-800/80 bg-slate-950/50 flex items-center gap-1.5 overflow-x-auto studio-scroll">
          <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider mr-1">
            Subcategory:
          </span>
          {subcategories.map((subcat) => (
            <button
              key={subcat}
              onClick={() => setSelectedSubcategory(subcat)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                selectedSubcategory === subcat
                  ? 'bg-indigo-950 text-indigo-300 border border-indigo-500/50'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {subcat}
            </button>
          ))}
        </div>
      )}

      {/* Horizontal Scrollable Carousel Shelf */}
      <div className="relative group/shelf flex-1 p-3">
        {/* Left Scroll Arrow */}
        <button
          onClick={() => scrollByAmount(-300)}
          className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-slate-900/90 border border-slate-700 text-white shadow-lg flex items-center justify-center opacity-0 group-hover/shelf:opacity-100 hover:bg-indigo-600 transition-all cursor-pointer"
          title="Scroll Left"
        >
          <span className="material-symbols-outlined text-base">chevron_left</span>
        </button>

        {/* Right Scroll Arrow */}
        <button
          onClick={() => scrollByAmount(300)}
          className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-slate-900/90 border border-slate-700 text-white shadow-lg flex items-center justify-center opacity-0 group-hover/shelf:opacity-100 hover:bg-indigo-600 transition-all cursor-pointer"
          title="Scroll Right"
        >
          <span className="material-symbols-outlined text-base">chevron_right</span>
        </button>

        {/* Scroll Container */}
        <div
          ref={scrollContainerRef}
          onWheel={handleWheel}
          className="flex items-stretch gap-3 overflow-x-auto pb-1 studio-scroll scroll-smooth"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {filteredTemplates.length === 0 ? (
            <div className="w-full py-8 text-center text-slate-500 text-xs">
              No matching 3D mesh templates.
            </div>
          ) : (
            filteredTemplates.map((template) => {
              const isLoading = loadingTemplateId === template.id;
              const isAdded = recentlyAddedId === template.id;

              return (
                <div
                  key={template.id}
                  onClick={() => !isLoading && onSelectTemplate(template)}
                  className={`w-52 flex-shrink-0 rounded-xl border p-3 bg-slate-950/70 hover:bg-slate-800/50 transition-all flex flex-col justify-between cursor-pointer group shadow-md hover:shadow-indigo-500/10 ${
                    isAdded
                      ? 'border-emerald-500/70 ring-1 ring-emerald-500/40'
                      : 'border-slate-800 hover:border-indigo-500/60'
                  }`}
                  style={{ scrollSnapAlign: 'start' }}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[9px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 truncate max-w-[130px]">
                        {template.subcategory}
                      </span>
                      <span className="text-[9px] font-bold font-mono text-indigo-400 bg-indigo-950 px-1.5 py-0.5 rounded border border-indigo-500/30">
                        .{template.ext}
                      </span>
                    </div>

                    <div className="h-14 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-center mb-2 group-hover:border-indigo-500/40 transition-colors overflow-hidden">
                      {template.thumbnailUrl ? (
                        <img src={template.thumbnailUrl} alt={template.cleanName} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <span className="material-symbols-outlined text-2xl text-indigo-400 group-hover:scale-115 transition-transform">
                          {template.icon}
                        </span>
                      )}
                    </div>

                    <div className="text-xs font-bold text-white truncate group-hover:text-indigo-300 transition-colors">
                      {template.cleanName}
                    </div>
                  </div>

                  <button
                    disabled={isLoading}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTemplate(template);
                    }}
                    className={`mt-2.5 w-full py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      isLoading
                        ? 'bg-indigo-950 text-indigo-300 animate-pulse border border-indigo-500/30'
                        : isAdded
                        ? 'bg-emerald-600 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <span className="w-2.5 h-2.5 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin"></span>
                        <span>Loading...</span>
                      </>
                    ) : isAdded ? (
                      <>
                        <span className="material-symbols-outlined text-xs">done</span>
                        <span>Added!</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-xs">add</span>
                        <span>Add to Scene</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
