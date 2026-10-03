import type { AnalysisProfile, AnalysisResult } from "./melodyAnalyzer";
import type { VisualStyle } from "./renderMusicBox";

const DATABASE_NAME = "orbitone-creator-settings";
const DATABASE_VERSION = 3;
const SETTINGS_STORE = "settings";
const TRACK_SETTINGS_STORE = "track-settings";
const TRACK_MEDIA_STORE = "track-media";
const DEFAULT_SETTINGS_ID = "default";

export type PersistedCustomMazeSkin = {
  blob: Blob;
  name: string;
  width: number;
  height: number;
};

export type PersistedCustomMazeVideo = {
  blob: Blob;
  name: string;
  type: string;
  width: number;
  height: number;
  duration: number;
};

export type PersistedTrackMedia = {
  trackId: string;
  customMazeVideo: PersistedCustomMazeVideo;
  savedAt: number;
};

export type PersistedCreatorSettings = {
  id: typeof DEFAULT_SETTINGS_ID;
  version: 1;
  savedAt: number;
  visualStyle: Omit<VisualStyle, "mazeCustomSkinUrl" | "mazeCustomVideoUrl">;
  analysis: {
    profile: AnalysisProfile;
    sensitivity: number;
    visualSyncMs: number;
  };
  export: {
    autoSaveVideo: boolean;
  };
  editor: {
    manualEditMode: "trigger" | "sound";
    pianoSoundEnabled: boolean;
    pianoVolume: number;
    debugSnapMs: number;
    debugWindowSeconds: number;
    debugPlaybackRate: number;
    debugPreviewOpen: boolean;
    debugPreviewWidth: number;
  };
  customMazeSkin?: PersistedCustomMazeSkin;
};

export type PersistedTrackCreatorSettings = Omit<PersistedCreatorSettings, "id"> & {
  trackId: string;
  trackLabel: string;
  trackState: {
    result: AnalysisResult;
    timingOffsetMs: number;
    hasOfficialScore: boolean;
    debugEditTool: "select" | "draw" | "erase";
    debugExpanded: boolean;
    debugPreviewPosition: { x: number; y: number } | null;
  };
};

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
        database.createObjectStore(SETTINGS_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(TRACK_SETTINGS_STORE)) {
        const store = database.createObjectStore(TRACK_SETTINGS_STORE, { keyPath: "trackId" });
        store.createIndex("savedAt", "savedAt");
      }
      if (!database.objectStoreNames.contains(TRACK_MEDIA_STORE)) {
        database.createObjectStore(TRACK_MEDIA_STORE, { keyPath: "trackId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open creator settings"));
  });
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Creator settings request failed"));
  });
}

export async function loadCreatorSettings(): Promise<PersistedCreatorSettings | null> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(SETTINGS_STORE, "readonly");
    const settings = await requestResult(
      transaction.objectStore(SETTINGS_STORE).get(DEFAULT_SETTINGS_ID),
    ) as PersistedCreatorSettings | undefined;
    return settings?.version === 1 ? settings : null;
  } finally {
    database.close();
  }
}

export async function saveCreatorSettings(
  settings: Omit<PersistedCreatorSettings, "id" | "version">,
) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(SETTINGS_STORE, "readwrite");
    await requestResult(transaction.objectStore(SETTINGS_STORE).put({
      ...settings,
      id: DEFAULT_SETTINGS_ID,
      version: 1,
    } satisfies PersistedCreatorSettings));
  } finally {
    database.close();
  }
}

export async function loadTrackCreatorSettings(trackId: string): Promise<PersistedTrackCreatorSettings | null> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(TRACK_SETTINGS_STORE, "readonly");
    const settings = await requestResult(
      transaction.objectStore(TRACK_SETTINGS_STORE).get(trackId),
    ) as PersistedTrackCreatorSettings | undefined;
    return settings?.version === 1 ? settings : null;
  } finally {
    database.close();
  }
}

export async function saveTrackCreatorSettings(
  settings: Omit<PersistedTrackCreatorSettings, "version">,
) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(TRACK_SETTINGS_STORE, "readwrite");
    await requestResult(transaction.objectStore(TRACK_SETTINGS_STORE).put({
      ...settings,
      version: 1,
    } satisfies PersistedTrackCreatorSettings));
  } finally {
    database.close();
  }
}

export async function removeTrackCreatorSettings(trackId: string) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(TRACK_SETTINGS_STORE, "readwrite");
    await requestResult(transaction.objectStore(TRACK_SETTINGS_STORE).delete(trackId));
  } finally {
    database.close();
  }
}

export async function loadTrackMedia(trackId: string): Promise<PersistedTrackMedia | null> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(TRACK_MEDIA_STORE, "readonly");
    const media = await requestResult(
      transaction.objectStore(TRACK_MEDIA_STORE).get(trackId),
    ) as PersistedTrackMedia | undefined;
    return media ?? null;
  } finally {
    database.close();
  }
}

export async function saveTrackMedia(media: PersistedTrackMedia) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(TRACK_MEDIA_STORE, "readwrite");
    await requestResult(transaction.objectStore(TRACK_MEDIA_STORE).put(media));
  } finally {
    database.close();
  }
}

export async function removeTrackMedia(trackId: string) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(TRACK_MEDIA_STORE, "readwrite");
    await requestResult(transaction.objectStore(TRACK_MEDIA_STORE).delete(trackId));
  } finally {
    database.close();
  }
}
