import * as THREE from 'three';
import { rigHumanoidObject, analyzeHumanoidGeometry } from './humanoidRigging';

export class CharacterAnimationManager {
  constructor(studioApp) {
    this.app = studioApp;
    this.currentObject = null;
    this.mixer = null;
    this.activeAction = null;
    this.activeClipName = '';
    this.clips = [];
    this.skeletonHelper = null;

    this.timeScale = 1.0;
    this.isPlaying = true;
    this.isLooping = true;
    this.isScrubbing = false;
    this.armatureVisible = false;

    this.uiBound = false;
  }

  bindUI() {
    if (this.uiBound) return;
    this.uiBound = true;

    // 1. Auto-Rig Humanoid Button
    document.getElementById('btn-add-armature')?.addEventListener('click', () => {
      this.autoRigSelected();
    });

    // 2. Remove Armature Button
    document.getElementById('btn-remove-armature')?.addEventListener('click', () => {
      this.removeArmature();
    });

    // 3. Animation Selector Dropdown
    document.getElementById('anim-clip-select')?.addEventListener('change', (e) => {
      this.playClip(e.target.value);
    });

    // 4. Play / Pause Button
    document.getElementById('btn-anim-play-pause')?.addEventListener('click', () => {
      this.togglePlay();
    });

    // 5. Reset / Replay Button
    document.getElementById('btn-anim-reset')?.addEventListener('click', () => {
      this.resetPlayback();
    });

    // 6. Armature Visibility Toggle
    document.getElementById('toggle-armature-vis')?.addEventListener('change', (e) => {
      this.toggleArmatureVisibility(e.target.checked);
    });

    // 7. Timeline Scrubber Range Input
    const scrubber = document.getElementById('anim-timeline-scrubber');
    if (scrubber) {
      scrubber.addEventListener('input', (e) => {
        this.isScrubbing = true;
        const progress = parseFloat(e.target.value) / 100;
        this.scrubTo(progress);
      });
      scrubber.addEventListener('change', () => {
        this.isScrubbing = false;
      });
    }

    // 8. Speed Buttons
    document.querySelectorAll('.anim-speed-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const speed = parseFloat(e.target.dataset.speed || '1.0');
        this.setSpeed(speed);
      });
    });
  }

  setupForObject(object) {
    this.bindUI();

    if (this.currentObject === object && this.mixer) {
      this.updateUI();
      return;
    }

    this.cleanupCurrent();

    if (!object) {
      this.currentObject = null;
      this.updateUI();
      return;
    }

    this.currentObject = object;

    // Check if object is already rigged (either by our engine or imported from GLB/FBX)
    let isRigged = !!(object.userData?.isHumanoidRigged || object.userData?.skeleton);
    let existingClips = object.userData?.animations || object.animations || [];
    let existingSkeleton = object.userData?.skeleton || null;

    if (!isRigged) {
      // Scan hierarchy for SkinnedMesh
      object.traverse((child) => {
        if (child.isSkinnedMesh) {
          isRigged = true;
          if (child.skeleton) existingSkeleton = child.skeleton;
        }
      });
    }

    if (isRigged || (existingClips && existingClips.length > 0)) {
      this.clips = existingClips;

      // Create AnimationMixer
      this.mixer = new THREE.AnimationMixer(object);

      // Create SkeletonHelper if not present
      if (!this.skeletonHelper && (existingSkeleton || object.userData?.skeletonHelper)) {
        this.skeletonHelper = object.userData?.skeletonHelper || new THREE.SkeletonHelper(object);
        if (this.skeletonHelper.material) {
          this.skeletonHelper.material.linewidth = 2;
          this.skeletonHelper.material.depthTest = false;
          this.skeletonHelper.material.transparent = true;
          this.skeletonHelper.material.opacity = 0.85;
          this.skeletonHelper.material.color.set(0x818cf8);
        }
        this.skeletonHelper.renderOrder = 999;
        this.skeletonHelper.visible = this.armatureVisible;
        this.app.scene.add(this.skeletonHelper);
        this.app.helpers.push(this.skeletonHelper);
      }

      // Play default animation (prefer Idle, or first clip)
      const defaultClip = this.clips.find((c) => c.name.toLowerCase() === 'idle') || this.clips[0];
      if (defaultClip) {
        this.playClip(defaultClip.name, 0);
      }
    }

    this.updateUI();
  }

  autoRigSelected() {
    const obj = this.app.selectedObject;
    if (!obj) {
      alert('Please select a 3D object in the viewport or outliner to add an armature.');
      return;
    }

    if (obj.userData?.isHumanoidRigged) {
      alert('This 3D object is already rigged with a humanoid armature. You can select animation cycles or toggle skeleton view in the inspector.');
      return;
    }

    this.app.setLoadingState('Analyzing Humanoid Geometry & Calculating Bone Hierarchy...', true);
    this.app.updateDiagnostics(`Analyzing humanoid proportions for "${obj.name}"...`);

    setTimeout(() => {
      try {
        const { characterGroup, skeletonHelper, clips, bones } = rigHumanoidObject(obj);

        // Replace original object in scene with rigged character
        const objIndex = this.app.objects.indexOf(obj);
        if (objIndex !== -1) {
          this.app.objects[objIndex] = characterGroup;
        } else {
          this.app.objects.push(characterGroup);
        }

        this.app.scene.remove(obj);
        this.app.scene.add(characterGroup);

        // Add skeleton helper to scene and app helpers list
        if (skeletonHelper) {
          skeletonHelper.visible = this.armatureVisible;
          this.app.scene.add(skeletonHelper);
          this.app.helpers.push(skeletonHelper);
          this.skeletonHelper = skeletonHelper;
        }

        // Setup manager
        this.currentObject = characterGroup;
        this.clips = clips;
        this.mixer = new THREE.AnimationMixer(characterGroup);

        this.app.selectObject(characterGroup);

        // Play Idle by default
        this.playClip('Idle', 0);

        this.app.updateDiagnostics(
          `✅ Humanoid Armature Successfully Added!\n` +
          `Bones: ${bones.length} standard biped joints\n` +
          `Animations: 8 cycles (Idle, Walk, Run, Dance, Wave, Jump, Victory, T-Pose)\n` +
          `Status: Playing "Idle". Use the inspector controls to test cycles or toggle skeleton view.`
        );
      } catch (err) {
        console.error('Rigging error:', err);
        this.app.updateDiagnostics(`Rigging Error: ${err.message}`, true);
        alert(`Could not rig object:\n${err.message}`);
      } finally {
        this.app.setLoadingState('', false);
        this.updateUI();
      }
    }, 60);
  }

  removeArmature() {
    if (!this.currentObject || !this.currentObject.userData?.isHumanoidRigged) return;

    if (!confirm('Remove humanoid armature and revert object to static mesh?')) return;

    this.cleanupCurrent();

    this.currentObject.userData.isHumanoidRigged = false;
    this.currentObject.userData.animations = [];
    delete this.currentObject.userData.skeleton;

    this.app.updateDiagnostics(`Removed humanoid armature from "${this.currentObject.name}".`);
    this.updateUI();
  }

  playClip(clipName, crossFadeDuration = 0.35) {
    if (!this.mixer || !this.clips || this.clips.length === 0) return;

    const clip = this.clips.find((c) => c.name === clipName) || this.clips[0];
    if (!clip) return;

    const newAction = this.mixer.clipAction(clip);
    newAction.setLoop(this.isLooping ? THREE.LoopRepeat : THREE.LoopOnce);
    newAction.clampWhenFinished = !this.isLooping;

    if (this.activeAction && this.activeAction !== newAction) {
      newAction.reset();
      newAction.timeScale = this.isPlaying ? this.timeScale : 0;
      newAction.play();
      this.activeAction.crossFadeTo(newAction, crossFadeDuration, true);
    } else {
      newAction.reset();
      newAction.timeScale = this.isPlaying ? this.timeScale : 0;
      newAction.play();
    }

    this.activeAction = newAction;
    this.activeClipName = clip.name;

    // Update select element if present
    const select = document.getElementById('anim-clip-select');
    if (select) select.value = clip.name;

    this.updateTimelineUI(0, clip.duration);
  }

  togglePlay() {
    this.isPlaying = !this.isPlaying;
    if (this.mixer) {
      this.mixer.timeScale = this.isPlaying ? this.timeScale : 0;
    }
    this.updatePlayPauseButton();
  }

  resetPlayback() {
    if (this.activeAction) {
      this.activeAction.reset();
      this.activeAction.play();
    }
  }

  setSpeed(speed) {
    this.timeScale = speed;
    if (this.mixer && this.isPlaying) {
      this.mixer.timeScale = speed;
    }

    document.querySelectorAll('.anim-speed-btn').forEach((btn) => {
      const bSpeed = parseFloat(btn.dataset.speed || '1.0');
      btn.classList.toggle('bg-indigo-600', bSpeed === speed);
      btn.classList.toggle('text-white', bSpeed === speed);
      btn.classList.toggle('bg-slate-800', bSpeed !== speed);
      btn.classList.toggle('text-slate-300', bSpeed !== speed);
    });

    const badge = document.getElementById('anim-speed-badge');
    if (badge) badge.textContent = `${speed.toFixed(2)}x`;
  }

  scrubTo(ratio) {
    if (!this.activeAction || !this.mixer) return;
    const clip = this.activeAction.getClip();
    if (!clip) return;

    const targetTime = Math.max(0, Math.min(clip.duration, ratio * clip.duration));
    this.activeAction.time = targetTime;
    const prevTimeScale = this.activeAction.timeScale;
    this.activeAction.timeScale = 1;
    this.mixer.update(0.0001);
    this.activeAction.timeScale = this.isPlaying ? this.timeScale : 0;

    this.updateTimelineUI(targetTime, clip.duration);
  }

  toggleArmatureVisibility(visible) {
    this.armatureVisible = visible;
    if (this.skeletonHelper) {
      this.skeletonHelper.visible = visible;
    }
  }

  update(delta) {
    if (this.mixer && this.isPlaying && !this.isScrubbing) {
      this.mixer.update(delta * this.timeScale);

      if (this.activeAction) {
        const clip = this.activeAction.getClip();
        if (clip) {
          const currentTime = this.activeAction.time % clip.duration;
          this.updateTimelineUI(currentTime, clip.duration);
        }
      }
    }
  }

  updateTimelineUI(currentTime, duration) {
    const timeDisplay = document.getElementById('anim-time-display');
    const scrubber = document.getElementById('anim-timeline-scrubber');

    if (timeDisplay && duration > 0) {
      timeDisplay.textContent = `${currentTime.toFixed(2)}s / ${duration.toFixed(2)}s`;
    }

    if (scrubber && duration > 0 && !this.isScrubbing) {
      const progress = Math.min(100, Math.max(0, (currentTime / duration) * 100));
      scrubber.value = progress;
    }
  }

  updatePlayPauseButton() {
    const icon = document.getElementById('anim-play-pause-icon');
    const label = document.getElementById('anim-play-pause-label');

    if (icon) icon.textContent = this.isPlaying ? 'pause' : 'play_arrow';
    if (label) label.textContent = this.isPlaying ? 'Pause' : 'Play';
  }

  updateUI() {
    const section = document.getElementById('armature-animation-section');
    const unriggedBox = document.getElementById('armature-unrigged-box');
    const riggedControls = document.getElementById('armature-rigged-controls');
    const clipSelect = document.getElementById('anim-clip-select');
    const boneCountBadge = document.getElementById('armature-bone-count-badge');
    const statusPill = document.getElementById('armature-status-pill');

    if (!this.currentObject) {
      if (section) section.classList.add('hidden');
      return;
    }

    if (section) section.classList.remove('hidden');

    const isRigged = !!(
      this.currentObject.userData?.isHumanoidRigged ||
      (this.clips && this.clips.length > 0) ||
      this.skeletonHelper
    );

    if (isRigged) {
      if (unriggedBox) unriggedBox.classList.add('hidden');
      if (riggedControls) riggedControls.classList.remove('hidden');

      if (statusPill) {
        statusPill.textContent = 'Rigged Biped';
        statusPill.className = 'text-[9px] bg-emerald-950 border border-emerald-500/40 text-emerald-300 px-1.5 py-0.5 rounded font-mono flex items-center gap-1';
        statusPill.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>Rigged';
      }

      const boneCount = this.currentObject.userData?.boneCount || 19;
      if (boneCountBadge) {
        boneCountBadge.textContent = `${boneCount} Bones`;
      }

      // Populate clip selector
      if (clipSelect) {
        clipSelect.innerHTML = '';
        this.clips.forEach((clip) => {
          const opt = document.createElement('option');
          opt.value = clip.name;
          const icon = this.getClipIcon(clip.name);
          opt.textContent = `${icon} ${clip.name} (${clip.duration.toFixed(1)}s)`;
          if (clip.name === this.activeClipName) opt.selected = true;
          clipSelect.appendChild(opt);
        });
      }

      const visToggle = document.getElementById('toggle-armature-vis');
      if (visToggle) visToggle.checked = this.armatureVisible;

      this.updatePlayPauseButton();
    } else {
      if (unriggedBox) unriggedBox.classList.remove('hidden');
      if (riggedControls) riggedControls.classList.add('hidden');

      if (statusPill) {
        statusPill.textContent = 'Static Mesh';
        statusPill.className = 'text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono';
        statusPill.innerHTML = 'Unrigged';
      }

      // Auto-detect if geometry has humanoid proportions
      const checkHumanoid = analyzeHumanoidGeometry(this.currentObject);
      const hint = document.getElementById('armature-humanoid-hint');
      if (hint) {
        if (checkHumanoid.isLikelyHumanoid) {
          hint.textContent = `Humanoid proportions detected (Height: ${checkHumanoid.height.toFixed(1)}m, ${checkHumanoid.poseType.replace('_', ' ')}). Ready for 1-click auto-rigging.`;
          hint.className = 'text-[10px] text-emerald-400/90 mt-1 font-mono';
        } else {
          hint.textContent = `Model dimensions: ${checkHumanoid.height.toFixed(1)}m x ${checkHumanoid.width.toFixed(1)}m. Can be fitted with standard biped skeleton.`;
          hint.className = 'text-[10px] text-slate-400 mt-1 font-mono';
        }
      }
    }
  }

  getClipIcon(name) {
    const n = name.toLowerCase();
    if (n.includes('idle')) return '🧍';
    if (n.includes('walk')) return '🚶';
    if (n.includes('run')) return '🏃';
    if (n.includes('dance')) return '🕺';
    if (n.includes('wave')) return '👋';
    if (n.includes('jump')) return '🦘';
    if (n.includes('victory') || n.includes('cheer')) return '🏆';
    if (n.includes('t-pose') || n.includes('pose')) return '🧍‍♂️';
    return '🎬';
  }

  getActiveClips() {
    return this.clips || [];
  }

  cleanupCurrent() {
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.mixer.getRoot());
      this.mixer = null;
    }
    if (this.skeletonHelper) {
      this.app.scene.remove(this.skeletonHelper);
      this.app.helpers = this.app.helpers.filter((h) => h !== this.skeletonHelper);
      this.skeletonHelper.dispose?.();
      this.skeletonHelper = null;
    }
    this.activeAction = null;
    this.activeClipName = '';
    this.clips = [];
  }

  destroy() {
    this.cleanupCurrent();
    this.currentObject = null;
    this.app = null;
  }
}
