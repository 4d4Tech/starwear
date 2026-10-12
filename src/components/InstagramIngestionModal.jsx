/* eslint-disable react/prop-types */
import { useState, useEffect, useCallback } from 'react';
import {
  getInstagramAuthState,
  authenticateInstagram,
  disconnectInstagram,
  fetchInstagramPosts
} from '../services/instagramService';
import { FRAME_FINISHES } from '../utils/instagramFrameRenderer';

export default function InstagramIngestionModal({
  isOpen = false,
  onClose,
  appInstance
}) {
  const [authState, setAuthState] = useState(null);
  const [postLimit, setPostLimit] = useState(5); // Default: 5 posts (up to 8)
  const [posts, setPosts] = useState([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showOAuthDialog, setShowOAuthDialog] = useState(false);
  const [authHandle, setAuthHandle] = useState('starwear.studio');
  const [authMethod, setAuthMethod] = useState('simulated'); // 'simulated' | 'token'
  const [tokenInput, setTokenInput] = useState('');
  const [selectedFinish, setSelectedFinish] = useState('obsidian');
  const [selectedLayout, setSelectedLayout] = useState('arc');
  const [isPullingToScene, setIsPullingToScene] = useState(false);
  const [pullProgress, setPullProgress] = useState('');
  const [errorNotice, setErrorNotice] = useState('');

  // Initialize auth state
  useEffect(() => {
    if (isOpen) {
      const existing = getInstagramAuthState();
      setAuthState(existing);
      if (existing?.user?.username) {
        setAuthHandle(existing.user.username);
      }
    }
  }, [isOpen]);

  // Load preview posts whenever auth or postLimit changes
  const loadPosts = useCallback(async (currentAuth, limit) => {
    if (!currentAuth?.isAuthenticated) return;
    setIsLoadingPosts(true);
    setErrorNotice('');
    try {
      const fetched = await fetchInstagramPosts({ limit, authState: currentAuth });
      setPosts(fetched);
    } catch (err) {
      console.error('Failed to load Instagram posts preview:', err);
      setErrorNotice(err.message || 'Unable to load Instagram media.');
    } finally {
      setIsLoadingPosts(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && authState?.isAuthenticated) {
      loadPosts(authState, postLimit);
    }
  }, [isOpen, authState, postLimit, loadPosts]);

  if (!isOpen) return null;

  // Handler: Start OAuth flow
  const handleStartOAuth = () => {
    setErrorNotice('');
    if (authMethod === 'simulated') {
      setShowOAuthDialog(true);
    } else {
      handleCompleteTokenAuth();
    }
  };

  // Handler: Complete simulated OAuth
  const handleAuthorizeSimulated = async () => {
    setIsAuthenticating(true);
    setErrorNotice('');
    try {
      const res = await authenticateInstagram({
        method: 'simulated',
        username: authHandle
      });
      setAuthState(res);
      setShowOAuthDialog(false);
      await loadPosts(res, postLimit);
    } catch (err) {
      setErrorNotice(err.message || 'Authentication error');
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Handler: Complete Token Auth
  const handleCompleteTokenAuth = async () => {
    if (!tokenInput.trim()) {
      setErrorNotice('Please provide a valid Meta/Instagram Access Token.');
      return;
    }
    setIsAuthenticating(true);
    setErrorNotice('');
    try {
      const res = await authenticateInstagram({
        method: 'token',
        token: tokenInput.trim()
      });
      setAuthState(res);
      await loadPosts(res, postLimit);
    } catch (err) {
      setErrorNotice(err.message || 'Failed to authenticate with token.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Handler: Disconnect Instagram
  const handleDisconnect = () => {
    disconnectInstagram();
    setAuthState(null);
    setPosts([]);
    setErrorNotice('');
  };

  // Handler: Pull Posts into 3D Scene
  const handlePullIntoScene = async () => {
    if (!appInstance) {
      setErrorNotice('3D Studio viewport is not ready.');
      return;
    }
    if (!posts || posts.length === 0) {
      setErrorNotice('No Instagram posts found to pull.');
      return;
    }

    setIsPullingToScene(true);
    setErrorNotice('');

    try {
      setPullProgress(`Creating ${posts.length} 3D frames with ${FRAME_FINISHES[selectedFinish]?.name || selectedFinish}...`);

      if (typeof appInstance.addInstagramFrames === 'function') {
        await appInstance.addInstagramFrames(posts, {
          finish: selectedFinish,
          layout: selectedLayout
        });
      } else {
        throw new Error('StudioApp does not support Instagram frame rendering.');
      }

      onClose();
    } catch (err) {
      console.error('Failed to pull Instagram posts into 3D scene:', err);
      setErrorNotice(err.message || 'Failed to generate 3D frames in the scene.');
    } finally {
      setIsPullingToScene(false);
      setPullProgress('');
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100 font-sans">
        
        {/* Header with Instagram Gradient Sheen */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-purple-950/40 via-pink-950/30 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] flex items-center justify-center shadow-lg shadow-pink-500/20 text-white font-bold">
              <span className="material-symbols-outlined text-2xl">photo_camera</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base tracking-wide text-white">
                  Instagram 3D Gallery Ingestion
                </h3>
                <span className="text-[10px] bg-pink-500/20 text-pink-300 border border-pink-500/30 font-mono px-2 py-0.5 rounded-full font-bold">
                  STUDIO 44
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Authenticate your account and curate live posts directly into 3D picture frames.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 studio-scroll">
          
          {/* Error Banner */}
          {errorNotice && (
            <div className="p-3 bg-red-950/60 border border-red-500/40 rounded-xl text-red-200 text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-red-400">error</span>
              <span>{errorNotice}</span>
            </div>
          )}

          {/* STEP 1: AUTHENTICATION SECTION */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 flex items-center justify-center text-[11px] font-mono font-bold">
                  1
                </span>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Instagram Account Authentication
                </h4>
              </div>
              {authState?.isAuthenticated && (
                <span className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2.5 py-0.5 rounded-full font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  CONNECTED
                </span>
              )}
            </div>

            {/* Authenticated State Display */}
            {authState?.isAuthenticated ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 border border-slate-700/60 rounded-xl p-3 sm:p-4">
                <div className="flex items-center gap-3">
                  <img
                    src={authState.user?.profilePic}
                    alt={authState.user?.username}
                    className="w-12 h-12 rounded-full object-cover border-2 border-pink-500/50 shadow-md"
                  />
                  <div>
                    <div className="font-bold text-sm text-white flex items-center gap-1.5">
                      <span>@{authState.user?.username}</span>
                      <span className="material-symbols-outlined text-xs text-sky-400">verified</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {authState.user?.accountType || 'CREATOR'} • {authState.user?.followers || '42k'} followers
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => loadPosts(authState, postLimit)}
                    disabled={isLoadingPosts}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span className={`material-symbols-outlined text-sm ${isLoadingPosts ? 'animate-spin' : ''}`}>
                      sync
                    </span>
                    <span>Refresh Feed</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="px-3 py-1.5 bg-red-950/40 hover:bg-red-900/50 text-red-300 text-xs font-semibold rounded-lg border border-red-500/30 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ) : (
              /* Unauthenticated Login & Authorization Options */
              <div className="space-y-3">
                <div className="flex gap-2 p-1 bg-slate-900 rounded-lg border border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setAuthMethod('simulated')}
                    className={`flex-1 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                      authMethod === 'simulated'
                        ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-amber-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    One-Click OAuth Connect (Creator Profile)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMethod('token')}
                    className={`flex-1 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                      authMethod === 'token'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Live Meta Access Token
                  </button>
                </div>

                {authMethod === 'simulated' ? (
                  <div className="space-y-3 pt-1">
                    <p className="text-xs text-slate-400">
                      Connect your brand or creator profile to authorize Studio4D4 to fetch your recent editorial media and compile them into 3D frames.
                    </p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">
                          @
                        </span>
                        <input
                          type="text"
                          value={authHandle}
                          onChange={(e) => setAuthHandle(e.target.value)}
                          placeholder="your_instagram_handle"
                          className="w-full pl-7 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono focus:border-pink-500 focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleStartOAuth}
                        disabled={isAuthenticating}
                        className="px-4 py-2 bg-gradient-to-r from-purple-600 via-pink-600 to-amber-600 hover:opacity-90 text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-sm">login</span>
                        <span>Authorize Studio44</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    <p className="text-xs text-slate-400">
                      Enter a User Access Token generated from Meta Developer Portal (Instagram Basic Display / Graph API).
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        placeholder="IGQVJ..."
                        className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono focus:border-indigo-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleStartOAuth}
                        disabled={isAuthenticating}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-sm">key</span>
                        <span>Connect Token</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* STEP 2: POST LIMIT CONFIGURATION (Default: 5, Max: 8) */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-pink-500/20 text-pink-400 border border-pink-500/40 flex items-center justify-center text-[11px] font-mono font-bold">
                  2
                </span>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Media Limit & Ingestion Capacity
                </h4>
              </div>
              <span className="text-xs font-mono font-bold text-pink-400 bg-pink-950/50 border border-pink-500/30 px-2.5 py-0.5 rounded-full">
                {postLimit} of 8 Posts
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Studio44 automatically pulls in your latest <strong className="text-white">5 posts/photos by default</strong>, with the option to customize up to <strong className="text-white">8 posts/images</strong>.
            </p>

            {/* Quick Limit Preset Chips */}
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => {
                const isSelected = postLimit === num;
                const isDefault = num === 5;
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setPostLimit(num)}
                    className={`py-2 px-1 rounded-xl text-xs font-bold font-mono transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-b from-pink-600 to-purple-600 text-white ring-2 ring-pink-400/50 shadow-md scale-105'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                    }`}
                  >
                    <span className="text-sm">{num}</span>
                    <span className="text-[9px] text-slate-400 font-sans">
                      {isDefault ? 'Default' : num === 8 ? 'Max' : 'Posts'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Range Slider for Fine Adjustment */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                <span>1 Post (Minimalist)</span>
                <span className="text-pink-300 font-bold">5 Posts (Studio Default)</span>
                <span>8 Posts (Maximum Gallery)</span>
              </div>
              <input
                type="range"
                min="1"
                max="8"
                step="1"
                value={postLimit}
                onChange={(e) => setPostLimit(parseInt(e.target.value, 10))}
                className="w-full accent-pink-500 cursor-pointer"
              />
            </div>
          </div>

          {/* STEP 3: 3D FRAME STYLING & GALLERY LAYOUT */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/40 flex items-center justify-center text-[11px] font-mono font-bold">
                3
              </span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Frame Material Finish & Exhibition Layout
              </h4>
            </div>

            {/* Frame Finish Selector */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {Object.entries(FRAME_FINISHES).map(([key, f]) => {
                const isSelected = selectedFinish === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedFinish(key)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-20 ${
                      isSelected
                        ? 'border-pink-500 bg-pink-950/30 ring-1 ring-pink-500'
                        : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                    }`}
                  >
                    <div
                      className="w-5 h-5 rounded-full border border-white/20 shadow-inner"
                      style={{ backgroundColor: `#${f.color.toString(16).padStart(6, '0')}` }}
                    />
                    <div>
                      <div className="text-[11px] font-bold text-white leading-tight">{f.name}</div>
                      <div className="text-[9px] text-slate-400">PBR {f.metalness > 0.5 ? 'Metallic' : 'Lacquer'}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Layout Arrangement Selector */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'arc', name: 'Curved Gallery Arc', icon: 'view_carousel', desc: 'Exhibition curve' },
                { id: 'linear', name: 'Linear Showcase', icon: 'view_column', desc: 'Horizontal wall' },
                { id: 'grid', name: 'Studio Matrix', icon: 'grid_view', desc: 'Tiered gallery wall' }
              ].map((layout) => (
                <button
                  key={layout.id}
                  type="button"
                  onClick={() => setSelectedLayout(layout.id)}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                    selectedLayout === layout.id
                      ? 'border-indigo-500 bg-indigo-950/40 text-white'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">{layout.icon}</span>
                  <span className="text-[11px] font-bold">{layout.name}</span>
                  <span className="text-[9px] text-slate-400">{layout.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* STEP 4: LIVE POSTS PREVIEW */}
          {posts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-bold text-slate-300">
                  Ready to pull {posts.length} {posts.length === 1 ? 'post' : 'posts'} into 3D frames:
                </span>
                <span className="font-mono text-[11px] text-pink-400">
                  1 to {posts.length} of {postLimit} loaded
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {posts.slice(0, postLimit).map((p, idx) => (
                  <div
                    key={p.id || idx}
                    className="group relative aspect-[4/5] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-sm"
                  >
                    <img
                      src={p.imageUrl}
                      alt={p.caption}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-2.5 flex flex-col justify-between opacity-90 group-hover:opacity-100 transition-opacity">
                      <div className="flex justify-between items-start">
                        <span className="px-1.5 py-0.5 rounded bg-black/70 text-white font-mono text-[9px] font-bold">
                          #{idx + 1}
                        </span>
                        <span className="text-[9px] font-mono text-pink-300">
                          {p.aspectRatio || '4:5'}
                        </span>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-200 line-clamp-2 leading-tight">
                          {p.caption || 'Instagram Post'}
                        </p>
                        <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono mt-1">
                          <span>❤️ {p.likes || '4k'}</span>
                          <span>{p.timestamp || 'Recent'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400 font-mono">
            {isPullingToScene ? (
              <span className="text-pink-400 flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-pink-400 border-t-transparent rounded-full animate-spin"></span>
                <span>{pullProgress || 'Constructing 3D picture frames...'}</span>
              </span>
            ) : authState?.isAuthenticated ? (
              <span>Ready: Pulling {posts.length} {posts.length === 1 ? 'post' : 'posts'} ({FRAME_FINISHES[selectedFinish]?.name})</span>
            ) : (
              <span>Authorize account above to proceed</span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isPullingToScene}
              className="flex-1 sm:flex-none py-2 px-4 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {authState?.isAuthenticated ? (
              <button
                type="button"
                onClick={handlePullIntoScene}
                disabled={isPullingToScene || posts.length === 0}
                className="flex-1 sm:flex-none py-2.5 px-6 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-600 hover:opacity-95 text-white text-xs font-bold shadow-lg shadow-pink-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">view_in_ar</span>
                <span>Pull {posts.length} Posts into 3D Scene</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartOAuth}
                disabled={isAuthenticating}
                className="flex-1 sm:flex-none py-2.5 px-6 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-600 hover:opacity-95 text-white text-xs font-bold shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">login</span>
                <span>Authenticate & Ingest</span>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Simulated Instagram Meta OAuth Permission Modal */}
      {showOAuthDialog && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="bg-white text-slate-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-5">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] flex items-center justify-center text-white shadow-lg shadow-pink-500/30">
                <span className="material-symbols-outlined text-3xl">photo_camera</span>
              </div>
              <h4 className="font-bold text-lg text-slate-900">
                Authorize Studio 4D4
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                <strong>Star weAR Studio 44</strong> is requesting permission to access your Instagram profile:
              </p>
              <div className="p-2 bg-slate-100 rounded-lg text-xs font-mono font-bold text-slate-700">
                @{authHandle || 'starwear.studio'}
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-sm">check_circle</span>
                <span>Access your profile info (username, bio)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-sm">check_circle</span>
                <span>Read your media (photos, captions, timestamps)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-sm">check_circle</span>
                <span>Generate 3D picture frame textures in browser</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={handleAuthorizeSimulated}
                disabled={isAuthenticating}
                className="w-full py-2.5 bg-gradient-to-r from-purple-600 via-pink-600 to-amber-600 hover:opacity-95 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isAuthenticating ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>Allow & Authorize Studio4D4</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowOAuthDialog(false)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
