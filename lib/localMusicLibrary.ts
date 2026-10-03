import type { AnalysisResult } from "./melodyAnalyzer";

const DATABASE_NAME = "orbitone-local-music";
const DATABASE_VERSION = 1;
const PROJECT_STORE = "projects";

export type LocalMusicProject = {
  id: string;
  trackConfigId?: string;
  name: string;
  fileName: string;
  mimeType: string;
  audioBlob: Blob;
  result: AnalysisResult;
  createdAt: number;
  updatedAt: number;
};

export type LocalMusicProjectSummary = Pick<
  LocalMusicProject,
  "id" | "trackConfigId" | "name" | "fileName" | "mimeType" | "createdAt" | "updatedAt"
> & {
  duration: number;
  noteCount: number;
  audioBytes: number;
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
      if (!database.objectStoreNames.contains(PROJECT_STORE)) {
        const store = database.createObjectStore(PROJECT_STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open local music library"));
  });
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Local music library request failed"));
  });
}

export async function listLocalMusicProjects(): Promise<LocalMusicProjectSummary[]> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(PROJECT_STORE, "readonly");
    const projects = await requestResult(transaction.objectStore(PROJECT_STORE).getAll()) as LocalMusicProject[];
    return projects
      .map((project) => ({
        id: project.id,
        trackConfigId: project.trackConfigId,
        name: project.name,
        fileName: project.fileName,
        mimeType: project.mimeType,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        duration: project.result.duration,
        noteCount: project.result.notes.length,
        audioBytes: project.audioBlob.size,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } finally {
    database.close();
  }
}

export async function getLocalMusicProject(id: string): Promise<LocalMusicProject | null> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(PROJECT_STORE, "readonly");
    const project = await requestResult(transaction.objectStore(PROJECT_STORE).get(id)) as LocalMusicProject | undefined;
    return project ?? null;
  } finally {
    database.close();
  }
}

export async function saveLocalMusicProject(project: LocalMusicProject) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(PROJECT_STORE, "readwrite");
    await requestResult(transaction.objectStore(PROJECT_STORE).put(project));
  } finally {
    database.close();
  }
}

export async function removeLocalMusicProject(id: string) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(PROJECT_STORE, "readwrite");
    await requestResult(transaction.objectStore(PROJECT_STORE).delete(id));
  } finally {
    database.close();
  }
}
