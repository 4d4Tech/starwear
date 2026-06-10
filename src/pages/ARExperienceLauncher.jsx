import React, { useState } from 'react';
import ARExperience from './ARExperience';

const ARExperienceLauncher = () => {
  const [inputVal, setInputVal] = useState('');
  const [activeBatchId, setActiveBatchId] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputVal.trim()) {
      setActiveBatchId(inputVal.trim());
    }
  };

  // If a batch is active, mount the ARExperience page inline and hide the launcher UI
  if (activeBatchId) {
    return (
      <ARExperience 
        propBatchId={activeBatchId} 
        onBack={() => setActiveBatchId(null)} 
        isTestMode={true}
      />
    );
  }

  return (
    <div className="w-screen min-h-[100dvh] bg-slate-950 text-white font-sans flex flex-col items-center justify-center relative overflow-hidden px-4">
      {/* Decorative Background Glow Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-fuchsia-600/10 rounded-full blur-[100px] pointer-events-none"></div>

      {/* Main Glassmorphic Container */}
      <div className="relative z-10 max-w-md w-full text-center space-y-8 animate-fade-in">
        {/* Glowing Logo / Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-tr from-indigo-500 to-fuchsia-500 rounded-2xl shadow-lg shadow-indigo-500/20 mb-2">
            <span className="material-symbols-outlined text-4xl text-white animate-pulse">
              videocam
            </span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-purple-300 to-fuchsia-300">
            Star weAR
          </h1>
          <p className="text-sm text-slate-400 font-medium tracking-wide">
            Live WebAR Tracking Engine Tester
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 p-8 rounded-2xl shadow-2xl space-y-6">
          <p className="text-xs text-slate-400 leading-relaxed">
            Enter a Batch ID to load the custom 3D model, map local WebGL lights, request camera tracking permission, and run the real-time MindAR detector.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative group">
              <input
                type="text"
                placeholder="Enter Batch ID (e.g. batch_test)"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                className="w-full px-5 py-4 bg-slate-950/80 text-white placeholder-slate-500 border border-slate-800 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-mono text-sm text-center tracking-wider group-hover:border-slate-700"
              />
              <div className="absolute inset-0 rounded-xl border border-indigo-500/0 group-focus-within:border-indigo-500/30 pointer-events-none transition-all"></div>
            </div>

            <button
              type="submit"
              disabled={!inputVal.trim()}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-500 hover:to-fuchsia-500 text-white font-bold uppercase tracking-widest text-xs rounded-xl shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none active:scale-[0.98] transform flex items-center justify-center gap-2"
            >
              <span>Launch AR Experience</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-[10px] text-slate-600 tracking-wider uppercase">
          Powered by MindAR & Three.js Shaders
        </p>
      </div>
    </div>
  );
};

export default ARExperienceLauncher;
