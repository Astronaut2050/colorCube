import { SOUND_MAP } from "./sound-map.js";

function getWx() {
  return typeof wx !== "undefined" ? wx : null;
}

function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function createSoundManager(soundMap = SOUND_MAP) {
  const contexts = new Map();
  const lastPlayedAt = new Map();
  let muted = false;
  let masterVolume = 1;
  let initialized = false;

  function createContext(key) {
    const config = soundMap[key];
    const wxApi = getWx();
    if (!config || !wxApi?.createInnerAudioContext) {
      return null;
    }

    const audio = wxApi.createInnerAudioContext();
    audio.src = config.src;
    audio.volume = (config.volume ?? 1) * masterVolume;
    audio.obeyMuteSwitch = true;
    audio.onError?.((err) => {
      console.warn(`[sound] failed to play ${key}`, err);
    });
    contexts.set(key, audio);
    return audio;
  }

  function preload() {
    if (initialized) {
      return;
    }
    initialized = true;
    Object.keys(soundMap).forEach((key) => createContext(key));
  }

  function getContext(key) {
    return contexts.get(key) || createContext(key);
  }

  function play(key, options = {}) {
    if (muted) {
      return false;
    }

    const config = soundMap[key];
    if (!config) {
      return false;
    }

    const currentTime = now();
    const cooldownMs = options.cooldownMs ?? config.cooldownMs ?? 0;
    const previousTime = lastPlayedAt.get(key) || 0;
    if (currentTime - previousTime < cooldownMs) {
      return false;
    }

    const audio = getContext(key);
    if (!audio) {
      return false;
    }

    lastPlayedAt.set(key, currentTime);
    audio.volume = (options.volume ?? config.volume ?? 1) * masterVolume;

    try {
      audio.stop?.();
      audio.seek?.(0);
      audio.play();
      return true;
    } catch (err) {
      console.warn(`[sound] failed to play ${key}`, err);
      return false;
    }
  }

  function setMuted(value) {
    muted = Boolean(value);
    if (muted) {
      stopAll();
    }
  }

  function setVolume(value) {
    masterVolume = Math.max(0, Math.min(1, Number(value) || 0));
    contexts.forEach((audio, key) => {
      const config = soundMap[key];
      audio.volume = (config?.volume ?? 1) * masterVolume;
    });
  }

  function stopAll() {
    contexts.forEach((audio) => {
      try {
        audio.stop?.();
      } catch (err) {
        console.warn("[sound] failed to stop audio", err);
      }
    });
  }

  function destroy() {
    contexts.forEach((audio) => {
      try {
        audio.destroy?.();
      } catch (err) {
        console.warn("[sound] failed to destroy audio", err);
      }
    });
    contexts.clear();
    lastPlayedAt.clear();
    initialized = false;
  }

  return {
    preload,
    play,
    setMuted,
    setVolume,
    stopAll,
    destroy,
  };
}

