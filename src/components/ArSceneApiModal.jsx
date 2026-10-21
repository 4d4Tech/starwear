// src/components/ArSceneApiModal.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  parseArSceneInput,
  validateArSceneInput,
  BUILTIN_API_PRESETS,
  AR_SCENE_API_VERSION
} from '../utils/arSceneApi';

export default function ArSceneApiModal({
  isOpen,
  onClose,
  onApplyScene,
  onExportCurrentScene
}) {
  const [inputText, setInputText] = useState('');
  const [mode, setMode] = useState('replace'); // 'replace' | 'append'
  const [statusMessage, setStatusMessage] = useState('');
  const [copied, setCopied] = useState(false);

  // Initialize with the Tree Biome preset when opened for the first time if input is empty
  useEffect(() => {
    if (isOpen && !inputText.trim() && BUILTIN_API_PRESETS.length > 0) {
      setInputText(JSON.stringify(BUILTIN_API_PRESETS[0].payload, null, 2));
    }
  }, [isOpen]);

  // Real-time parser and validation computation
  const parseResult = useMemo(() => {
    if (!inputText.trim()) {
      return {
        hasInput: false,
        isValid: false,
        error: null,
        warnings: [],
        normalizedData: null,
        stats: null
      };
    }

    try {
      const parsed = parseArSceneInput(inputText);
      const validation = validateArSceneInput(parsed);
      return {
        hasInput: true,
        isValid: validation.isValid,
        error: validation.errors.length > 0 ? validation.errors.join(', ') : null,
        warnings: validation.warnings,
        normalizedData: validation.normalizedData,
        stats: validation.stats
      };
    } catch (err) {
      return {
        hasInput: true,
        isValid: false,
        error: err.message,
        warnings: [],
        normalizedData: null,
        stats: null
      };
    }
  }, [inputText]);

  if (!isOpen) return null;

  const handleSelectPreset = (presetId) => {
    const p = BUILTIN_API_PRESETS.find((item) => item.id === presetId);
    if (p) {
      setInputText(JSON.stringify(p.payload, null, 2));
      setStatusMessage(`Loaded "${p.name}" preset.`);
      setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputText(text);
        setStatusMessage('Pasted from clipboard.');
        setTimeout(() => setStatusMessage(''), 3000);
      }
    } catch {
      setStatusMessage('Clipboard access denied. Please paste manually into the editor.');
      setTimeout(() => setStatusMessage(''), 4000);
    }
  };

  const handleExportCurrent = () => {
    if (typeof onExportCurrentScene === 'function') {
      const exported = onExportCurrentScene();
      if (exported) {
        const jsonStr = JSON.stringify(exported, null, 2);
        setInputText(jsonStr);
        navigator.clipboard?.writeText(jsonStr);
        setCopied(true);
        setStatusMessage('Exported live scene and copied API JSON to clipboard!');
        setTimeout(() => {
          setStatusMessage('');
          setCopied(false);
        }, 4000);
      }
    }
  };

  const handleConstruct = () => {
    if (!parseResult.isValid || !parseResult.normalizedData) {
      setStatusMessage('Please fix syntax or validation errors before constructing the scene.');
      return;
    }
    onApplyScene(parseResult.normalizedData, mode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-neutral-100">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <span className="material-symbols-outlined text-xl">auto_awesome</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                  AR-Test Scene Constructor API
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold">
                  v{AR_SCENE_API_VERSION}
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Paste Google Gemini vision outputs or API JSON to generate 3D shapes, scatter layers, and lighting.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/admin/ar-api-docs"
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold flex items-center gap-1 transition-all"
              title="Open full single-page API documentation for Gemini & Google NotebookLM"
            >
              <span className="material-symbols-outlined text-sm text-emerald-400">menu_book</span>
              <span>API Docs</span>
              <span className="material-symbols-outlined text-[11px] text-neutral-500">open_in_new</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Toolbar & Preset Selector */}
        <div className="px-6 py-2.5 bg-neutral-950/40 border-b border-neutral-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-neutral-400 font-medium flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-emerald-400">library_books</span>
              <span>Sample Presets:</span>
            </span>
            <select
              onChange={(e) => handleSelectPreset(e.target.value)}
              defaultValue="ancient_tree_biome"
              className="bg-neutral-800 border border-neutral-700 rounded-lg px-2.5 py-1 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {BUILTIN_API_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Selector */}
            <div className="flex items-center bg-neutral-800 p-0.5 rounded-lg border border-neutral-700">
              <button
                type="button"
                onClick={() => setMode('replace')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                  mode === 'replace'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Clears current scene shapes and builds fresh scene"
              >
                Replace Scene
              </button>
              <button
                type="button"
                onClick={() => setMode('append')}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                  mode === 'append'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Appends elements into current scene without clearing"
              >
                Append / Merge
              </button>
            </div>

            <button
              type="button"
              onClick={handlePasteClipboard}
              className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 flex items-center gap-1 cursor-pointer transition-colors"
              title="Paste content from clipboard"
            >
              <span className="material-symbols-outlined text-xs">content_paste</span>
              <span>Paste</span>
            </button>

            <button
              type="button"
              onClick={handleExportCurrent}
              className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-teal-300 hover:text-teal-200 border border-teal-500/40 flex items-center gap-1 cursor-pointer transition-colors"
              title="Serialize current 3D scene into API JSON"
            >
              <span className="material-symbols-outlined text-xs">file_download</span>
              <span>{copied ? 'Copied Current!' : 'Export Current Scene'}</span>
            </button>

            <button
              type="button"
              onClick={() => setInputText('')}
              className="p-1 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Clear input"
            >
              <span className="material-symbols-outlined text-sm">delete_sweep</span>
            </button>
          </div>
        </div>

        {/* Status Alert if active */}
        {statusMessage && (
          <div className="px-6 py-2 bg-emerald-950/60 border-b border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">info</span>
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Textarea Editor Area */}
        <div className="flex-1 p-4 min-h-[260px] flex flex-col">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Paste Google Gemini JSON response or AR-Test API spec here...\n\nExample:\n{\n  "ar_scene": {\n    "metadata": { "name": "Tree Scene" },\n    "shapes": [ ... ],\n    "scatterLayers": [ ... ],\n    "lighting": { ... }\n  }\n}`}
            spellCheck={false}
            className="w-full flex-1 min-h-[240px] p-4 bg-neutral-950 border border-neutral-800 rounded-xl text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500/80 resize-none leading-relaxed shadow-inner"
          />
        </div>

        {/* Live Validation & Scene Summary Breakdown HUD */}
        <div className="px-6 py-3 bg-neutral-950/80 border-t border-neutral-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-cyan-400">troubleshoot</span>
                Live Scene Specification Preview
              </span>
              {parseResult.hasInput && (
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                    parseResult.isValid
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  {parseResult.isValid ? '✓ Valid & Ready' : '⚠ Syntax Error'}
                </span>
              )}
            </div>

            {parseResult.normalizedData?.metadata?.name && (
              <span className="text-xs text-neutral-400 font-semibold truncate max-w-xs">
                {parseResult.normalizedData.metadata.name}
              </span>
            )}
          </div>

          {/* Validation Error Banner */}
          {parseResult.error && (
            <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-sm shrink-0">error</span>
              <span className="font-mono truncate">{parseResult.error}</span>
            </div>
          )}

          {/* Warnings */}
          {parseResult.warnings.length > 0 && (
            <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-800/50 text-amber-300 text-xs flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm shrink-0">warning</span>
              <span className="truncate">{parseResult.warnings[0]}</span>
            </div>
          )}

          {/* Breakdown Pills */}
          {parseResult.stats && parseResult.isValid && (
            <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono">
              <span className="px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/60 text-cyan-300">
                Shapes: {parseResult.stats.shapesCount}
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/60 text-emerald-300">
                Scatter: {parseResult.stats.scatterLayersCount} layers ({parseResult.stats.totalScatterInstances} inst)
              </span>
              <span className="px-2 py-0.5 rounded bg-pink-950/60 border border-pink-800/60 text-pink-300">
                3D Text: {parseResult.stats.textsCount}
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/60 text-amber-300">
                Lights: {parseResult.stats.customLightsCount}
              </span>
              {parseResult.stats.hasParticles && (
                <span className="px-2 py-0.5 rounded bg-purple-950/60 border border-purple-800/60 text-purple-300">
                  Particles: Active
                </span>
              )}
              {parseResult.stats.hasPortal && (
                <span className="px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-800/60 text-indigo-300">
                  Portal: Active
                </span>
              )}
              {parseResult.stats.hasWebsite && (
                <span className="px-2 py-0.5 rounded bg-blue-950/60 border border-blue-800/60 text-blue-300">
                  Website: Active
                </span>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between">
          <div className="text-[11px] text-neutral-500">
            Mode: <span className="font-semibold text-neutral-300 capitalize">{mode}</span> existing elements
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConstruct}
              disabled={!parseResult.isValid}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">build</span>
              <span>Construct 3D Scene</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
