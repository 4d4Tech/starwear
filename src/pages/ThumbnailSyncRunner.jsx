import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { batchUpdateAllAssetThumbnails } from '../utils/modelThumbnailRenderer';

export default function ThumbnailSyncRunner() {
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const addLog = (msg) => {
    console.log(msg);
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  const runSync = async () => {
    setStatus('running');
    addLog('🚀 Starting automated 3D asset thumbnail batch sync...');
    try {
      const res = await batchUpdateAllAssetThumbnails({
        force: true,
        onProgress: (p) => {
          setProgress({ current: p.current, total: p.total });
          addLog(`[${p.current}/${p.total}] Asset "${p.assetId}": ${p.status} ${p.url ? `-> ${p.url}` : ''} ${p.error ? `(Error: ${p.error})` : ''}`);
        }
      });
      setStatus('completed');
      addLog(`✅ Complete! Successfully updated ${res.updated} of ${res.total} asset thumbnails.`);
    } catch (err) {
      setStatus('error');
      addLog(`❌ Error during thumbnail sync: ${err.message}`);
    }
  };

  useEffect(() => {
    runSync();
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-8 font-mono">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-xl font-bold text-cyan-400 mb-2">Star weAR - 3D Asset Thumbnail Sync Runner</h1>
        <p className="text-xs text-neutral-400 mb-4">
          Status: <span className="font-bold text-white uppercase">{status}</span> ({progress.current}/{progress.total})
        </p>

        <div className="bg-black/80 border border-neutral-800 rounded-lg p-4 h-[500px] overflow-y-auto space-y-1.5 text-xs text-neutral-300">
          {logs.map((log, i) => (
            <div key={i} className="leading-relaxed font-mono">{log}</div>
          ))}
          {status === 'running' && (
            <div className="text-cyan-400 animate-pulse">Rendering 3D models and uploading to Firebase Storage...</div>
          )}
        </div>

        <div className="mt-4 flex gap-3">
          <button
            onClick={runSync}
            disabled={status === 'running'}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
          >
            {status === 'running' ? 'Sync In Progress...' : 'Re-Run Thumbnail Sync'}
          </button>
          <a
            href="/admin/inventory"
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-xs font-bold uppercase tracking-wider transition-all inline-block"
          >
            Go to Admin Inventory
          </a>
          <a
            href="/ar-test"
            className="px-4 py-2 bg-indigo-700 hover:bg-indigo-600 text-white rounded text-xs font-bold uppercase tracking-wider transition-all inline-block"
          >
            Go to AR Test
          </a>
        </div>
      </div>
    </div>
  );
}
