"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  analyzeMelody,
  type AnalysisCandidate,
  type AnalysisProfile,
  type AnalysisResult,
  type MelodyNote,
} from "../lib/melodyAnalyzer";
import { refinePianoOnsets } from "../lib/pianoOnsetAnalyzer";
import { scheduleSynthPianoNote } from "../lib/synthPiano";
import { exportOfflineVideo, isOfflineExportSupported } from "../lib/offlineExport";
import {
  getLocalMusicProject,
  listLocalMusicProjects,
  removeLocalMusicProject,
  saveLocalMusicProject,
  type LocalMusicProjectSummary,
} from "../lib/localMusicLibrary";
import {
  loadCreatorSettings,
  loadTrackCreatorSettings,
  loadTrackMedia,
  removeTrackMedia,
  removeTrackCreatorSettings,
  saveCreatorSettings,
  saveTrackMedia,
  saveTrackCreatorSettings,
  type PersistedCreatorSettings,
  type PersistedTrackCreatorSettings,
  type PersistedTrackMedia,
} from "../lib/creatorSettings";
import {
  renderMusicBox,
  type ImpactEffect,
  type LayoutTemplate,
  type LabelMode,
  type MazeSkin,
  type MazeShape,
  type MazeTrailStyle,
  type MazeImpactEffect,
  type MazeFillMode,
  type SceneTheme,
  type SquareColorMode,
  type VisualStyle,
} from "../lib/renderMusicBox";

type SampleTrack = {
  name: string;
  description: string;
  url: string;
  scoreUrl: string;
  accent: "cyan" | "pink" | "gold";
  sourceLabel?: string;
  sourceUrl?: string;
  usageNote?: string;
};

const SAMPLE_TRACKS: readonly SampleTrack[] = [
  {
    name: "星光八音盒",
    description: "舒缓 · 单音旋律 · 10s",
    url: "/samples/starlight.mp3",
    scoreUrl: "/samples/starlight.json",
    accent: "cyan",
  },
  {
    name: "霓虹疾跑",
    description: "快节奏 · 连续弹跳 · 7s",
    url: "/samples/neon-run.mp3",
    scoreUrl: "/samples/neon-run.json",
    accent: "pink",
  },
  {
    name: "月面漂流",
    description: "空灵 · 长音组合 · 13s",
    url: "/samples/moon-drift.mp3",
    scoreUrl: "/samples/moon-drift.json",
    accent: "gold",
  },
  {
    name: "夏日副歌",
    description: "原创流行 · 切分旋律 · 13s",
    url: "/samples/summer-hook.mp3",
    scoreUrl: "/samples/summer-hook.json",
    accent: "cyan",
  },
  {
    name: "城市心跳",
    description: "原创流行 · 快速钢琴 · 15s",
    url: "/samples/city-heartbeat.mp3",
    scoreUrl: "/samples/city-heartbeat.json",
    accent: "pink",
  },
  {
    name: "雨夜告白",
    description: "原创抒情 · 延音钢琴 · 18s",
    url: "/samples/rain-confession.mp3",
    scoreUrl: "/samples/rain-confession.json",
    accent: "gold",
  },
  {
    name: "极速星键",
    description: "原创测试 · 密集钢琴触键 · 11s",
    url: "/samples/rapid-star-keys.mp3",
    scoreUrl: "/samples/rapid-star-keys.json",
    accent: "pink",
  },
  {
    name: "仙途回响",
    description: "原创古风 · 清晰钢琴主旋律 · 19s",
    url: "/samples/immortal-echo.mp3",
    scoreUrl: "/samples/immortal-echo.json",
    accent: "gold",
  },
  {
    name: "棱镜急行",
    description: "原创高速切分 · 96 个折返落点 · 21s",
    url: "/samples/prism-rush.mp3",
    scoreUrl: "/samples/prism-rush.json",
    accent: "cyan",
    sourceLabel: "科学羊 / ORBITONE 本地合成",
    usageNote: "原创测试音乐 · 推荐搭配方块迷宫",
  },
  {
    name: "折返脉冲",
    description: "原创律动 · 强弱交错 · 25s",
    url: "/samples/switchback-groove.mp3",
    scoreUrl: "/samples/switchback-groove.json",
    accent: "pink",
    sourceLabel: "科学羊 / ORBITONE 本地合成",
    usageNote: "原创测试音乐 · 每小节路线节奏不同",
  },
  {
    name: "玻璃三连",
    description: "原创三连音 · 玻璃音色 · 24s",
    url: "/samples/glass-triplets.mp3",
    scoreUrl: "/samples/glass-triplets.json",
    accent: "gold",
    sourceLabel: "科学羊 / ORBITONE 本地合成",
    usageNote: "原创测试音乐 · 连续弹墙手感",
  },
];

type SampleScore = {
  bpm: number;
  lead_in_seconds: number;
  notes: Array<{ pitch: number; beat: number; duration: number }>;
};

type EditableScoreFile = {
  format: "orbitone-music-score";
  version: 2;
  title?: string;
  duration?: number;
  notes: Array<{
    time: number;
    duration?: number;
    pitch?: number;
    velocity?: number;
  }>;
};

type DebugEditTool = "select" | "draw" | "erase";
type ManualEditMode = "trigger" | "sound";

type DebugSelectionRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type DebugNoteDrag = {
  pointerId: number;
  note: MelodyNote;
  mode: "move" | "resize";
  pointerTime: number;
  pointerPitch: number;
  startTime: number;
  startPitch: number;
  startDuration: number;
  moved: boolean;
  created: boolean;
};

type DebugMarqueeDrag = {
  pointerId: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  time: number;
  pitch: number;
  moved: boolean;
};

type DebugUndoSnapshot = {
  result: AnalysisResult;
  timingOffsetMs: number;
};

const INITIAL_NOTES: MelodyNote[] = [
  { time: 0.6, duration: 0.5, pitch: 60, confidence: 1, velocity: 0.8 },
  { time: 1.1, duration: 0.5, pitch: 64, confidence: 1, velocity: 0.8 },
  { time: 1.6, duration: 0.5, pitch: 67, confidence: 1, velocity: 0.85 },
  { time: 2.1, duration: 0.5, pitch: 72, confidence: 1, velocity: 1 },
  { time: 2.6, duration: 0.5, pitch: 69, confidence: 1, velocity: 0.9 },
  { time: 3.1, duration: 0.5, pitch: 67, confidence: 1, velocity: 0.8 },
  { time: 3.6, duration: 0.8, pitch: 64, confidence: 1, velocity: 0.75 },
  { time: 4.4, duration: 0.8, pitch: 60, confidence: 1, velocity: 0.75 },
];

const INITIAL_RESULT: AnalysisResult = {
  notes: INITIAL_NOTES,
  duration: 5.4,
  keyLabel: "C 调感",
  tempo: 120,
  quality: "high",
};

const DEFAULT_DEBUG_PREVIEW_WIDTH = 420;
const MAX_DEBUG_PREVIEW_WIDTH = 500;
const MANUAL_TRIGGER_DEDUPE_SECONDS = 0.018;
const MAX_DEBUG_UNDO_STEPS = 40;

const formatTime = (seconds: number) => {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safe / 60);
  const remainder = Math.floor(safe % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

const qualityText = {
  high: "旋律清晰",
  medium: "可用草稿",
  exploratory: "建议手动精简",
} as const;

const EXPORT_RESOLUTIONS = {
  smooth: { width: 540, height: 960, bitrate: 6_000_000 },
  balanced: { width: 720, height: 1280, bitrate: 9_000_000 },
  ultra: { width: 1080, height: 1920, bitrate: 14_000_000 },
} as const;

type ExportResolution = keyof typeof EXPORT_RESOLUTIONS;

const profileText: Record<AnalysisProfile, string> = {
  balanced: "综合旋律",
  piano: "钢琴重音",
  rhythm: "节奏强拍",
};

const withoutModelOnlyNotes = (analysis: AnalysisResult): AnalysisResult => ({
  ...analysis,
  notes: analysis.notes.filter((note) => note.source !== "model"),
});

const noteName = (pitch: number) => {
  const names = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  return `${names[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
};

const importedTrackConfigId = (file: File) =>
  `import:${encodeURIComponent(file.name)}:${file.size}:${file.lastModified}`;

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const debugPreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const timelineCanvasRef = useRef<HTMLCanvasElement>(null);
  const debugCanvasRef = useRef<HTMLCanvasElement>(null);
  const debugConsoleRef = useRef<HTMLElement>(null);
  const stylePanelRef = useRef<HTMLElement>(null);
  const debugPreviewCardRef = useRef<HTMLDivElement>(null);
  const debugPreviewDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const debugPreviewResizeRef = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
    maxWidth: number;
  } | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const configInputRef = useRef<HTMLInputElement>(null);
  const scoreInputRef = useRef<HTMLInputElement>(null);
  const customSkinInputRef = useRef<HTMLInputElement>(null);
  const customVideoInputRef = useRef<HTMLInputElement>(null);
  const animationRef = useRef<number | null>(null);
  const currentTimeRef = useRef(0);
  const lastUiUpdateRef = useRef(0);
  const exportAudioRef = useRef<HTMLAudioElement | null>(null);
  const decodedBufferRef = useRef<AudioBuffer | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const currentAudioBlobRef = useRef<Blob | null>(null);
  const currentLibraryCreatedAtRef = useRef(0);
  const customMazeSkinUrlRef = useRef<string | null>(null);
  const customMazeVideoUrlRef = useRef<string | null>(null);
  const lastPersistedVideoKeyRef = useRef<string | null>(null);
  const creatorSettingsHydratedRef = useRef(false);
  const trackSettingsHydratedRef = useRef(false);
  const currentTrackConfigIdRef = useRef<string | null>(null);
  const trackSettingsLoadTokenRef = useRef(0);
  const defaultLoadedRef = useRef(false);
  const notesRef = useRef<MelodyNote[]>(INITIAL_RESULT.notes);
  const durationRef = useRef(INITIAL_RESULT.duration);
  const analysisProfileRef = useRef<AnalysisProfile>("piano");
  const sensitivityRef = useRef(68);
  const visualSyncMsRef = useRef(28);
  const pianoAudioContextRef = useRef<AudioContext | null>(null);
  const pianoMasterGainRef = useRef<GainNode | null>(null);
  const pianoSoundEnabledRef = useRef(true);
  const pianoVolumeRef = useRef(38);
  const lastPianoMediaTimeRef = useRef(0);
  const timelineDragRef = useRef<{
    pointerId: number;
    note: MelodyNote;
    moved: boolean;
  } | null>(null);
  const debugNoteDragRef = useRef<DebugNoteDrag | null>(null);
  const debugMarqueeDragRef = useRef<DebugMarqueeDrag | null>(null);
  const debugUndoStackRef = useRef<DebugUndoSnapshot[]>([]);
  const styleRef = useRef<VisualStyle>({
    layoutTemplate: "square-maze",
    labelMode: "solfege",
    theme: "nebula",
    meteorIntensity: 72,
    impactEffect: "prismatic",
    impactIntensity: 82,
    ballSize: 100,
    showSceneText: true,
    showBranding: true,
    mazeSkin: "crimson",
    mazeCustomSkinUrl: "",
    mazeCustomVideoUrl: "",
    squareColorMode: "rainbow",
    mazeShape: "square",
    mazeObjectSize: 44,
    mazeEdgeColor: "#65eaff",
    mazeTrailColor: "#ff5ccf",
    mazeSquareColor: "#ff5ccf",
    mazeTrailStyle: "aurora",
    mazeStrokeWidth: 2,
    mazeGlowIntensity: 42,
    mazeFillMode: "half",
    mazeImpactEffect: "prismatic",
    mazeTrailLength: 230,
    mazeTrailWidth: 20,
    mazeEffectBpm: 124,
    mazeEffectIntensity: 100,
    mazeBloom: true,
    mazeShake: true,
    mazeHitstop: false,
    mazeBackgroundGrid: true,
  });

  const [result, setResult] = useState<AnalysisResult>(INITIAL_RESULT);
  const [audioUrl, setAudioUrl] = useState("");
  const [fileName, setFileName] = useState("等待导入音乐");
  const [status, setStatus] = useState<"idle" | "analyzing" | "ready" | "error">("idle");
  const [stage, setStage] = useState("上传一首音乐，或先试试样本");
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [samplesExpanded, setSamplesExpanded] = useState(false);
  const [analysisProfile, setAnalysisProfile] = useState<AnalysisProfile>("piano");
  const [sensitivity, setSensitivity] = useState(68);
  const [layoutTemplate, setLayoutTemplate] = useState<LayoutTemplate>("square-maze");
  const [labelMode, setLabelMode] = useState<LabelMode>("solfege");
  const [theme, setTheme] = useState<SceneTheme>("nebula");
  const [meteorIntensity, setMeteorIntensity] = useState(72);
  const [impactEffect, setImpactEffect] = useState<ImpactEffect>("prismatic");
  const [impactIntensity, setImpactIntensity] = useState(82);
  const [ballSize, setBallSize] = useState(100);
  const [showSceneText, setShowSceneText] = useState(true);
  const [showBranding, setShowBranding] = useState(true);
  const [mazeSkin, setMazeSkin] = useState<MazeSkin>("crimson");
  const [customMazeSkin, setCustomMazeSkin] = useState<{ url: string; name: string; width: number; height: number } | null>(null);
  const [customMazeVideo, setCustomMazeVideo] = useState<{
    url: string;
    name: string;
    type: string;
    width: number;
    height: number;
    duration: number;
    blob: Blob;
  } | null>(null);
  const [squareColorMode, setSquareColorMode] = useState<SquareColorMode>("rainbow");
  const [mazeShape, setMazeShape] = useState<MazeShape>("square");
  const [mazeObjectSize, setMazeObjectSize] = useState(44);
  const [mazeEdgeColor, setMazeEdgeColor] = useState("#65eaff");
  const [mazeTrailColor, setMazeTrailColor] = useState("#ff5ccf");
  const [mazeSquareColor, setMazeSquareColor] = useState("#ff5ccf");
  const [mazeTrailStyle, setMazeTrailStyle] = useState<MazeTrailStyle>("aurora");
  const [mazeStrokeWidth, setMazeStrokeWidth] = useState(2);
  const [mazeGlowIntensity, setMazeGlowIntensity] = useState(42);
  const [mazeFillMode, setMazeFillMode] = useState<MazeFillMode>("half");
  const [mazeImpactEffect, setMazeImpactEffect] = useState<MazeImpactEffect>("prismatic");
  const [mazeTrailLength, setMazeTrailLength] = useState(230);
  const [mazeTrailWidth, setMazeTrailWidth] = useState(20);
  const [mazeEffectBpm, setMazeEffectBpm] = useState(124);
  const [mazeEffectIntensity, setMazeEffectIntensity] = useState(100);
  const [mazeBloom, setMazeBloom] = useState(true);
  const [mazeShake, setMazeShake] = useState(true);
  const [mazeHitstop, setMazeHitstop] = useState(false);
  const [mazeBackgroundGrid, setMazeBackgroundGrid] = useState(true);
  const [autoSaveVideo, setAutoSaveVideo] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportResolution, setExportResolution] = useState<ExportResolution>("balanced");
  const [exportMode, setExportMode] = useState<"frame" | "realtime">("frame");
  const [exportProgress, setExportProgress] = useState(0);
  const [hasOfficialScore, setHasOfficialScore] = useState(false);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [debugWindowSeconds, setDebugWindowSeconds] = useState(16);
  const [debugExpanded, setDebugExpanded] = useState(false);
  const [debugPreviewOpen, setDebugPreviewOpen] = useState(true);
  const [debugPreviewPosition, setDebugPreviewPosition] = useState<{ x: number; y: number } | null>(null);
  const [debugPreviewWidth, setDebugPreviewWidth] = useState(DEFAULT_DEBUG_PREVIEW_WIDTH);
  const modelPointsMuted = true;
  const [debugPlaybackRate, setDebugPlaybackRate] = useState(1);
  const [visualSyncMs, setVisualSyncMs] = useState(28);
  const [selectedNoteIndex, setSelectedNoteIndex] = useState<number | null>(null);
  const [selectedNoteIndices, setSelectedNoteIndices] = useState<number[]>([]);
  const [timingOffsetMs, setTimingOffsetMs] = useState(0);
  const [manualEditMode, setManualEditMode] = useState<ManualEditMode>("trigger");
  const [pianoSoundEnabled, setPianoSoundEnabled] = useState(true);
  const [pianoVolume, setPianoVolume] = useState(38);
  const [manualTimesInput, setManualTimesInput] = useState("");
  const [debugEditTool, setDebugEditTool] = useState<DebugEditTool>("select");
  const [debugSnapMs, setDebugSnapMs] = useState(10);
  const [debugSelectionRect, setDebugSelectionRect] = useState<DebugSelectionRect | null>(null);
  const [debugUndoCount, setDebugUndoCount] = useState(0);
  const [localMusicProjects, setLocalMusicProjects] = useState<LocalMusicProjectSummary[]>([]);
  const [currentLibraryId, setCurrentLibraryId] = useState<string | null>(null);
  const [currentTrackConfigId, setCurrentTrackConfigId] = useState<string | null>(null);
  const [currentTrackLabel, setCurrentTrackLabel] = useState("");
  const [localLibraryBusy, setLocalLibraryBusy] = useState(false);
  const [localSaveState, setLocalSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [creatorSettingsState, setCreatorSettingsState] = useState<"loading" | "idle" | "saving" | "saved" | "error">("loading");
  const [creatorSettingsSavedAt, setCreatorSettingsSavedAt] = useState<number | null>(null);

  const visualStyle = useMemo<VisualStyle>(
    () => ({
      layoutTemplate,
      labelMode,
      theme,
      meteorIntensity,
      impactEffect,
      impactIntensity,
      ballSize,
      showSceneText,
      showBranding,
      mazeSkin,
      mazeCustomSkinUrl: customMazeSkin?.url ?? "",
      mazeCustomVideoUrl: customMazeVideo?.url ?? "",
      squareColorMode,
      mazeShape,
      mazeObjectSize,
      mazeEdgeColor,
      mazeTrailColor,
      mazeSquareColor,
      mazeTrailStyle,
      mazeStrokeWidth,
      mazeGlowIntensity,
      mazeFillMode,
      mazeImpactEffect,
      mazeTrailLength,
      mazeTrailWidth,
      mazeEffectBpm,
      mazeEffectIntensity,
      mazeBloom,
      mazeShake,
      mazeHitstop,
      mazeBackgroundGrid,
    }),
    [layoutTemplate, labelMode, theme, meteorIntensity, impactEffect, impactIntensity, ballSize, showSceneText, showBranding, mazeSkin, customMazeSkin, customMazeVideo, squareColorMode, mazeShape, mazeObjectSize, mazeEdgeColor, mazeTrailColor, mazeSquareColor, mazeTrailStyle, mazeStrokeWidth, mazeGlowIntensity, mazeFillMode, mazeImpactEffect, mazeTrailLength, mazeTrailWidth, mazeEffectBpm, mazeEffectIntensity, mazeBloom, mazeShake, mazeHitstop, mazeBackgroundGrid],
  );

  const applyVisualStyle = useCallback((style: Partial<VisualStyle>) => {
    if (["orbit", "kinetic", "square-maze"].includes(style.layoutTemplate ?? "")) setLayoutTemplate(style.layoutTemplate!);
    if (["solfege", "note", "symbol"].includes(style.labelMode ?? "")) setLabelMode(style.labelMode!);
    if (["nebula", "aurora", "solar"].includes(style.theme ?? "")) setTheme(style.theme!);
    if (["cartoon", "firework", "neon", "explosion", "shatter", "lightning", "prismatic"].includes(style.impactEffect ?? "")) setImpactEffect(style.impactEffect!);
    if (["midnight", "aurora", "sunset", "crimson", "blueprint", "comic", "anime", "candy", "cyber", "ink", "cosmic", "voyage", "monster", "custom"].includes(style.mazeSkin ?? "")) setMazeSkin(style.mazeSkin!);
    if (["rainbow", "red", "yellow", "cyan", "pink", "violet", "green", "orange", "white", "custom"].includes(style.squareColorMode ?? "")) setSquareColorMode(style.squareColorMode!);
    if (["square", "circle", "diamond", "hexagon", "star", "heart", "note", "moon", "sparkle", "clover", "droplet"].includes(style.mazeShape ?? "")) setMazeShape(style.mazeShape!);
    if (["meteor", "ribbon", "comet", "spark", "firework", "aurora", "prism", "twist", "helix", "dissolve", "wave"].includes(style.mazeTrailStyle ?? "")) setMazeTrailStyle(style.mazeTrailStyle!);
    if (["prismatic", "cartoon", "neon", "explosion", "shatter", "lightning", "firework", "vfx-nova", "vfx-star", "vfx-shatter", "vfx-ripple", "vfx-confetti", "vfx-combo"].includes(style.mazeImpactEffect ?? "")) setMazeImpactEffect(style.mazeImpactEffect!);
    if (["outline", "half", "solid"].includes(style.mazeFillMode ?? "")) setMazeFillMode(style.mazeFillMode!);
    if (typeof style.meteorIntensity === "number") setMeteorIntensity(clamp(style.meteorIntensity, 0, 100));
    if (typeof style.impactIntensity === "number") setImpactIntensity(clamp(style.impactIntensity, 20, 100));
    if (typeof style.ballSize === "number") setBallSize(clamp(style.ballSize, 60, 160));
    if (typeof style.mazeObjectSize === "number") setMazeObjectSize(clamp(style.mazeObjectSize, 24, 78));
    if (typeof style.mazeStrokeWidth === "number") setMazeStrokeWidth(clamp(style.mazeStrokeWidth, 0.5, 8));
    if (typeof style.mazeGlowIntensity === "number") setMazeGlowIntensity(clamp(style.mazeGlowIntensity, 0, 100));
    if (typeof style.mazeTrailLength === "number") setMazeTrailLength(clamp(style.mazeTrailLength, 90, 480));
    if (typeof style.mazeTrailWidth === "number") setMazeTrailWidth(clamp(style.mazeTrailWidth, 8, 38));
    if (typeof style.mazeEffectBpm === "number") setMazeEffectBpm(clamp(style.mazeEffectBpm, 70, 200));
    if (typeof style.mazeEffectIntensity === "number") setMazeEffectIntensity(clamp(style.mazeEffectIntensity, 50, 180));
    if (typeof style.showSceneText === "boolean") setShowSceneText(style.showSceneText);
    if (typeof style.showBranding === "boolean") setShowBranding(style.showBranding);
    if (typeof style.mazeBloom === "boolean") setMazeBloom(style.mazeBloom);
    if (typeof style.mazeShake === "boolean") setMazeShake(style.mazeShake);
    if (typeof style.mazeHitstop === "boolean") setMazeHitstop(style.mazeHitstop);
    if (typeof style.mazeBackgroundGrid === "boolean") setMazeBackgroundGrid(style.mazeBackgroundGrid);
    if (typeof style.mazeEdgeColor === "string" && /^#[0-9a-f]{6}$/i.test(style.mazeEdgeColor)) setMazeEdgeColor(style.mazeEdgeColor);
    if (typeof style.mazeTrailColor === "string" && /^#[0-9a-f]{6}$/i.test(style.mazeTrailColor)) setMazeTrailColor(style.mazeTrailColor);
    if (typeof style.mazeSquareColor === "string" && /^#[0-9a-f]{6}$/i.test(style.mazeSquareColor)) setMazeSquareColor(style.mazeSquareColor);
  }, []);

  const applyStoredCreatorSettings = useCallback((
    saved: PersistedCreatorSettings | PersistedTrackCreatorSettings,
    replaceCustomSkin = false,
  ) => {
    let restoredMazeSkin = saved.visualStyle.mazeSkin;
    if (saved.customMazeSkin) {
      if (customMazeSkinUrlRef.current) URL.revokeObjectURL(customMazeSkinUrlRef.current);
      const url = URL.createObjectURL(saved.customMazeSkin.blob);
      customMazeSkinUrlRef.current = url;
      setCustomMazeSkin({
        url,
        name: saved.customMazeSkin.name,
        width: saved.customMazeSkin.width,
        height: saved.customMazeSkin.height,
      });
    } else if (replaceCustomSkin) {
      if (customMazeSkinUrlRef.current) URL.revokeObjectURL(customMazeSkinUrlRef.current);
      customMazeSkinUrlRef.current = null;
      setCustomMazeSkin(null);
      if (restoredMazeSkin === "custom") restoredMazeSkin = "crimson";
    } else if (restoredMazeSkin === "custom") {
      restoredMazeSkin = "crimson";
    }
    applyVisualStyle({ ...saved.visualStyle, mazeSkin: restoredMazeSkin });

    if (["balanced", "piano", "rhythm"].includes(saved.analysis.profile)) {
      setAnalysisProfile(saved.analysis.profile);
    }
    setSensitivity(clamp(saved.analysis.sensitivity, 20, 92));
    setVisualSyncMs(clamp(saved.analysis.visualSyncMs, 0, 500));
    setAutoSaveVideo(Boolean(saved.export.autoSaveVideo));
    if (["trigger", "sound"].includes(saved.editor.manualEditMode)) {
      setManualEditMode(saved.editor.manualEditMode);
    }
    setPianoSoundEnabled(Boolean(saved.editor.pianoSoundEnabled));
    setPianoVolume(clamp(saved.editor.pianoVolume, 0, 100));
    if ([0, 10, 25, 50, 100].includes(saved.editor.debugSnapMs)) {
      setDebugSnapMs(saved.editor.debugSnapMs);
    }
    if (Number.isFinite(saved.editor.debugWindowSeconds)) {
      setDebugWindowSeconds(saved.editor.debugWindowSeconds === 0
        ? 0
        : clamp(saved.editor.debugWindowSeconds, 1.5, 240));
    }
    if ([0.25, 0.5, 0.75, 1].includes(saved.editor.debugPlaybackRate)) {
      setDebugPlaybackRate(saved.editor.debugPlaybackRate);
    }
    setDebugPreviewOpen(Boolean(saved.editor.debugPreviewOpen));
    setDebugPreviewWidth(clamp(saved.editor.debugPreviewWidth, DEFAULT_DEBUG_PREVIEW_WIDTH, MAX_DEBUG_PREVIEW_WIDTH));
  }, [applyVisualStyle]);

  const applyStoredTrackMedia = useCallback((saved: PersistedTrackMedia | null) => {
    if (customMazeVideoUrlRef.current) {
      URL.revokeObjectURL(customMazeVideoUrlRef.current);
      customMazeVideoUrlRef.current = null;
    }
    lastPersistedVideoKeyRef.current = saved?.customMazeVideo
      ? `${saved.customMazeVideo.name}:${saved.customMazeVideo.blob.size}:${saved.customMazeVideo.duration.toFixed(3)}`
      : null;
    if (!saved?.customMazeVideo) {
      setCustomMazeVideo(null);
      return;
    }
    const video = saved.customMazeVideo;
    const url = URL.createObjectURL(video.blob);
    customMazeVideoUrlRef.current = url;
    setCustomMazeVideo({
      url,
      name: video.name,
      type: video.type,
      width: video.width,
      height: video.height,
      duration: video.duration,
      blob: video.blob,
    });
  }, []);

  useEffect(() => {
    let active = true;
    void loadCreatorSettings()
      .then((saved) => {
        if (!active) return;
        if (!saved) {
          creatorSettingsHydratedRef.current = true;
          setCreatorSettingsState("idle");
          return;
        }

        applyStoredCreatorSettings(saved);
        creatorSettingsHydratedRef.current = true;
        setCreatorSettingsSavedAt(saved.savedAt);
        setCreatorSettingsState("saved");
      })
      .catch((error) => {
        console.error("读取成片设置失败", error);
        if (active) setCreatorSettingsState("error");
      });
    return () => {
      active = false;
    };
  }, [applyStoredCreatorSettings]);

  const activeNotes = useMemo(
    () => modelPointsMuted ? result.notes.filter((note) => note.source !== "model") : result.notes,
    [modelPointsMuted, result.notes],
  );
  const selectedNote = selectedNoteIndex === null ? null : result.notes[selectedNoteIndex] ?? null;

  useEffect(() => {
    notesRef.current = activeNotes;
    durationRef.current = result.duration;
  }, [activeNotes, result.duration]);

  useEffect(() => {
    styleRef.current = visualStyle;
  }, [visualStyle]);

  useEffect(() => {
    visualSyncMsRef.current = visualSyncMs;
  }, [visualSyncMs]);

  useEffect(() => {
    analysisProfileRef.current = analysisProfile;
    sensitivityRef.current = sensitivity;
  }, [analysisProfile, sensitivity]);

  useEffect(() => {
    const soundAssistEnabled = manualEditMode === "sound" && pianoSoundEnabled;
    pianoSoundEnabledRef.current = soundAssistEnabled;
    pianoVolumeRef.current = pianoVolume;
    if (pianoMasterGainRef.current) {
      pianoMasterGainRef.current.gain.value = soundAssistEnabled ? pianoVolume / 100 : 0;
    }
  }, [manualEditMode, pianoSoundEnabled, pianoVolume]);

  const ensurePianoAudio = useCallback(async () => {
    let context = pianoAudioContextRef.current;
    let gain = pianoMasterGainRef.current;
    if (!context || context.state === "closed" || !gain) {
      const AudioContextClass = window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return null;
      context = new AudioContextClass();
      gain = context.createGain();
      gain.gain.value = pianoSoundEnabledRef.current ? pianoVolumeRef.current / 100 : 0;
      gain.connect(context.destination);
      pianoAudioContextRef.current = context;
      pianoMasterGainRef.current = gain;
    }
    if (context.state === "suspended") await context.resume();
    return { context, gain };
  }, []);

  const auditionPianoNote = useCallback(async (pitch: number, velocity = 1) => {
    if (!pianoSoundEnabledRef.current) return;
    const piano = await ensurePianoAudio();
    if (!piano) return;
    scheduleSynthPianoNote(piano.context, piano.gain, pitch, velocity);
  }, [ensurePianoAudio]);

  useEffect(() => {
    const audio = audioRef.current as (HTMLAudioElement & { webkitPreservesPitch?: boolean }) | null;
    if (!audio) return;
    audio.playbackRate = debugPlaybackRate;
    audio.preservesPitch = true;
    if ("webkitPreservesPitch" in audio) audio.webkitPreservesPitch = true;
  }, [audioUrl, debugPlaybackRate]);

  useEffect(() => {
    if (!debugExpanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [debugExpanded]);

  const analyzeDecodedAudio = useCallback(async (decoded: AudioBuffer) => {
    const profile = analysisProfileRef.current;
    const sensitivity = sensitivityRef.current / 100;
    const base = await analyzeMelody(
      decoded,
      (nextProgress, nextStage) => {
        setProgress(profile === "piano" ? nextProgress * 0.6 : nextProgress);
        setStage(nextStage);
      },
      { profile, sensitivity },
    );
    if (profile !== "piano") return base;
    try {
      const refined = await refinePianoOnsets(
        decoded,
        base,
        sensitivity,
        (nextProgress, nextStage) => {
          setProgress(nextProgress);
          setStage(nextStage);
        },
      );
      return refined;
    } catch (error) {
      console.warn("钢琴起音复核不可用，保留频谱起音结果", error);
      return base;
    }
  }, []);

  useEffect(() => {
    const canvas = timelineCanvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    drawMelodyTimeline(context, canvas.width, canvas.height, activeNotes, result.duration, currentTime, selectedNote);
  }, [activeNotes, result.duration, currentTime, selectedNote]);

  useEffect(() => {
    const canvas = debugCanvasRef.current;
    if (!canvas) return;
    const draw = () => {
      const prepared = prepareHiDpiCanvas(canvas);
      if (!prepared) return;
      drawDebugTimeline(
        prepared.context,
        prepared.width,
        prepared.height,
        waveform,
        result,
        currentTime,
        debugWindowSeconds,
        selectedNoteIndex,
        selectedNoteIndices,
        modelPointsMuted,
        manualEditMode,
        debugSelectionRect,
      );
    };
    draw();
    const resizeObserver = new ResizeObserver(draw);
    resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, [debugSelectionRect, debugWindowSeconds, currentTime, manualEditMode, modelPointsMuted, result, selectedNoteIndex, selectedNoteIndices, waveform]);

  const analyzeFile = useCallback(async (
    file: File,
    displayName = file.name,
    sampleScore?: SampleScore,
    restoredProject?: { id: string; result: AnalysisResult; createdAt: number },
    trackIdentity?: { id: string; label: string },
  ) => {
    if (file.size > 80 * 1024 * 1024) {
      setStatus("error");
      setStage("文件大于 80MB，请先截取要制作的段落");
      return;
    }
    setStatus("analyzing");
    const trackId = trackIdentity?.id ?? importedTrackConfigId(file);
    const trackLabel = trackIdentity?.label ?? displayName;
    const loadToken = ++trackSettingsLoadTokenRef.current;
    trackSettingsHydratedRef.current = false;
    currentTrackConfigIdRef.current = trackId;
    setCurrentTrackConfigId(trackId);
    setCurrentTrackLabel(trackLabel);
    setCreatorSettingsState("loading");
    setCreatorSettingsSavedAt(null);
    setProgress(0.02);
    setStage("正在读取音频");
    setFileName(displayName);
    setPlaying(false);
    setCurrentTime(0);
    setHasOfficialScore(Boolean(sampleScore));
    setSelectedNoteIndex(null);
    setSelectedNoteIndices([]);
    setDebugSelectionRect(null);
    debugUndoStackRef.current = [];
    setDebugUndoCount(0);
    setTimingOffsetMs(0);
    setDebugPlaybackRate(1);
    setCurrentLibraryId(restoredProject?.id ?? null);
    currentLibraryCreatedAtRef.current = restoredProject?.createdAt ?? 0;
    currentAudioBlobRef.current = file;
    setLocalSaveState(restoredProject ? "saved" : "idle");
    currentTimeRef.current = 0;
    audioRef.current?.pause();

    try {
      const [arrayBuffer, savedTrack, savedMedia] = await Promise.all([
        file.arrayBuffer(),
        loadTrackCreatorSettings(trackId).catch((error) => {
          console.error("读取歌曲专属配置失败，将继续载入音频", error);
          return null;
        }),
        loadTrackMedia(trackId).catch((error) => {
          console.error("读取歌曲专属视频背景失败，将继续载入音频", error);
          return null;
        }),
      ]);
      const AudioContextClass = window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) throw new Error("AudioContext unavailable");
      const context = new AudioContextClass();
      const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
      decodedBufferRef.current = decoded;
      setWaveform(buildWaveform(decoded, Math.min(48_000, Math.max(5_000, Math.ceil(decoded.duration * 160)))));
      const analysis = withoutModelOnlyNotes(savedTrack?.trackState?.result
        ?? restoredProject?.result
        ?? (sampleScore
          ? analysisFromSampleScore(sampleScore, decoded.duration)
          : await analyzeDecodedAudio(decoded)));
      await context.close();
      if (loadToken !== trackSettingsLoadTokenRef.current) return;

      const trackResult = analysis;
      applyStoredTrackMedia(savedMedia);
      if (savedTrack) {
        applyStoredCreatorSettings(savedTrack, true);
        setTimingOffsetMs(clamp(savedTrack.trackState.timingOffsetMs, -240, 240));
        setHasOfficialScore(Boolean(savedTrack.trackState.hasOfficialScore));
        if (["select", "draw", "erase"].includes(savedTrack.trackState.debugEditTool)) {
          setDebugEditTool(savedTrack.trackState.debugEditTool);
        }
        setDebugExpanded(Boolean(savedTrack.trackState.debugExpanded));
        setDebugPreviewPosition(savedTrack.trackState.debugPreviewPosition ?? null);
        setCreatorSettingsSavedAt(savedTrack.savedAt);
      }

      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const nextUrl = URL.createObjectURL(file);
      objectUrlRef.current = nextUrl;
      setAudioUrl(nextUrl);
      setResult(trackResult);
      trackSettingsHydratedRef.current = true;
      setCreatorSettingsState(savedTrack ? "saved" : "idle");
      setStatus("ready");
      setProgress(1);
      const coverage = decoded.duration > trackResult.duration ? ` · 已取前 ${formatTime(trackResult.duration)}` : "";
      const sourceLabel = savedTrack
        ? "歌曲专属配置已恢复"
        : savedMedia
          ? "歌曲专属视频背景已恢复"
        : restoredProject
          ? "本地曲库已恢复"
          : sampleScore
            ? "官方精准谱面"
            : profileText[analysisProfileRef.current];
      setStage(`${sourceLabel} · ${trackResult.notes.length} 个同步落点${coverage}`);
    } catch (error) {
      console.error(error);
      setStatus("error");
      setProgress(0);
      setStage("无法解码该音频，可尝试转成 MP3 或 WAV");
    }
  }, [analyzeDecodedAudio, applyStoredCreatorSettings, applyStoredTrackMedia]);

  const reanalyzeCurrentTrack = useCallback(async () => {
    const decoded = decodedBufferRef.current;
    if (!decoded || status === "analyzing") return;
    audioRef.current?.pause();
    setPlaying(false);
    setStatus("analyzing");
    setProgress(0.02);
    setStage(`正在用「${profileText[analysisProfileRef.current]}」重新解析`);
    setCurrentTime(0);
    debugUndoStackRef.current = [];
    setDebugUndoCount(0);
    currentTimeRef.current = 0;
    if (audioRef.current) audioRef.current.currentTime = 0;
    try {
      const analysis = withoutModelOnlyNotes(await analyzeDecodedAudio(decoded));
      setHasOfficialScore(false);
      setSelectedNoteIndex(null);
      setSelectedNoteIndices([]);
      setDebugSelectionRect(null);
      setTimingOffsetMs(0);
      setResult(analysis);
      setStatus("ready");
      setProgress(1);
      setStage(`${profileText[analysisProfileRef.current]} · ${analysis.notes.length} 个同步落点`);
    } catch (error) {
      console.error(error);
      setStatus("error");
      setStage("重新解析失败，请保留原文件后再试一次");
    }
  }, [analyzeDecodedAudio, status]);

  const loadSample = useCallback(
    async (sample: (typeof SAMPLE_TRACKS)[number]) => {
      try {
        setStatus("analyzing");
        setStage(`正在载入「${sample.name}」`);
        const [response, scoreResponse] = await Promise.all([fetch(sample.url), fetch(sample.scoreUrl)]);
        if (!response.ok || !scoreResponse.ok) throw new Error("Sample unavailable");
        const [blob, score] = await Promise.all([response.blob(), scoreResponse.json() as Promise<SampleScore>]);
        const file = new File([blob], `${sample.name}.mp3`, { type: "audio/mpeg" });
        await analyzeFile(file, sample.name, score, undefined, {
          id: `sample:${sample.url}`,
          label: sample.name,
        });
      } catch (error) {
        console.error(error);
        setStatus("error");
        setStage("测试样本加载失败");
      }
    },
    [analyzeFile],
  );

  const refreshLocalLibrary = useCallback(async () => {
    try {
      setLocalMusicProjects(await listLocalMusicProjects());
    } catch (error) {
      console.error(error);
      setLocalSaveState("error");
    }
  }, []);

  const saveCurrentMusicLocally = useCallback(async (announce = true) => {
    const audioBlob = currentAudioBlobRef.current;
    if (!audioBlob || !audioUrl || status !== "ready") return false;
    setLocalLibraryBusy(true);
    setLocalSaveState("saving");
    try {
      await navigator.storage?.persist?.();
      const now = Date.now();
      const existingProject = currentTrackConfigId
        ? localMusicProjects.find((project) => project.trackConfigId === currentTrackConfigId)
        : undefined;
      const id = currentLibraryId
        ?? existingProject?.id
        ?? (globalThis.crypto?.randomUUID?.() ?? `orbitone-${now}-${Math.random().toString(36).slice(2)}`);
      const createdAt = currentLibraryCreatedAtRef.current || existingProject?.createdAt || now;
      await saveLocalMusicProject({
        id,
        trackConfigId: currentTrackConfigId ?? undefined,
        name: fileName.replace(/\.[^.]+$/, "") || "未命名音乐",
        fileName,
        mimeType: audioBlob.type || "audio/mpeg",
        audioBlob,
        result: withoutModelOnlyNotes(result),
        createdAt,
        updatedAt: now,
      });
      if (currentTrackConfigId) {
        if (customMazeVideo) {
          await saveTrackMedia({
            trackId: currentTrackConfigId,
            customMazeVideo: {
              blob: customMazeVideo.blob,
              name: customMazeVideo.name,
              type: customMazeVideo.type,
              width: customMazeVideo.width,
              height: customMazeVideo.height,
              duration: customMazeVideo.duration,
            },
            savedAt: now,
          });
        } else {
          await removeTrackMedia(currentTrackConfigId);
        }
      }
      currentLibraryCreatedAtRef.current = createdAt;
      setCurrentLibraryId(id);
      setLocalSaveState("saved");
      await refreshLocalLibrary();
      if (announce) {
        setStage(customMazeVideo
          ? `「${fileName}」与专属视频背景已保存到本地曲库`
          : `「${fileName}」已保存到本地曲库 · 后续音符修改会自动保存`);
      }
      return true;
    } catch (error) {
      console.error(error);
      setLocalSaveState("error");
      setStage("本地保存失败，可能是浏览器存储空间不足或隐私模式限制");
      return false;
    } finally {
      setLocalLibraryBusy(false);
    }
  }, [audioUrl, currentLibraryId, currentTrackConfigId, customMazeVideo, fileName, localMusicProjects, refreshLocalLibrary, result, status]);

  const openLocalMusic = useCallback(async (id: string) => {
    setLocalLibraryBusy(true);
    try {
      const project = await getLocalMusicProject(id);
      if (!project) throw new Error("Local project missing");
      const file = new File([project.audioBlob], project.fileName, { type: project.mimeType });
      await analyzeFile(file, project.name, undefined, {
        id: project.id,
        result: withoutModelOnlyNotes(project.result),
        createdAt: project.createdAt,
      }, {
        id: project.trackConfigId ?? `library:${project.id}`,
        label: project.name,
      });
    } catch (error) {
      console.error(error);
      setStatus("error");
      setStage("本地音乐打开失败，请重新导入原音频");
    } finally {
      setLocalLibraryBusy(false);
    }
  }, [analyzeFile]);

  const deleteLocalMusic = useCallback(async (project: LocalMusicProjectSummary) => {
    if (!window.confirm(`从本地曲库删除「${project.name}」？此操作不会删除电脑上的原始音频文件。`)) return;
    setLocalLibraryBusy(true);
    try {
      await removeLocalMusicProject(project.id);
      await removeTrackCreatorSettings(project.trackConfigId ?? `library:${project.id}`);
      await removeTrackMedia(project.trackConfigId ?? `library:${project.id}`);
      if (currentLibraryId === project.id) {
        setCurrentLibraryId(null);
        currentLibraryCreatedAtRef.current = 0;
        setLocalSaveState("idle");
      }
      await refreshLocalLibrary();
      setStage(`已从本地曲库删除「${project.name}」`);
    } catch (error) {
      console.error(error);
      setStage("删除本地音乐失败，请稍后重试");
    } finally {
      setLocalLibraryBusy(false);
    }
  }, [currentLibraryId, refreshLocalLibrary]);

  useEffect(() => {
    let active = true;
    void listLocalMusicProjects().then((projects) => {
      if (active) setLocalMusicProjects(projects);
    }).catch((error) => {
      console.error(error);
      if (active) setLocalSaveState("error");
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!currentLibraryId || !currentAudioBlobRef.current || status !== "ready") return;
    const timeout = window.setTimeout(() => {
      const audioBlob = currentAudioBlobRef.current;
      if (!audioBlob) return;
      setLocalSaveState("saving");
      const now = Date.now();
      void saveLocalMusicProject({
        id: currentLibraryId,
        trackConfigId: currentTrackConfigId ?? undefined,
        name: fileName.replace(/\.[^.]+$/, "") || "未命名音乐",
        fileName,
        mimeType: audioBlob.type || "audio/mpeg",
        audioBlob,
        result: withoutModelOnlyNotes(result),
        createdAt: currentLibraryCreatedAtRef.current || now,
        updatedAt: now,
      }).then(() => {
        setLocalSaveState("saved");
        void refreshLocalLibrary();
      }).catch((error) => {
        console.error(error);
        setLocalSaveState("error");
      });
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [currentLibraryId, currentTrackConfigId, fileName, refreshLocalLibrary, result, status]);

  useEffect(() => {
    if (defaultLoadedRef.current) return;
    defaultLoadedRef.current = true;
    void loadSample(SAMPLE_TRACKS[0]);
  }, [loadSample]);

  useEffect(() => {
    const draw = (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext("2d");
      if (!context) return;
      const exportClock = exportAudioRef.current;
      const clock = exportClock || audioRef.current;
      const rawTime = clock?.currentTime ?? currentTimeRef.current;
      // Canvas reaches the display one or two frames after audio.currentTime is
      // sampled. Convert the real display compensation into media time so slow
      // motion remains just as accurate, and keep exports on the raw clock.
      const visualLead = clock && !clock.paused && !exportClock
        ? (visualSyncMsRef.current / 1_000) * clock.playbackRate
        : 0;
      const time = clamp(rawTime + visualLead, 0, durationRef.current);
      if (clock && !clock.paused && !exportClock && pianoSoundEnabledRef.current) {
        let previous = lastPianoMediaTimeRef.current;
        if (rawTime < previous - 0.05 || rawTime - previous > 0.35) previous = rawTime - 0.035;
        const triggerUntil = rawTime + 0.022;
        const pianoContext = pianoAudioContextRef.current;
        const pianoGain = pianoMasterGainRef.current;
        if (pianoContext?.state === "running" && pianoGain) {
          notesRef.current.forEach((note) => {
            if (note.time > previous + 0.001 && note.time <= triggerUntil) {
              scheduleSynthPianoNote(pianoContext, pianoGain, note.pitch, note.velocity);
            }
          });
        }
        lastPianoMediaTimeRef.current = triggerUntil;
      }
      // Always render in fixed 540×960 logical coordinates. During export the
      // canvas backing store is larger (720×1280 / 1080×1920); scaling the
      // context instead of the scene keeps every absolute size (ball, text,
      // trails, line widths) at its exact on-screen proportion — just sharper.
      const backingScale = canvas.width / 540;
      context.setTransform(backingScale, 0, 0, backingScale, 0, 0);
      renderMusicBox(
        context,
        540,
        960,
        time,
        notesRef.current,
        durationRef.current,
        styleRef.current,
      );
      context.setTransform(1, 0, 0, 1, 0, 0);
      const debugPreviewCanvas = debugPreviewCanvasRef.current;
      const debugPreviewContext = debugPreviewCanvas?.getContext("2d");
      if (debugPreviewCanvas && debugPreviewContext) {
        // The floating preview has the same 9:16 image. Copying the finished
        // frame avoids running all lighting and particle effects twice.
        debugPreviewContext.clearRect(0, 0, debugPreviewCanvas.width, debugPreviewCanvas.height);
        debugPreviewContext.drawImage(canvas, 0, 0, debugPreviewCanvas.width, debugPreviewCanvas.height);
      }
      if (clock && !clock.paused && timestamp - lastUiUpdateRef.current >= 100) {
        currentTimeRef.current = clock.currentTime;
        setCurrentTime(clock.currentTime);
        lastUiUpdateRef.current = timestamp;
      }
      animationRef.current = requestAnimationFrame(draw);
    };
    animationRef.current = requestAnimationFrame(draw);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      if (customMazeSkinUrlRef.current) URL.revokeObjectURL(customMazeSkinUrlRef.current);
      if (customMazeVideoUrlRef.current) URL.revokeObjectURL(customMazeVideoUrlRef.current);
      void pianoAudioContextRef.current?.close();
    },
    [],
  );

  const handleFiles = (files: FileList | File[]) => {
    const file = files[0];
    if (file) void analyzeFile(file);
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !audioUrl || status === "analyzing") return;
    if (audio.paused) {
      if (audio.currentTime >= result.duration - 0.05) {
        audio.currentTime = 0;
        currentTimeRef.current = 0;
      }
      try {
        if (pianoSoundEnabledRef.current) await ensurePianoAudio();
        lastPianoMediaTimeRef.current = audio.currentTime - 0.035;
        await audio.play();
      } catch (error) {
        console.error(error);
        setStage("浏览器未能开始播放，请再点一次播放按钮");
      }
    } else {
      audio.pause();
    }
  };

  const seek = (value: number) => {
    const next = clamp(value, 0, result.duration);
    if (audioRef.current) audioRef.current.currentTime = next;
    currentTimeRef.current = next;
    lastPianoMediaTimeRef.current = next;
    setCurrentTime(next);
  };

  const previewVisualChoice = (kind: "impact" | "trail", label: string) => {
    const audio = audioRef.current;
    if (audio && !audio.paused) {
      setStage(`${label}已生效 · 正在播放中实时预览`);
      return;
    }
    const notes = activeNotes.length ? activeNotes : result.notes;
    if (!notes.length) {
      setStage(`${label}已生效`);
      return;
    }
    const index = clamp(Math.floor(notes.length * 0.34), 0, Math.max(0, notes.length - 2));
    const note = notes[index];
    const nextNote = notes[Math.min(notes.length - 1, index + 1)];
    const target = kind === "impact"
      ? note.time + 0.13
      : note.time + Math.min(0.32, Math.max(0.12, (nextNote.time - note.time) * 0.62));
    seek(target);
    setStage(`${label}已生效 · 已定位到${kind === "impact" ? "碰撞" : "运动拖尾"}预览时刻`);
  };

  const loadCustomMazeSkin = (file: File) => {
    const supportedTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!supportedTypes.includes(file.type)) {
      setStage("自定义皮肤仅支持 PNG、JPG 或 WebP 图片");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setStage("自定义皮肤不能超过 8MB，请先压缩图片");
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      if (customMazeSkinUrlRef.current) URL.revokeObjectURL(customMazeSkinUrlRef.current);
      customMazeSkinUrlRef.current = url;
      setCustomMazeSkin({ url, name: file.name, width: image.naturalWidth, height: image.naturalHeight });
      setMazeSkin("custom");
      // Background media is mutually exclusive: choosing an image skin removes
      // any active video background (and its per-track persisted copy).
      if (customMazeVideoUrlRef.current) void removeCustomMazeVideo(true);
      previewVisualChoice("trail", "自定义迷宫皮肤");
      setStage(`已载入本地皮肤 ${image.naturalWidth}×${image.naturalHeight} · 点击“保存全部设置”后可跨刷新保留`);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      setStage("图片无法读取，请换一张 PNG、JPG 或 WebP");
    };
    image.src = url;
  };

  const loadCustomMazeVideo = (file: File) => {
    const supportedExtension = /\.(mp4|m4v|mov|webm|ogv|ogg)$/i.test(file.name);
    if (!file.type.startsWith("video/") && !supportedExtension) {
      setStage("请选择浏览器可播放的视频文件，例如 MP4、MOV 或 WebM");
      return;
    }
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      if (!video.videoWidth || !video.videoHeight || !Number.isFinite(video.duration)) {
        URL.revokeObjectURL(url);
        setStage("视频没有可读取的画面，请换一个浏览器支持的视频编码");
        return;
      }
      if (customMazeVideoUrlRef.current) URL.revokeObjectURL(customMazeVideoUrlRef.current);
      customMazeVideoUrlRef.current = url;
      setCustomMazeVideo({
        url,
        name: file.name,
        type: file.type || "video/mp4",
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
        blob: file,
      });
      setLayoutTemplate("square-maze");
      setStage(`已载入本地视频 ${video.videoWidth}×${video.videoHeight} · 将自动居中裁成 9:16，点击“保存当前歌曲全部设置”后专属保留`);
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      setStage("视频无法读取；尺寸不限，但编码需要当前浏览器能够播放");
    };
    video.src = url;
  };

  const removeCustomMazeVideo = async (quiet = false) => {
    const hadVideo = Boolean(customMazeVideoUrlRef.current);
    if (customMazeVideoUrlRef.current) {
      URL.revokeObjectURL(customMazeVideoUrlRef.current);
      customMazeVideoUrlRef.current = null;
    }
    setCustomMazeVideo(null);
    if (!hadVideo) return;
    const trackId = currentTrackConfigIdRef.current;
    if (trackId) {
      try {
        await removeTrackMedia(trackId);
      } catch (error) {
        console.error("删除歌曲专属视频背景失败", error);
        if (!quiet) setStage("画面中的视频已移除，但本地保存记录删除失败，请稍后再试");
        return;
      }
    }
    if (!quiet) setStage("已移除当前歌曲的视频背景，不会删除电脑上的原视频文件");
  };

  // Video backgrounds persist exactly like every other setting: any change is
  // written to the per-track record automatically (debounced), so a refresh
  // never loses the video. The key baseline skips the redundant write right
  // after a stored video is restored.
  useEffect(() => {
    if (!trackSettingsHydratedRef.current) return;
    const trackId = currentTrackConfigIdRef.current;
    if (!trackId) return;
    const key = customMazeVideo
      ? `${customMazeVideo.name}:${customMazeVideo.blob.size}:${customMazeVideo.duration.toFixed(3)}`
      : null;
    if (key === lastPersistedVideoKeyRef.current) return;
    const timer = window.setTimeout(() => {
      lastPersistedVideoKeyRef.current = key;
      const write = customMazeVideo
        ? saveTrackMedia({
            trackId,
            customMazeVideo: {
              blob: customMazeVideo.blob,
              name: customMazeVideo.name,
              type: customMazeVideo.type,
              width: customMazeVideo.width,
              height: customMazeVideo.height,
              duration: customMazeVideo.duration,
            },
            savedAt: Date.now(),
          })
        : removeTrackMedia(trackId);
      Promise.resolve(write).catch((error) => {
        console.error("自动保存视频背景失败", error);
        lastPersistedVideoKeyRef.current = null;
        setStage(customMazeVideo
          ? "视频背景自动保存失败，可点击“保存当前歌曲全部设置”重试"
          : "视频背景的删除记录保存失败，请稍后再试");
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [customMazeVideo]);

  const changeDebugPlaybackRate = (rate: number) => {
    const nextRate = clamp(rate, 0.25, 1);
    setDebugPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
      audioRef.current.preservesPitch = true;
    }
    setStage(nextRate < 1
      ? `慢动作联调 ${nextRate}× · 音频、播放头和弹跳动画保持同步`
      : "已恢复正常速度播放");
  };

  const changeVisualSync = (milliseconds: number) => {
    const next = clamp(milliseconds, 0, 500);
    visualSyncMsRef.current = next;
    setVisualSyncMs(next);
    setStage(next === 0 ? "屏幕延迟补偿已关闭" : `动画已提前补偿 ${next}ms · 音符时间未修改`);
  };

  const beginDebugPreviewDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const panel = debugConsoleRef.current;
    const card = debugPreviewCardRef.current;
    if (!panel || !card) return;
    const panelBounds = panel.getBoundingClientRect();
    const cardBounds = card.getBoundingClientRect();
    debugPreviewDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: cardBounds.left - panelBounds.left + panel.scrollLeft,
      originY: cardBounds.top - panelBounds.top + panel.scrollTop,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDebugPreview = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = debugPreviewDragRef.current;
    const panel = debugConsoleRef.current;
    const card = debugPreviewCardRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !panel || !card) return;
    const maxX = Math.max(8, panel.clientWidth - card.offsetWidth - 8);
    const maxY = Math.max(92, panel.scrollHeight - card.offsetHeight - 8);
    setDebugPreviewPosition({
      x: clamp(drag.originX + event.clientX - drag.startX, 8, maxX),
      y: clamp(drag.originY + event.clientY - drag.startY, 92, maxY),
    });
  };

  const endDebugPreviewDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (debugPreviewDragRef.current?.pointerId !== event.pointerId) return;
    debugPreviewDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const beginDebugPreviewResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const panel = debugConsoleRef.current;
    const card = debugPreviewCardRef.current;
    if (!panel || !card) return;
    const panelBounds = panel.getBoundingClientRect();
    const cardBounds = card.getBoundingClientRect();
    debugPreviewResizeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: cardBounds.width,
      maxWidth: Math.max(150, Math.min(MAX_DEBUG_PREVIEW_WIDTH, panelBounds.right - cardBounds.left - 12)),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const resizeDebugPreview = (event: React.PointerEvent<HTMLButtonElement>) => {
    const resize = debugPreviewResizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    setDebugPreviewWidth(clamp(resize.startWidth + event.clientX - resize.startX, 150, resize.maxWidth));
  };

  const endDebugPreviewResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    const resize = debugPreviewResizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    debugPreviewResizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const recordDebugUndo = useCallback((snapshot: AnalysisResult, offsetMs: number) => {
    debugUndoStackRef.current = [
      ...debugUndoStackRef.current,
      { result: snapshot, timingOffsetMs: offsetMs },
    ].slice(-MAX_DEBUG_UNDO_STEPS);
    setDebugUndoCount(debugUndoStackRef.current.length);
  }, []);

  const undoDebugEdit = useCallback(() => {
    const snapshot = debugUndoStackRef.current.pop();
    if (!snapshot) return;
    audioRef.current?.pause();
    setResult(snapshot.result);
    setTimingOffsetMs(snapshot.timingOffsetMs);
    setSelectedNoteIndex(null);
    setSelectedNoteIndices([]);
    setDebugSelectionRect(null);
    setHasOfficialScore(false);
    setDebugUndoCount(debugUndoStackRef.current.length);
    setStage(`已撤回上一步砖块编辑 · 当前 ${snapshot.result.notes.length} 个触发点`);
  }, []);

  const changeDebugTimelineZoom = (direction: "in" | "out") => {
    const duration = Math.max(1.5, result.duration);
    const currentWindow = debugWindowSeconds <= 0 ? duration : debugWindowSeconds;
    const scaled = currentWindow * (direction === "in" ? 0.8 : 1.25);
    const next = scaled >= duration * 0.98
      ? 0
      : Number(clamp(scaled, 1.5, duration).toFixed(1));
    setDebugWindowSeconds(next);
    setStage(next === 0
      ? "调试时间轴已缩放到全曲"
      : `调试时间轴已${direction === "in" ? "放大" : "缩小"}到 ${next.toFixed(1)} 秒视图`);
  };

  const zoomDebugTimelineWithWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    if (Math.abs(event.deltaY) < 1) return;
    event.preventDefault();
    changeDebugTimelineZoom(event.deltaY < 0 ? "in" : "out");
  };

  const previewLandingCollision = (time: number) => {
    seek(time - visualSyncMsRef.current / 1_000 + 0.035);
  };

  const addManualLanding = (requestedTime: number, requestedPitch?: number) => {
    const time = clamp(requestedTime, 0, result.duration);
    const nearest = result.notes.reduce<MelodyNote | undefined>((best, note) => {
      if (!best) return note;
      return Math.abs(note.time - time) < Math.abs(best.time - time) ? note : best;
    }, undefined);
    const manualNote: MelodyNote = {
      time,
      duration: manualEditMode === "trigger" ? 0.18 : 0.34,
      pitch: manualEditMode === "trigger" ? 60 : requestedPitch ?? nearest?.pitch ?? 60,
      confidence: 1,
      velocity: 1,
      source: "manual",
    };
    const dedupeSeconds = manualEditMode === "trigger" ? MANUAL_TRIGGER_DEDUPE_SECONDS : 0.035;
    const notes = [...result.notes.filter((note) => Math.abs(note.time - time) > dedupeSeconds), manualNote]
      .sort((a, b) => a.time - b.time);
    recordDebugUndo(result, timingOffsetMs);
    setResult({ ...result, notes });
    setSelectedNoteIndex(notes.indexOf(manualNote));
    setSelectedNoteIndices([]);
    setDebugSelectionRect(null);
    setHasOfficialScore(false);
    void auditionPianoNote(manualNote.pitch, manualNote.velocity);
    previewLandingCollision(time);
    setStage(`已在 ${formatPreciseTime(time)} 补充砖块并显示碰撞预览`);
  };

  const addLandingAtCurrentTime = () => {
    addManualLanding(currentTimeRef.current);
  };

  const addLandingsFromTimes = () => {
    const times = Array.from(new Set(
      (manualTimesInput.match(/\d+(?:\.\d+)?/g) ?? [])
        .map(Number)
        .filter((time) => Number.isFinite(time) && time >= 0 && time <= result.duration)
        .map((time) => Number(time.toFixed(3))),
    )).sort((a, b) => a - b);
    if (!times.length) {
      setStage(`请输入 0 到 ${result.duration.toFixed(1)} 秒之间的时间，例如 1, 5, 8, 12`);
      return;
    }
    const originalNotes = result.notes;
    const fallbackPitches = [60, 64, 67, 72, 69, 67];
    const manualNotes = times.map((time, index): MelodyNote => {
      const nearest = originalNotes.reduce<MelodyNote | undefined>((best, note) => {
        if (!best) return note;
        return Math.abs(note.time - time) < Math.abs(best.time - time) ? note : best;
      }, undefined);
      return {
        time,
        duration: manualEditMode === "trigger" ? 0.18 : 0.34,
        pitch: manualEditMode === "trigger" ? 60 : nearest?.pitch ?? fallbackPitches[index % fallbackPitches.length],
        confidence: 1,
        velocity: 1,
        source: "manual",
      };
    });
    const dedupeSeconds = manualEditMode === "trigger" ? MANUAL_TRIGGER_DEDUPE_SECONDS : 0.035;
    const notes = [
      ...originalNotes.filter((note) => !times.some((time) => Math.abs(note.time - time) <= dedupeSeconds)),
      ...manualNotes,
    ].sort((a, b) => a.time - b.time);
    recordDebugUndo(result, timingOffsetMs);
    setResult({ ...result, notes });
    setSelectedNoteIndex(notes.indexOf(manualNotes[manualNotes.length - 1]));
    setSelectedNoteIndices([]);
    setDebugSelectionRect(null);
    setHasOfficialScore(false);
    previewLandingCollision(times[0]);
    void auditionPianoNote(manualNotes[0].pitch, 1);
    setStage(`已根据秒数新增 ${manualNotes.length} 个可拖动弹跳点`);
  };

  const startBlankManualScore = () => {
    if (result.notes.length && !window.confirm("清空当前落点并开始制作空白手工谱面？仍可以点击重新解析恢复自动落点。")) return;
    recordDebugUndo(result, timingOffsetMs);
    setResult({ ...result, notes: [], quality: "high", diagnostics: undefined });
    setSelectedNoteIndex(null);
    setSelectedNoteIndices([]);
    setDebugSelectionRect(null);
    setHasOfficialScore(false);
    setTimingOffsetMs(0);
    setStage("空白手工谱面已建立 · 定位播放头后新增，或直接输入秒数");
  };

  const timelinePoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * event.currentTarget.width,
      y: ((event.clientY - bounds.top) / Math.max(1, bounds.height)) * event.currentTarget.height,
      bounds,
    };
  };

  const beginTimelineEdit = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 || !audioUrl || status === "analyzing") return;
    const { x, y, bounds } = timelinePoint(event);
    const canvas = event.currentTarget;
    const notes = activeNotes;
    if (notes.length) {
      const pitches = notes.map((note) => note.pitch);
      const minPitch = Math.min(...pitches) - 2;
      const maxPitch = Math.max(...pitches) + 2;
      const yFor = (pitch: number) => canvas.height - 18 - ((pitch - minPitch) / Math.max(1, maxPitch - minPitch)) * (canvas.height - 36);
      let nearestIndex = -1;
      let nearestDistance = Number.POSITIVE_INFINITY;
      notes.forEach((note, index) => {
        const noteX = (note.time / Math.max(0.1, result.duration)) * canvas.width;
        const distance = Math.hypot(noteX - x, yFor(note.pitch) - y);
        if (distance < nearestDistance) {
          nearestIndex = index;
          nearestDistance = distance;
        }
      });
      const hitRadius = 18 * (canvas.width / Math.max(1, bounds.width));
      if (nearestIndex >= 0 && nearestDistance <= hitRadius) {
        audioRef.current?.pause();
        const note = notes[nearestIndex];
        timelineDragRef.current = { pointerId: event.pointerId, note, moved: false };
        setSelectedNoteIndex(result.notes.indexOf(note));
        seek(note.time);
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
    }
    setSelectedNoteIndex(null);
    seek((x / canvas.width) * result.duration);
  };

  const dragTimelineNote = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = timelineDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const { x } = timelinePoint(event);
    const time = clamp((x / event.currentTarget.width) * result.duration, 0, result.duration);
    const startsMoving = !drag.moved && Math.abs(time - drag.note.time) > 0.002;
    if (startsMoving) recordDebugUndo(result, timingOffsetMs);
    drag.moved = drag.moved || startsMoving;
    setResult((previous) => {
      const index = previous.notes.indexOf(drag.note);
      if (index < 0) return previous;
      const updated: MelodyNote = { ...drag.note, time, source: "manual" };
      drag.note = updated;
      const notes = previous.notes.slice();
      notes[index] = updated;
      return { ...previous, notes };
    });
    if (audioRef.current) audioRef.current.currentTime = time;
    currentTimeRef.current = time;
    lastPianoMediaTimeRef.current = time;
    setCurrentTime(time);
  };

  const endTimelineEdit = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = timelineDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    timelineDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const edited = drag.note;
    setResult((previous) => {
      const notes = previous.notes.slice().sort((a, b) => a.time - b.time);
      setSelectedNoteIndex(notes.indexOf(edited));
      return { ...previous, notes };
    });
    setHasOfficialScore(false);
    void auditionPianoNote(edited.pitch, edited.velocity);
    setStage(`${drag.moved ? "落点已拖到" : "已选中落点"} ${formatPreciseTime(edited.time)} · ${noteName(edited.pitch)}`);
  };

  const transposeSelectedNote = (semitones: number) => {
    if (selectedNoteIndex === null || !result.notes[selectedNoteIndex]) return;
    recordDebugUndo(result, timingOffsetMs);
    const pitch = clamp(result.notes[selectedNoteIndex].pitch + semitones, 36, 96);
    const notes = result.notes.map((note, index) => index === selectedNoteIndex
      ? { ...note, pitch, source: "manual" as const }
      : note);
    setResult({ ...result, notes });
    setSelectedNoteIndices([]);
    setHasOfficialScore(false);
    void auditionPianoNote(pitch, result.notes[selectedNoteIndex].velocity);
    setStage(`已将选中落点改为 ${noteName(pitch)}`);
  };

  const updateSelectedNoteValue = (patch: Partial<Pick<MelodyNote, "time" | "duration" | "pitch" | "velocity">>) => {
    if (selectedNoteIndex === null || !result.notes[selectedNoteIndex]) return;
    recordDebugUndo(result, timingOffsetMs);
    const selected = result.notes[selectedNoteIndex];
    const updated: MelodyNote = {
      ...selected,
      ...patch,
      time: clamp(patch.time ?? selected.time, 0, result.duration),
      duration: clamp(patch.duration ?? selected.duration, 0.08, 8),
      pitch: Math.round(clamp(patch.pitch ?? selected.pitch, 36, 96)),
      velocity: clamp(patch.velocity ?? selected.velocity, 0.1, 1),
      source: "manual",
    };
    const notes = result.notes.map((note, index) => index === selectedNoteIndex ? updated : note)
      .sort((a, b) => a.time - b.time);
    const nextIndex = notes.indexOf(updated);
    setResult({ ...result, notes });
    setSelectedNoteIndex(nextIndex);
    setSelectedNoteIndices([]);
    setHasOfficialScore(false);
    seek(updated.time);
  };

  const removeNearestLanding = () => {
    const time = currentTimeRef.current;
    let nearestIndex = -1;
    let nearestDistance = Number.POSITIVE_INFINITY;
    result.notes.forEach((note, index) => {
      const distance = Math.abs(note.time - time);
      if (distance < nearestDistance) {
        nearestIndex = index;
        nearestDistance = distance;
      }
    });
    if (nearestIndex < 0 || nearestDistance > 0.75) {
      setStage("当前位置 0.75 秒内没有可删除的落点");
      return;
    }
    recordDebugUndo(result, timingOffsetMs);
    const notes = result.notes.filter((_, index) => index !== nearestIndex);
    setResult({ ...result, notes });
    setSelectedNoteIndex(null);
    setStage(`已删除 ${formatTime(time)} 附近的落点`);
  };

  const debugPointerData = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = clamp(event.clientX - bounds.left, 0, bounds.width);
    const y = clamp(event.clientY - bounds.top, 0, bounds.height);
    const geometry = debugEditorGeometry(
      bounds.width,
      bounds.height,
      result,
      currentTimeRef.current,
      debugWindowSeconds,
      manualEditMode === "trigger",
    );
    return {
      x,
      y,
      geometry,
      time: snapEditorTime(geometry.timeFor(x), debugSnapMs, result.duration),
      pitch: Math.round(clamp(geometry.pitchFor(y), 36, 96)),
    };
  };

  const findDebugNoteHit = (x: number, y: number, geometry: ReturnType<typeof debugEditorGeometry>) => {
    let best: { note: MelodyNote; index: number; resize: boolean; distance: number } | null = null;
    for (const [index, note] of result.notes.entries()) {
      if (note.time < geometry.range.start - note.duration || note.time > geometry.range.end) continue;
      const startX = geometry.xFor(note.time);
      const endX = manualEditMode === "trigger"
        ? startX + 12
        : geometry.xFor(Math.min(result.duration, note.time + Math.max(0.04, note.duration)));
      const noteY = geometry.yFor(note.pitch);
      const horizontalDistance = x < startX ? startX - x : x > Math.max(startX + 4, endX) ? x - Math.max(startX + 4, endX) : 0;
      const verticalDistance = Math.abs(noteY - y);
      const distance = Math.hypot(horizontalDistance, verticalDistance);
      if (verticalDistance <= 13 && horizontalDistance <= 9 && (!best || distance < best.distance)) {
        best = {
          note,
          index,
          resize: manualEditMode === "sound" && endX - startX >= 18 && Math.abs(x - endX) <= 9,
          distance,
        };
      }
    }
    return best;
  };

  const notesInsideDebugSelection = (
    rect: DebugSelectionRect,
    geometry: ReturnType<typeof debugEditorGeometry>,
  ) => {
    const rectRight = rect.x + rect.width;
    const rectBottom = rect.y + rect.height;
    return result.notes.flatMap((note, index) => {
      if (note.time < geometry.range.start - note.duration || note.time > geometry.range.end) return [];
      const startX = geometry.xFor(note.time);
      const endX = manualEditMode === "trigger"
        ? startX + 12
        : geometry.xFor(Math.min(result.duration, note.time + Math.max(0.04, note.duration)));
      const y = geometry.yFor(note.pitch);
      const verticalIntersects = manualEditMode === "trigger" || (y + 11 >= rect.y && y - 11 <= rectBottom);
      const intersects = Math.max(startX - 8, rect.x) <= Math.min(endX + 8, rectRight) && verticalIntersects;
      return intersects ? [index] : [];
    });
  };

  const beginDebugNoteEdit = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0 || status === "analyzing") return;
    event.currentTarget.focus();
    const pointer = debugPointerData(event);
    const hit = findDebugNoteHit(pointer.x, pointer.y, pointer.geometry);

    if (debugEditTool === "erase") {
      if (hit) {
        recordDebugUndo(result, timingOffsetMs);
        setResult((previous) => ({ ...previous, notes: previous.notes.filter((note) => note !== hit.note) }));
        setSelectedNoteIndex(null);
        setSelectedNoteIndices([]);
        setDebugSelectionRect(null);
        setHasOfficialScore(false);
        setStage(`已在调试轨道删除 ${formatPreciseTime(hit.note.time)} 的砖块触发点`);
      } else {
        seek(pointer.time);
      }
      return;
    }

    audioRef.current?.pause();
    let note: MelodyNote;
    let index: number;
    let mode: DebugNoteDrag["mode"];
    let created = false;
    const pointerIsInPianoRoll = pointer.y >= pointer.geometry.noteTop - 12 && pointer.y <= pointer.geometry.noteBottom + 12;
    if (debugEditTool === "select" && !hit && pointerIsInPianoRoll) {
      debugMarqueeDragRef.current = {
        pointerId: event.pointerId,
        startX: pointer.x,
        startY: pointer.y,
        currentX: pointer.x,
        currentY: pointer.y,
        time: pointer.time,
        pitch: pointer.pitch,
        moved: false,
      };
      setSelectedNoteIndex(null);
      setSelectedNoteIndices([]);
      setDebugSelectionRect({ x: pointer.x, y: pointer.y, width: 0, height: 0 });
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (debugEditTool === "draw" && pointerIsInPianoRoll) {
      note = {
        time: pointer.time,
        duration: manualEditMode === "trigger" ? 0.18 : 0.32,
        pitch: manualEditMode === "trigger" ? 60 : pointer.pitch,
        confidence: 1,
        velocity: 0.92,
        source: "manual",
      };
      const dedupeSeconds = manualEditMode === "trigger" ? MANUAL_TRIGGER_DEDUPE_SECONDS : 0.035;
      const notes = [...result.notes.filter((existing) => !(Math.abs(existing.time - note.time) < dedupeSeconds && existing.pitch === note.pitch)), note]
        .sort((a, b) => a.time - b.time);
      index = notes.indexOf(note);
      mode = manualEditMode === "trigger" ? "move" : "resize";
      created = true;
      recordDebugUndo(result, timingOffsetMs);
      setResult({ ...result, notes });
      setHasOfficialScore(false);
    } else if (hit) {
      note = hit.note;
      index = hit.index;
      mode = hit.resize ? "resize" : "move";
    } else {
      setSelectedNoteIndex(null);
      setSelectedNoteIndices([]);
      setDebugSelectionRect(null);
      seek(pointer.time);
      return;
    }

    setSelectedNoteIndex(index);
    setSelectedNoteIndices([]);
    setDebugSelectionRect(null);
    seek(note.time);
    debugNoteDragRef.current = {
      pointerId: event.pointerId,
      note,
      mode,
      pointerTime: pointer.time,
      pointerPitch: pointer.pitch,
      startTime: note.time,
      startPitch: note.pitch,
      startDuration: note.duration,
      moved: false,
      created,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    void auditionPianoNote(note.pitch, note.velocity);
  };

  const moveDebugNote = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const marquee = debugMarqueeDragRef.current;
    if (marquee && marquee.pointerId === event.pointerId) {
      const pointer = debugPointerData(event);
      marquee.currentX = pointer.x;
      marquee.currentY = pointer.y;
      marquee.moved = marquee.moved || Math.hypot(pointer.x - marquee.startX, pointer.y - marquee.startY) >= 5;
      const rect = {
        x: Math.min(marquee.startX, pointer.x),
        y: Math.min(marquee.startY, pointer.y),
        width: Math.abs(pointer.x - marquee.startX),
        height: Math.abs(pointer.y - marquee.startY),
      };
      setDebugSelectionRect(rect);
      if (marquee.moved) {
        const indexes = notesInsideDebugSelection(rect, pointer.geometry);
        setSelectedNoteIndices(indexes);
        setSelectedNoteIndex(indexes[0] ?? null);
      }
      return;
    }
    const drag = debugNoteDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const pointer = debugPointerData(event);
    const timeDelta = pointer.time - drag.pointerTime;
    const startsMoving = !drag.created && !drag.moved && (
      Math.abs(timeDelta) > 0.001 ||
      (manualEditMode === "sound" && Math.abs(pointer.pitch - drag.pointerPitch) >= 1)
    );
    if (startsMoving) recordDebugUndo(result, timingOffsetMs);
    setResult((previous) => {
      const index = previous.notes.indexOf(drag.note);
      if (index < 0) return previous;
      const updated: MelodyNote = drag.mode === "resize"
        ? {
          ...drag.note,
          duration: Math.max(0.08, snapEditorTime(drag.startTime + drag.startDuration + timeDelta, debugSnapMs, previous.duration) - drag.startTime),
          source: "manual",
        }
        : {
          ...drag.note,
          time: snapEditorTime(drag.startTime + timeDelta, debugSnapMs, previous.duration),
          pitch: manualEditMode === "trigger"
            ? 60
            : Math.round(clamp(drag.startPitch + pointer.pitch - drag.pointerPitch, 36, 96)),
          source: "manual",
        };
      drag.moved = drag.moved || updated.time !== drag.startTime || updated.pitch !== drag.startPitch || updated.duration !== drag.startDuration;
      drag.note = updated;
      const notes = previous.notes.slice();
      notes[index] = updated;
      setSelectedNoteIndex(index);
      return { ...previous, notes };
    });
    const previewTime = drag.mode === "resize" ? drag.startTime : drag.note.time;
    if (audioRef.current) audioRef.current.currentTime = previewTime;
    currentTimeRef.current = previewTime;
    lastPianoMediaTimeRef.current = previewTime;
    setCurrentTime(previewTime);
  };

  const endDebugNoteEdit = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const marquee = debugMarqueeDragRef.current;
    if (marquee && marquee.pointerId === event.pointerId) {
      debugMarqueeDragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      const cancelled = event.type === "pointercancel";
      setDebugSelectionRect(null);
      if (cancelled) return;
      if (marquee.moved) {
        const pointer = debugPointerData(event);
        const rect = {
          x: Math.min(marquee.startX, pointer.x),
          y: Math.min(marquee.startY, pointer.y),
          width: Math.abs(pointer.x - marquee.startX),
          height: Math.abs(pointer.y - marquee.startY),
        };
        const indexes = notesInsideDebugSelection(rect, pointer.geometry);
        setSelectedNoteIndices(indexes);
        setSelectedNoteIndex(indexes[0] ?? null);
        const selectedCount = indexes.length;
        setStage(selectedCount
          ? `已框选 ${selectedCount} 个砖块触发点 · 按 ESC、Backspace 或 Delete 批量删除`
          : "框选范围内没有砖块触发点");
      } else {
        addManualLanding(marquee.time, marquee.pitch);
      }
      return;
    }
    const drag = debugNoteDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    debugNoteDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const edited = drag.note;
    setResult((previous) => {
      const notes = previous.notes.slice().sort((a, b) => a.time - b.time);
      setSelectedNoteIndex(notes.indexOf(edited));
      setSelectedNoteIndices([]);
      return { ...previous, notes };
    });
    setHasOfficialScore(false);
    if (manualEditMode === "trigger") previewLandingCollision(edited.time);
    else seek(edited.time);
    void auditionPianoNote(edited.pitch, edited.velocity);
    setStage(manualEditMode === "trigger"
      ? `砖块触发时间已设为 ${formatPreciseTime(edited.time)}`
      : `${drag.created && !drag.moved ? "已新增音符" : drag.mode === "resize" ? "音符长度已编辑" : "时间/音高已编辑"} · ${formatPreciseTime(edited.time)} · ${noteName(edited.pitch)}`);
  };

  const nudgeSelectedNote = (milliseconds: number) => {
    if (selectedNoteIndex === null || !result.notes[selectedNoteIndex]) return;
    recordDebugUndo(result, timingOffsetMs);
    const selected = result.notes[selectedNoteIndex];
    const updated = {
      ...selected,
      time: clamp(selected.time + milliseconds / 1_000, 0, result.duration),
      source: "manual" as const,
    };
    const notes = result.notes.map((note, index) => index === selectedNoteIndex ? updated : note)
      .sort((a, b) => a.time - b.time);
    const nextIndex = notes.indexOf(updated);
    setResult({ ...result, notes });
    setSelectedNoteIndex(nextIndex);
    setSelectedNoteIndices([]);
    seek(updated.time);
    setHasOfficialScore(false);
    setStage(`已将选中落点${milliseconds < 0 ? "提前" : "延后"} ${Math.abs(milliseconds)}ms`);
  };

  const deleteSelectedNote = useCallback(() => {
    const indexes = selectedNoteIndices.length
      ? [...new Set(selectedNoteIndices)]
      : selectedNoteIndex === null ? [] : [selectedNoteIndex];
    if (!indexes.length) return;
    recordDebugUndo(result, timingOffsetMs);
    const indexSet = new Set(indexes);
    const removed = result.notes[indexes[0]];
    setResult((previous) => ({ ...previous, notes: previous.notes.filter((_, index) => !indexSet.has(index)) }));
    setSelectedNoteIndex(null);
    setSelectedNoteIndices([]);
    setDebugSelectionRect(null);
    setHasOfficialScore(false);
    setStage(indexes.length > 1
      ? `已批量删除 ${indexes.length} 个砖块触发点`
      : `已删除 ${formatPreciseTime(removed?.time ?? 0)} 的砖块触发点`);
  }, [recordDebugUndo, result, selectedNoteIndex, selectedNoteIndices, timingOffsetMs]);

  useEffect(() => {
    const handleEditorShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.matches("input, textarea, select") || target?.isContentEditable;
      if (isTyping) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && debugUndoStackRef.current.length) {
        event.preventDefault();
        undoDebugEdit();
        return;
      }
      if ((selectedNoteIndex !== null || selectedNoteIndices.length > 0) && ["Escape", "Backspace", "Delete"].includes(event.key)) {
        event.preventDefault();
        deleteSelectedNote();
        return;
      }
      if (event.key === "Escape" && debugExpanded) setDebugExpanded(false);
    };
    window.addEventListener("keydown", handleEditorShortcut);
    return () => window.removeEventListener("keydown", handleEditorShortcut);
  }, [debugExpanded, deleteSelectedNote, selectedNoteIndex, selectedNoteIndices.length, undoDebugEdit]);

  const applyGlobalOffset = (nextOffsetMs: number) => {
    const next = clamp(nextOffsetMs, -240, 240);
    if (next === timingOffsetMs) return;
    recordDebugUndo(result, timingOffsetMs);
    const delta = (next - timingOffsetMs) / 1_000;
    setResult({
      ...result,
      notes: result.notes.map((note) => ({
        ...note,
        time: clamp(note.time + delta, 0, result.duration),
        source: note.source === "score" ? "manual" : note.source,
      })),
    });
    setTimingOffsetMs(next);
    setHasOfficialScore(false);
    setStage(`整条轨道已${next < 0 ? "提前" : next > 0 ? "延后" : "恢复"} ${Math.abs(next)}ms`);
  };

  const exportDebugJson = () => {
    const payload = {
      track: fileName,
      duration: result.duration,
      profile: result.diagnostics?.profile ?? analysisProfile,
      sensitivity,
      global_offset_ms: timingOffsetMs,
      model_only_points_muted: modelPointsMuted,
      active_note_count: activeNotes.length,
      notes: result.notes.map((note) => ({
        time_seconds: Number(note.time.toFixed(4)),
        pitch: note.pitch,
        name: noteName(note.pitch),
        source: note.source ?? "detected",
        confidence: Number(note.confidence.toFixed(3)),
        model_confidence: Number((note.modelConfidence ?? 0).toFixed(3)),
        onset_evidence: onsetEvidenceText(note),
        active: !(modelPointsMuted && note.source === "model"),
      })),
      model_candidates: result.diagnostics?.modelCandidates ?? [],
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName.replace(/\.[^.]+$/, "") || "music"}-踩点调试.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStage("已导出踩点调试 JSON，可直接发给开发者复查");
  };

  const exportEditableScore = () => {
    const payload: EditableScoreFile = {
      format: "orbitone-music-score",
      version: 2,
      title: fileName.replace(/\.[^.]+$/, ""),
      duration: Number(result.duration.toFixed(4)),
      notes: activeNotes.map((note) => ({
        time: Number(note.time.toFixed(4)),
        duration: Number(note.duration.toFixed(4)),
        pitch: note.pitch,
        velocity: Number(note.velocity.toFixed(3)),
      })),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName.replace(/\.[^.]+$/, "").replace(/[^\w\u4e00-\u9fa5-]+/g, "-") || "music"}-弹跳谱面.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setStage(`已导出 ${activeNotes.length} 个弹跳点 · 下次可与原音频一起载入`);
  };

  const loadEditableScore = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as Partial<EditableScoreFile>;
      if (parsed.format !== "orbitone-music-score" || parsed.version !== 2 || !Array.isArray(parsed.notes)) {
        throw new Error("Invalid score");
      }
      const notes = parsed.notes.map((note): MelodyNote | null => {
        const time = Number(note.time);
        if (!Number.isFinite(time) || time < 0 || time > result.duration) return null;
        return {
          time,
          duration: clamp(Number(note.duration) || 0.34, 0.08, 8),
          pitch: Math.round(clamp(Number(note.pitch) || 60, 36, 96)),
          velocity: clamp(Number(note.velocity) || 1, 0.1, 1),
          confidence: 1,
          source: "manual",
        };
      }).filter((note): note is MelodyNote => Boolean(note)).sort((a, b) => a.time - b.time);
      if (!notes.length) throw new Error("Empty score");
      recordDebugUndo(result, timingOffsetMs);
      setResult({ ...result, notes, quality: "high", diagnostics: undefined });
      setSelectedNoteIndex(null);
      setHasOfficialScore(false);
      setTimingOffsetMs(0);
      seek(0);
      setStage(`已载入自定义谱面 ${file.name} · ${notes.length} 个弹跳点`);
    } catch (error) {
      console.error(error);
      setStage("谱面无法识别，请选择由 ORBITONE 导出的弹跳谱面 JSON");
    }
  };

  const saveVisualConfig = () => {
    const payload = {
      format: "orbitone-visual-config",
      version: 1,
      saved_at: new Date().toISOString(),
      visual_style: {
        ...visualStyle,
        mazeSkin: visualStyle.mazeSkin === "custom" ? "crimson" : visualStyle.mazeSkin,
        mazeCustomSkinUrl: "",
        mazeCustomVideoUrl: "",
      },
      analysis: {
        profile: analysisProfile,
        sensitivity,
        visual_sync_ms: visualSyncMs,
      },
      export: {
        auto_save_video: autoSaveVideo,
      },
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `orbitone-${layoutTemplate}-配置.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setStage("视觉配置已保存为 JSON 文件");
  };

  const persistCreatorSettings = useCallback(async (announce: boolean) => {
    setCreatorSettingsState("saving");
    try {
      let persistedCustomSkin: PersistedCreatorSettings["customMazeSkin"];
      if (customMazeSkin) {
        const response = await fetch(customMazeSkin.url);
        if (!response.ok) throw new Error("Unable to read custom maze skin");
        persistedCustomSkin = {
          blob: await response.blob(),
          name: customMazeSkin.name,
          width: customMazeSkin.width,
          height: customMazeSkin.height,
        };
      }
      const { mazeCustomSkinUrl, mazeCustomVideoUrl, ...persistedVisualStyle } = visualStyle;
      void mazeCustomSkinUrl;
      void mazeCustomVideoUrl;
      const savedAt = Date.now();
      const sharedSettings = {
        savedAt,
        visualStyle: persistedVisualStyle,
        analysis: {
          profile: analysisProfile,
          sensitivity,
          visualSyncMs,
        },
        export: {
          autoSaveVideo,
        },
        editor: {
          manualEditMode,
          pianoSoundEnabled,
          pianoVolume,
          debugSnapMs,
          debugWindowSeconds,
          debugPlaybackRate,
          debugPreviewOpen,
          debugPreviewWidth,
        },
        ...(persistedCustomSkin ? { customMazeSkin: persistedCustomSkin } : {}),
      };
      const trackId = currentTrackConfigIdRef.current;
      const writes: Promise<unknown>[] = [saveCreatorSettings(sharedSettings)];
      if (trackId && trackSettingsHydratedRef.current) {
        writes.push(saveTrackCreatorSettings({
          ...sharedSettings,
          trackId,
          trackLabel: currentTrackLabel || fileName,
          trackState: {
            result: withoutModelOnlyNotes(result),
            timingOffsetMs,
            hasOfficialScore,
            debugEditTool,
            debugExpanded,
            debugPreviewPosition,
          },
        }));
      }
      await Promise.all(writes);
      setCreatorSettingsSavedAt(savedAt);
      setCreatorSettingsState("saved");
      if (announce) {
        setStage(trackId
          ? `「${currentTrackLabel || fileName}」的设计与算法配置已单独保存`
          : "当前页面设置已保存");
      }
      return true;
    } catch (error) {
      console.error("保存成片设置失败", error);
      setCreatorSettingsState("error");
      setStage("设置保存失败，请确认浏览器允许本站使用本地存储");
      return false;
    }
  }, [
    analysisProfile,
    autoSaveVideo,
    customMazeSkin,
    currentTrackLabel,
    debugEditTool,
    debugExpanded,
    debugPlaybackRate,
    debugPreviewPosition,
    debugPreviewOpen,
    debugPreviewWidth,
    debugSnapMs,
    debugWindowSeconds,
    fileName,
    hasOfficialScore,
    manualEditMode,
    pianoSoundEnabled,
    pianoVolume,
    sensitivity,
    result,
    timingOffsetMs,
    visualStyle,
    visualSyncMs,
  ]);

  const saveCurrentSongCompletely = useCallback(async () => {
    const settingsSaved = await persistCreatorSettings(false);
    if (!settingsSaved) return;
    const musicSaved = await saveCurrentMusicLocally(false);
    if (!musicSaved) return;
    setStage(customMazeVideo
      ? `「${currentTrackLabel || fileName}」的配置、音频、谱面和视频背景已专属保存`
      : `「${currentTrackLabel || fileName}」的配置、音频和谱面已保存到本地曲库`);
  }, [currentTrackLabel, customMazeVideo, fileName, persistCreatorSettings, saveCurrentMusicLocally]);

  useEffect(() => {
    if (!creatorSettingsHydratedRef.current) return;
    const timer = window.setTimeout(() => {
      void persistCreatorSettings(false);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [persistCreatorSettings]);

  const loadVisualConfig = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as {
        format?: string;
        visual_style?: Partial<VisualStyle>;
        analysis?: { profile?: AnalysisProfile; sensitivity?: number; visual_sync_ms?: number };
        export?: { auto_save_video?: boolean };
      };
      if (parsed.format !== "orbitone-visual-config" || !parsed.visual_style) throw new Error("Invalid config");
      applyVisualStyle(parsed.visual_style);
      if (parsed.analysis?.profile && ["balanced", "piano", "rhythm"].includes(parsed.analysis.profile)) setAnalysisProfile(parsed.analysis.profile);
      if (typeof parsed.analysis?.sensitivity === "number") setSensitivity(clamp(parsed.analysis.sensitivity, 20, 92));
      if (typeof parsed.analysis?.visual_sync_ms === "number") setVisualSyncMs(clamp(parsed.analysis.visual_sync_ms, 0, 500));
      if (typeof parsed.export?.auto_save_video === "boolean") setAutoSaveVideo(parsed.export.auto_save_video);
      setStage(`已载入视觉配置：${file.name}`);
    } catch (error) {
      console.error(error);
      setStage("配置文件无法识别，请选择由 ORBITONE 导出的 JSON");
    }
  };

  const saveCurrentFrame = () => {
    // Render the current moment off-screen at the selected export resolution
    // instead of capturing the 540×960 live canvas, so the PNG matches the
    // video export quality. Logical coordinates stay 540×960 — only sharper.
    const preset = EXPORT_RESOLUTIONS[exportResolution];
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = preset.width;
    exportCanvas.height = preset.height;
    const context = exportCanvas.getContext("2d");
    if (!context) {
      setStage("当前画面保存失败，请稍后重试");
      return;
    }
    const backingScale = preset.width / 540;
    context.setTransform(backingScale, 0, 0, backingScale, 0, 0);
    const clock = audioRef.current;
    const time = clamp(clock?.currentTime ?? currentTimeRef.current, 0, durationRef.current);
    renderMusicBox(context, 540, 960, time, notesRef.current, durationRef.current, styleRef.current);
    exportCanvas.toBlob((blob) => {
      if (!blob) {
        setStage("当前画面保存失败，请稍后重试");
        return;
      }
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const baseName = fileName.replace(/\.[^.]+$/, "").replace(/[^\w\u4e00-\u9fa5-]+/g, "-") || "orbitone";
      link.href = downloadUrl;
      link.download = `${baseName}-${layoutTemplate}-${preset.width}x${preset.height}.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1_000);
      setStage(`当前 9:16 画面已保存为 ${preset.width}×${preset.height} PNG`);
    }, "image/png");
  };

  const exportVideo = async () => {
    if (!audioUrl || exporting || !canvasRef.current) return;
    const canvas = canvasRef.current as HTMLCanvasElement & {
      captureStream?: (frameRate?: number) => MediaStream;
    };
    if (!canvas.captureStream || !window.MediaRecorder) {
      setStage("当前浏览器不支持直接导出，建议使用 Chrome 或 Safari");
      return;
    }

    setExporting(true);
    setExportProgress(0);
    audioRef.current?.pause();
    setPlaying(false);
    const preset = EXPORT_RESOLUTIONS[exportResolution];
    setStage(`正在实时生成 ${preset.width}×${preset.height} 视频`);

    // The on-screen canvas stays 540×960, but the export uses a larger backing
    // store for sharper video. The render loop scales the drawing context, so
    // proportions stay identical; restore the canvas size when done.
    const previousWidth = canvas.width;
    const previousHeight = canvas.height;

    let audioContext: AudioContext | null = null;
    try {
      const exportAudio = new Audio(audioUrl);
      exportAudio.preload = "auto";
      exportAudio.playbackRate = 1;
      await new Promise<void>((resolve, reject) => {
        exportAudio.oncanplaythrough = () => resolve();
        exportAudio.onerror = () => reject(new Error("Export audio unavailable"));
        exportAudio.load();
      });
      audioContext = new AudioContext();
      const source = audioContext.createMediaElementSource(exportAudio);
      const destination = audioContext.createMediaStreamDestination();
      source.connect(destination);
      source.connect(audioContext.destination);
      const exportPianoGain = audioContext.createGain();
      exportPianoGain.gain.value = pianoSoundEnabledRef.current ? pianoVolumeRef.current / 100 : 0;
      exportPianoGain.connect(destination);
      exportPianoGain.connect(audioContext.destination);
      const exportPianoNotes = [...notesRef.current].sort((a, b) => a.time - b.time);
      let exportPianoIndex = 0;
      const scheduleExportPianoWindow = () => {
        if (!audioContext || !pianoSoundEnabledRef.current) return;
        const mediaTime = exportAudio.currentTime;
        while (exportPianoIndex < exportPianoNotes.length && exportPianoNotes[exportPianoIndex].time <= mediaTime + 0.18) {
          const note = exportPianoNotes[exportPianoIndex];
          const delay = Math.max(0, note.time - mediaTime);
          scheduleSynthPianoNote(audioContext, exportPianoGain, note.pitch, note.velocity, audioContext.currentTime + delay);
          exportPianoIndex += 1;
        }
      };

      canvas.width = preset.width;
      canvas.height = preset.height;
      const canvasStream = canvas.captureStream(30);
      const combined = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...destination.stream.getAudioTracks(),
      ]);
      const candidates = [
        "video/mp4;codecs=h264,aac",
        "video/mp4",
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ];
      const mimeType = candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || "";
      const recorder = new MediaRecorder(combined, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: preset.bitrate,
      });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };

      await new Promise<void>(async (resolve, reject) => {
        recorder.onerror = () => reject(new Error("Recorder failed"));
        recorder.onstop = () => {
          if (progressTimer) window.clearInterval(progressTimer);
          const type = recorder.mimeType || mimeType || "video/webm";
          const extension = type.includes("mp4") ? "mp4" : "webm";
          const blob = new Blob(chunks, { type });
          const downloadUrl = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = downloadUrl;
          link.download = `${fileName.replace(/\.[^.]+$/, "").replace(/[^\w\u4e00-\u9fa5-]+/g, "-") || "orbitone"}-9x16.${extension}`;
          link.click();
          window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 2_000);
          resolve();
        };
        exportAudio.currentTime = 0;
        exportAudioRef.current = exportAudio;
        recorder.start(500);
        await audioContext?.resume();
        scheduleExportPianoWindow();
        await exportAudio.play();
        const progressTimer = window.setInterval(() => {
          scheduleExportPianoWindow();
          setExportProgress(clamp(exportAudio.currentTime / result.duration, 0, 1));
          if (exportAudio.currentTime >= result.duration || exportAudio.ended) {
            exportAudio.pause();
            if (recorder.state !== "inactive") recorder.stop();
          }
        }, 120);
      });

      setStage("视频已生成，请查看下载文件");
    } catch (error) {
      console.error(error);
      setStage("导出未完成，请换用 Chrome 或缩短音频后重试");
    } finally {
      canvas.width = previousWidth;
      canvas.height = previousHeight;
      exportAudioRef.current?.pause();
      exportAudioRef.current = null;
      await audioContext?.close();
      setExporting(false);
      setExportProgress(0);
      setCurrentTime(0);
    }
  };

  // Frame-accurate offline export: renders each frame at an exact timestamp and
  // encodes with hardware WebCodecs, so the ball can never fall behind the
  // beat — regardless of resolution or machine load. Slower than real-time
  // recording, but the output is always perfectly synced.
  const exportVideoOffline = async () => {
    if (!audioUrl || exporting) return;
    if (!isOfflineExportSupported()) {
      setStage("当前浏览器不支持逐帧导出，已改用实时录制");
      await exportVideo();
      return;
    }
    setExporting(true);
    setExportProgress(0);
    audioRef.current?.pause();
    setPlaying(false);
    const preset = EXPORT_RESOLUTIONS[exportResolution];
    setStage(`正在逐帧渲染 ${preset.width}×${preset.height} 视频`);
    try {
      const response = await fetch(audioUrl);
      const audioBytes = await response.arrayBuffer();
      const blob = await exportOfflineVideo({
        width: preset.width,
        height: preset.height,
        bitrate: preset.bitrate,
        notes: notesRef.current,
        duration: durationRef.current,
        style: styleRef.current,
        audioBytes,
        pianoEnabled: pianoSoundEnabledRef.current,
        pianoVolume: pianoVolumeRef.current,
        onProgress: (ratio) => setExportProgress(clamp(ratio, 0, 1)),
      });
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `${fileName.replace(/\.[^.]+$/, "").replace(/[^\w一-龥-]+/g, "-") || "orbitone"}-9x16.mp4`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 2_000);
      setStage("超清视频已生成，请查看下载文件");    } catch (error) {
      console.error(error);
      setStage("逐帧导出失败，可改用实时录制或降低清晰度");
    } finally {
      setExporting(false);
      setExportProgress(0);
      setCurrentTime(0);
    }
  };

  const modelCandidates = result.diagnostics?.modelCandidates ?? [];
  const matchedCandidates = modelCandidates.filter((candidate) => candidate.status === "matched").length;
  const addedCandidates = modelCandidates.filter((candidate) => candidate.status === "added").length;
  const filteredCandidates = modelCandidates.length - matchedCandidates - addedCandidates;
  const visibleDebugRange = debugTimeRange(currentTime, result.duration, debugWindowSeconds);
  const visibleDebugNotes = result.notes
    .map((note, index) => ({ note, index }))
    .filter(({ note }) => note.time >= visibleDebugRange.start && note.time <= visibleDebugRange.end);
  const listedDebugNotes = visibleDebugNotes.length <= 80
    ? visibleDebugNotes
    : [...visibleDebugNotes]
      .sort((a, b) => Math.abs(a.note.time - currentTime) - Math.abs(b.note.time - currentTime))
      .slice(0, 80)
      .sort((a, b) => a.note.time - b.note.time);

  const setAllSettingsOpen = (open: boolean) => {
    stylePanelRef.current
      ?.querySelectorAll<HTMLDetailsElement>("details.collapsible-setting")
      .forEach((section) => { section.open = open; });
  };

  const revealDebugConsole = () => {
    window.requestAnimationFrame(() => {
      debugConsoleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <main className="studio-shell">
      <header className="topbar">
        <div className="brand-lockup">
          {/* The Sites runtime serves this tiny local brand asset directly. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src="/kexueyang.jpg" alt="科学羊 Logo" width={40} height={40} />
          <div>
            <div className="brand-name">ORBITONE</div>
            <div className="brand-subtitle">星轨音乐盒</div>
          </div>
        </div>
        <div className="topbar-meta">
          <span className="privacy-note"><span className="live-dot" /> 本地解析，音乐不上传</span>
          <span className="creator-credit">开发者：<b>科学羊</b><small>来源：科学羊原创实验项目</small></span>
          <span className="version-tag">CREATOR LAB / 01</span>
        </div>
      </header>

      <div className="workspace">
        <aside className="control-panel import-panel">
          <div className="section-heading">
            <span>01</span>
            <div>
              <h1>导入你的音乐</h1>
              <p>自动提取主旋律，生成弹珠轨迹</p>
            </div>
          </div>

          <button
            type="button"
            className={`drop-zone ${dragging ? "is-dragging" : ""}`}
            onClick={() => inputRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              handleFiles(event.dataTransfer.files);
            }}
          >
            <span className="upload-orbit" aria-hidden="true"><span>↑</span></span>
            <strong>点击上传或拖入音乐</strong>
            <small>MP3 / WAV / M4A / AAC / OGG / FLAC · 最大 80MB</small>
          </button>
          <input
            ref={inputRef}
            className="visually-hidden"
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
            onChange={(event) => {
              if (event.target.files) handleFiles(event.target.files);
              event.currentTarget.value = "";
            }}
          />

          <div className="music-fit-guide" aria-label="适用音乐类型说明">
            <div><b>上传前先看</b><span>开源版适用范围</span></div>
            <p><strong>推荐：</strong>钢琴独奏、单音旋律清楚、触键明确、混响较少的录音；快速钢琴也支持，但建议使用慢动作复核。</p>
            <p><strong>暂不建议：</strong>人声、鼓、弦乐或笛声大量叠加，复杂齐奏、现场噪声和强混响音乐。</p>
            <small>请仅上传你拥有使用权的音乐。音频不会上传；只有点击“保存到本地曲库”后，才会写入当前浏览器的本地存储。</small>
          </div>

          <div className={`analysis-status status-${status}`}>
            <div className="analysis-copy">
              <span>{status === "analyzing" ? "旋律分析中" : fileName}</span>
              <b>{Math.round(progress * 100)}%</b>
            </div>
            <div className="analysis-track"><span style={{ width: `${progress * 100}%` }} /></div>
            <p>{stage}</p>
          </div>

          <section className="local-music-library" aria-label="本地音乐库">
            <div className="local-library-heading">
              <div><b>本地音乐库</b><small>IndexedDB · 不上传云端</small></div>
              <button
                type="button"
                onClick={() => void saveCurrentMusicLocally()}
                disabled={!audioUrl || status !== "ready" || localLibraryBusy}
              >
                {localSaveState === "saving"
                  ? "保存中…"
                  : currentLibraryId
                    ? "立即保存修改"
                    : "保存当前音乐"}
              </button>
            </div>
            {localMusicProjects.length ? (
              <div className="local-project-list">
                {localMusicProjects.map((project) => (
                  <div className={`local-project-row ${currentLibraryId === project.id ? "active" : ""}`} key={project.id}>
                    <button type="button" onClick={() => void openLocalMusic(project.id)} disabled={localLibraryBusy}>
                      <b>{project.name}</b>
                      <small>{formatTime(project.duration)} · {project.noteCount} 个音符 · {(project.audioBytes / 1024 / 1024).toFixed(1)}MB</small>
                    </button>
                    <button
                      type="button"
                      className="local-project-delete"
                      aria-label={`从本地曲库删除 ${project.name}`}
                      title="删除本地保存"
                      onClick={() => void deleteLocalMusic(project)}
                      disabled={localLibraryBusy}
                    >×</button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="local-library-empty">导入并校准后点击保存，下次打开同一浏览器和本地地址仍可继续编辑。</p>
            )}
            <p className={`local-library-state state-${localSaveState}`}>
              {localSaveState === "saved" && currentLibraryId
                ? "✓ 已保存，后续谱面修改会自动写入"
                : localSaveState === "error"
                  ? "保存不可用，请检查浏览器存储空间"
                  : "音频与谱面保存在此浏览器；清除网站数据会删除曲库"}
            </p>
          </section>

          <button
            type="button"
            className="sample-header sample-toggle"
            aria-expanded={samplesExpanded}
            aria-controls="sample-library"
            onClick={() => setSamplesExpanded((expanded) => !expanded)}
          >
            <span>免费测试样本 <b>{SAMPLE_TRACKS.length}</b></span>
            <small>{samplesExpanded ? "收起样本" : "展开选择"}<i aria-hidden="true">⌄</i></small>
          </button>
          <div id="sample-library" className="sample-library" hidden={!samplesExpanded}>
            <div className="sample-list">
              {SAMPLE_TRACKS.map((sample, index) => (
                <button
                  type="button"
                  className={`sample-row sample-${sample.accent}`}
                  key={sample.url}
                  onClick={() => void loadSample(sample)}
                  disabled={status === "analyzing"}
                >
                  <span className="sample-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="sample-copy">
                    <b>{sample.name}</b>
                    <small>{sample.description}</small>
                    {sample.sourceLabel && <em>来源：{sample.sourceLabel}</em>}
                    {sample.usageNote && <em className="sample-usage-warning">{sample.usageNote}</em>}
                  </span>
                  <span className="sample-play" aria-hidden="true">▶</span>
                </button>
              ))}
            </div>
            <div className="reference-source-note">
              <span>参考样本与方块玩法出处</span>
              <a href="https://github.com/quasar098/midi-playground" target="_blank" rel="noreferrer">
                quasar098/midi-playground ↗
              </a>
              <small>代码采用 GPL-3.0；仓库未为全部音乐提供清晰授权，参考曲不得直接用于对外发布。</small>
            </div>
          </div>

          <div className="analysis-summary">
            <div><small>生效音符</small><b>{activeNotes.length}</b></div>
            <div><small>估算速度</small><b>{result.tempo}<i>BPM</i></b></div>
            <div><small>调性</small><b>{result.keyLabel}</b></div>
          </div>
        </aside>

        <section className="preview-column" aria-label="9:16 视频预览">
          <div className="preview-heading">
            <div>
              <span className="eyebrow">LIVE COMPOSITION</span>
              <h2>9:16 成片预览</h2>
            </div>
            <span className={`quality-badge quality-${result.quality}`}>{qualityText[result.quality]}</span>
          </div>
          <div className="phone-stage">
            <div className="stage-glow" />
            <div className="canvas-frame">
              <canvas ref={canvasRef} width={540} height={960} aria-label="音乐弹珠动画预览" />
              {status === "analyzing" && (
                <div className="canvas-processing">
                  <span className="processing-orbit" />
                  <b>{Math.round(progress * 100)}%</b>
                  <small>{stage}</small>
                </div>
              )}
            </div>
          </div>

          <div className="transport">
            <button
              type="button"
              className="play-button"
              onClick={() => {
                if (autoSaveVideo && !playing) void exportVideo();
                else void togglePlay();
              }}
              disabled={exporting}
              aria-label={playing ? "暂停" : autoSaveVideo ? "播放并自动保存视频" : "播放"}
            >
              {playing ? "Ⅱ" : "▶"}
            </button>
            <span className="timecode">{formatTime(currentTime)}</span>
            <input
              aria-label="播放进度"
              type="range"
              min={0}
              max={Math.max(0.1, result.duration)}
              step={0.01}
              value={Math.min(currentTime, result.duration)}
              onChange={(event) => seek(Number(event.target.value))}
            />
            <span className="timecode">{formatTime(result.duration)}</span>
            {debugPlaybackRate < 1 && <span className="slow-rate-chip">慢放 {debugPlaybackRate}×</span>}
            <span className="format-chip">540 × 960</span>
            {audioUrl && <button type="button" className="debug-jump-button" aria-controls="algorithm-debug-panel" onClick={revealDebugConsole}>↓ 算法调试</button>}
          </div>
          <audio
            ref={audioRef}
            src={audioUrl || undefined}
            preload="metadata"
            onPlay={() => {
              lastPianoMediaTimeRef.current = (audioRef.current?.currentTime ?? 0) - 0.035;
              if (pianoSoundEnabledRef.current) void ensurePianoAudio();
              setPlaying(true);
              setStage(`正在${debugPlaybackRate < 1 ? `${debugPlaybackRate}× 慢放` : "播放"} · ${activeNotes.length} 个同步落点`);
            }}
            onPause={() => setPlaying(false)}
            onEnded={() => {
              setPlaying(false);
              currentTimeRef.current = result.duration;
              setCurrentTime(result.duration);
            }}
          />
        </section>

        <aside ref={stylePanelRef} className="control-panel style-panel">
          <div className="section-heading compact">
            <span>02</span>
            <div>
              <h2>设计成片</h2>
              <p>所有调整会立即更新预览</p>
            </div>
            <div className="settings-bulk-actions" aria-label="设置区展开控制">
              <button type="button" onClick={() => setAllSettingsOpen(true)}>全部展开</button>
              <button type="button" onClick={() => setAllSettingsOpen(false)}>全部收起</button>
            </div>
          </div>

          <div className={`creator-settings-save is-${creatorSettingsState}`}>
            <button
              type="button"
              onClick={() => void saveCurrentSongCompletely()}
              disabled={!currentTrackConfigId || status !== "ready" || localLibraryBusy || creatorSettingsState === "loading" || creatorSettingsState === "saving"}
            >
              {creatorSettingsState === "saving" || localLibraryBusy ? "正在保存…" : "保存当前歌曲全部设置"}
            </button>
            <div>
              <b>
                {creatorSettingsState === "saved" && currentLibraryId
                  ? `已保存「${currentTrackLabel || fileName}」的配置与音乐`
                  : creatorSettingsState === "error"
                    ? "本地保存暂不可用"
                    : creatorSettingsState === "loading"
                      ? "正在读取当前歌曲配置…"
                      : "当前歌曲修改后自动保存"}
              </b>
              <small>
                {creatorSettingsSavedAt
                  ? `上次保存 ${new Date(creatorSettingsSavedAt).toLocaleString("zh-CN", { hour12: false })} · 音频、谱面和视频背景同时写入本地曲库`
                  : "设计成片、卡点谱面、算法调试设置、音频和视频背景会绑定到当前歌曲"}
              </small>
            </div>
          </div>

          <div className="settings-flow">
          <details className="setting-group collapsible-setting template-switcher">
            <summary className="setting-title"><span>版式模板</span><small>原版保留 · 随时切换</small></summary>
            <div className="layout-template-grid">
              <button
                type="button"
                className={`layout-template-option ${layoutTemplate === "orbit" ? "active" : ""}`}
                aria-pressed={layoutTemplate === "orbit"}
                onClick={() => {
                  setLayoutTemplate("orbit");
                  setStage("已切换为星轨弹跳版式");
                }}
              >
                <span className="template-preview template-preview-orbit" aria-hidden="true"><i /><i /><i /></span>
                <b>星轨弹跳</b>
                <small>当前经典版式</small>
              </button>
              <button
                type="button"
                className={`layout-template-option ${layoutTemplate === "kinetic" ? "active" : ""}`}
                aria-pressed={layoutTemplate === "kinetic"}
                onClick={() => {
                  setLayoutTemplate("kinetic");
                  setStage("已切换为机械悬浮版式 · 小球滚出台阶后落下，砸过琴片即点亮");
                }}
              >
                <span className="template-preview template-preview-kinetic" aria-hidden="true"><i /><i /><i /></span>
                <b>机械悬浮</b>
                <small>物理滚落 · 砸后点亮</small>
              </button>
              <button
                type="button"
                className={`layout-template-option ${layoutTemplate === "square-maze" ? "active" : ""}`}
                aria-pressed={layoutTemplate === "square-maze"}
                onClick={() => {
                  setLayoutTemplate("square-maze");
                  setStage("已切换为方块迷宫版式 · 每个 MIDI 起音触发一次弹墙碰撞");
                }}
              >
                <span className="template-preview template-preview-square-maze" aria-hidden="true"><i /><i /><i /></span>
                <b>方块迷宫</b>
                <small>斜向弹墙 · 节奏地图</small>
              </button>
            </div>
            <p className="template-note">
              {layoutTemplate === "square-maze"
                ? "根据整条音符时间轴预先生成矩形通道：正方块沿斜线移动，每个 MIDI 起音都会在彩色碰撞钉处翻转一个方向，撞击时压缩、发光并爆出方形粒子。"
                : "琴片长度和滚动时间会跟随音符间隔变化：密集音符使用短板快速落下，较长空拍会生成长板和机械凸点，让小球多滚一段并自然拱过障碍。"}
            </p>
            {layoutTemplate === "square-maze" && (
              <div className="maze-attribution" role="note">
                <b>创意出处说明</b>
                <p>方块弹墙与节奏地图创意基于开源项目独立改制，轨迹、渲染与皮肤为本产品重新实现。</p>
                <a href="https://github.com/quasar098/midi-playground" target="_blank" rel="noreferrer">
                  quasar098/midi-playground · GPL-3.0 ↗
                </a>
              </div>
            )}
          </details>

          <details className="setting-group collapsible-setting overlay-controls">
            <summary className="setting-title"><span>成片文字与 Logo</span><small>预览与下载保持一致</small></summary>
            <div className="binary-control-row">
              <span>顶部场景文字</span>
              <div className="segmented-control two-options">
                <button type="button" className={showSceneText ? "active" : ""} onClick={() => setShowSceneText(true)}>显示</button>
                <button type="button" className={!showSceneText ? "active" : ""} onClick={() => setShowSceneText(false)}>隐藏</button>
              </div>
            </div>
            <div className="binary-control-row">
              <span>科学羊 Logo</span>
              <div className="segmented-control two-options">
                <button type="button" className={showBranding ? "active" : ""} onClick={() => setShowBranding(true)}>保留</button>
                <button type="button" className={!showBranding ? "active" : ""} onClick={() => setShowBranding(false)}>移除</button>
              </div>
            </div>
          </details>

          {layoutTemplate === "square-maze" && (
            <details className="setting-group collapsible-setting maze-appearance-controls">
              <summary className="setting-title"><span>方块迷宫外观</span><small>颜色、形状与皮肤</small></summary>
              <div className="setting-title"><span>方块颜色</span><small>彩虹会随时间流动 · 支持自定义颜色</small></div>
              <div className="shape-option-grid">
                {([
                  ["rainbow", "", "🌈", "彩虹流光"],
                  ["red", "#ff4057", "", "烈焰红"],
                  ["yellow", "#ffe04f", "", "电光黄"],
                  ["cyan", "#65eaff", "", "冰晶青"],
                  ["pink", "#ff5ccf", "", "霓虹粉"],
                  ["violet", "#b26bff", "", "幻境紫"],
                  ["green", "#5dffa0", "", "极光绿"],
                  ["orange", "#ff9a3d", "", "熔岩橙"],
                  ["white", "#f4f7ff", "", "月光白"],
                  ["custom", mazeSquareColor, "", "自定义"],
                ] as [SquareColorMode, string, string, string][]).map(([value, color, icon, label]) => (
                  <button key={value} type="button" className={squareColorMode === value ? "active" : ""} onClick={() => setSquareColorMode(value)}>
                    <i style={color ? { background: color } : undefined}>{icon}</i><span>{label}</span>
                  </button>
                ))}
              </div>
              {squareColorMode === "custom" && (
                <div className="maze-color-controls">
                  <label>
                    <span>自定义方块颜色</span>
                    <div><input type="color" aria-label="自定义方块颜色" value={mazeSquareColor} onChange={(event) => setMazeSquareColor(event.target.value)} /><code>{mazeSquareColor.toUpperCase()}</code></div>
                  </label>
                </div>
              )}
              <div className="setting-title maze-detail-title"><span>弹跳形状</span><small>11 款形状 · 音符是音乐盒签名款</small></div>
              <div className="shape-option-grid">
                {([
                  ["square", "■", "方块"],
                  ["circle", "●", "小球"],
                  ["diamond", "◆", "菱形"],
                  ["hexagon", "⬢", "六边形"],
                  ["star", "★", "星形"],
                  ["heart", "♥", "爱心"],
                  ["note", "♪", "音符"],
                  ["moon", "☾", "月牙"],
                  ["sparkle", "✦", "四角星"],
                  ["clover", "☘", "四叶草"],
                  ["droplet", "💧", "水滴"],
                ] as [MazeShape, string, string][]).map(([value, icon, label]) => (
                  <button key={value} type="button" className={mazeShape === value ? "active" : ""} onClick={() => setMazeShape(value)}>
                    <i>{icon}</i><span>{label}</span>
                  </button>
                ))}
              </div>
              <div className="setting-title slider-title"><span>弹跳物尺寸</span><b>{mazeObjectSize}px</b></div>
              <input
                className="accent-range"
                aria-label="方块或小球尺寸"
                type="range"
                min={24}
                max={78}
                value={mazeObjectSize}
                onChange={(event) => setMazeObjectSize(Number(event.target.value))}
                onPointerUp={() => void persistCreatorSettings(false)}
                onKeyUp={() => void persistCreatorSettings(false)}
              />
              <div className="range-labels"><span>轻巧</span><span>巨大</span></div>
              <div className="setting-title slider-title"><span>外框描边宽度</span><b>{mazeStrokeWidth.toFixed(1)}px</b></div>
              <input
                className="accent-range"
                aria-label="弹跳物外框描边宽度"
                type="range"
                min={0.5}
                max={8}
                step={0.5}
                value={mazeStrokeWidth}
                onChange={(event) => setMazeStrokeWidth(Number(event.target.value))}
              />
              <div className="range-labels"><span>极细</span><span>粗线</span></div>
              <div className="setting-title slider-title"><span>外框发光强度</span><b>{mazeGlowIntensity}%</b></div>
              <input
                className="accent-range"
                aria-label="弹跳物外框发光强度"
                type="range"
                min={0}
                max={100}
                value={mazeGlowIntensity}
                onChange={(event) => setMazeGlowIntensity(Number(event.target.value))}
              />
              <div className="setting-title maze-detail-title"><span>内部填充</span><small>轮廓、半色或全色</small></div>
              <div className="segmented-control">
                {([
                  ["outline", "仅轮廓"],
                  ["half", "半透明"],
                  ["solid", "全色填充"],
                ] as [MazeFillMode, string][]).map(([value, label]) => (
                  <button key={value} type="button" className={mazeFillMode === value ? "active" : ""} onClick={() => setMazeFillMode(value)}>{label}</button>
                ))}
              </div>
              <div className="maze-color-controls">
                <label>
                  <span>边缘与碰撞色块</span>
                  <div><input type="color" aria-label="迷宫边缘颜色" value={mazeEdgeColor} onChange={(event) => setMazeEdgeColor(event.target.value)} /><code>{mazeEdgeColor.toUpperCase()}</code></div>
                </label>
                <label>
                  <span>拖尾主色</span>
                  <div><input type="color" aria-label="拖尾彩带颜色" value={mazeTrailColor} onChange={(event) => setMazeTrailColor(event.target.value)} /><code>{mazeTrailColor.toUpperCase()}</code></div>
                </label>
              </div>
              <p className="unified-color-note">边缘颜色会统一修改全部碰撞色块、迷宫描边和爆炸光圈；拖尾主色会统一修改整条彩带。</p>
              <div className="setting-title maze-skin-title"><span>迷宫皮肤</span><small>13 套固定主题 · 支持本地图片或视频</small></div>
              <div className="custom-maze-skin-control">
                <button type="button" onClick={() => customSkinInputRef.current?.click()}>
                  {customMazeSkin ? "↻ 替换自定义皮肤" : "＋ 上传自定义皮肤"}
                </button>
                <input
                  ref={customSkinInputRef}
                  className="visually-hidden"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) loadCustomMazeSkin(file);
                    event.currentTarget.value = "";
                  }}
                />
                <p>
                  最佳 1080×1920（9:16，不裁切）；也支持 1536×1024（3:2，将居中裁切两侧）。PNG/JPG/WebP，最大 8MB；点击“保存全部设置”后会随配置一起保留。
                </p>
                {customMazeSkin && (
                  <small>{customMazeSkin.name} · {customMazeSkin.width}×{customMazeSkin.height}</small>
                )}
              </div>
              <div className="custom-maze-skin-control custom-maze-video-control">
                <button type="button" onClick={() => customVideoInputRef.current?.click()}>
                  {customMazeVideo ? "↻ 替换本地视频背景" : "＋ 上传本地视频背景"}
                </button>
                <input
                  ref={customVideoInputRef}
                  className="visually-hidden"
                  type="file"
                  accept="video/*,.mp4,.m4v,.mov,.webm,.ogv,.ogg"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) loadCustomMazeVideo(file);
                    event.currentTarget.value = "";
                  }}
                />
                <p>
                  横屏、竖屏、方形和任意分辨率都可以，画面会自动居中裁成 9:16；视频静音循环，音乐仍使用当前歌曲。文件只保存在本浏览器，不会上传。
                </p>
                {customMazeVideo && (
                  <div className="custom-maze-video-status">
                    <small>
                      {customMazeVideo.name} · {customMazeVideo.width}×{customMazeVideo.height} · {formatTime(customMazeVideo.duration)} · {(customMazeVideo.blob.size / 1024 / 1024).toFixed(1)}MB
                    </small>
                    <button type="button" onClick={() => void removeCustomMazeVideo()}>移除视频背景</button>
                  </div>
                )}
                <p className="custom-maze-video-save-note">点击“保存当前歌曲全部设置”后，视频会与这首歌绑定；切换歌曲时自动换成各自的视频背景。</p>
              </div>
              <div className="maze-skin-grid">
                {customMazeSkin && (
                  <button type="button" className={mazeSkin === "custom" ? "active" : ""} onClick={() => { setMazeSkin("custom"); if (customMazeVideoUrlRef.current) void removeCustomMazeVideo(true); }}>
                    <i style={{ backgroundImage: `linear-gradient(rgba(2,5,18,.08), rgba(2,5,18,.24)), url(${customMazeSkin.url})` }} />
                    <span>我的皮肤</span>
                  </button>
                )}
                {([
                  ["cosmic", "热血宇宙", "#07134d", "#ff2dab", "/maze-skins/anime-cosmic-burst.webp"],
                  ["voyage", "海岛冒险", "#073c63", "#ff9a48", "/maze-skins/cartoon-ocean-adventure.webp"],
                  ["monster", "霓虹萌兽", "#07144d", "#ca4dff", "/maze-skins/neon-monster-festival.webp"],
                  ["crimson", "经典红", "#6c1234", "#ff3a49"],
                  ["midnight", "午夜蓝", "#071329", "#264d82"],
                  ["aurora", "极光青", "#062339", "#19a796"],
                  ["sunset", "日落紫", "#220d42", "#b65a91"],
                  ["blueprint", "蓝图网格", "#031323", "#164f88"],
                  ["comic", "漫画爆点", "#e74c3c", "#ffd83d"],
                  ["anime", "动漫黄昏", "#34245f", "#ff8db8"],
                  ["candy", "糖果梦境", "#3d1769", "#d75bda"],
                  ["cyber", "赛博矩阵", "#010908", "#20ff9b"],
                  ["ink", "水墨夜行", "#161a1d", "#76808a"],
                ] as [MazeSkin, string, string, string, string?][]).map(([value, label, colorA, colorB, imageUrl]) => (
                  <button key={value} type="button" className={mazeSkin === value ? "active" : ""} onClick={() => { setMazeSkin(value); if (customMazeVideoUrlRef.current) void removeCustomMazeVideo(true); }}>
                    <i style={{ backgroundImage: imageUrl ? `linear-gradient(rgba(2,5,18,.08), rgba(2,5,18,.24)), url(${imageUrl})` : `linear-gradient(135deg, ${colorA}, ${colorB})` }} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </details>
          )}

          {layoutTemplate === "square-maze" && (
            <details className="setting-group collapsible-setting maze-bounce-effect-controls">
              <summary className="setting-title">
                <span>弹跳效果设置</span>
                <small>拖尾彩带、碰撞特效与打击感</small>
              </summary>

              <div className="setting-title maze-detail-title"><span>拖尾彩带</span><small>方块迷宫专属 · 点击定位预览 · 原有效果完整保留</small></div>
              <div className="vfx-option-grid trail-effect-menu">
                {([
                  ["aurora", "三色短彩带", "原有", "推荐"],
                  ["meteor", "短流星", "原有", "推荐"],
                  ["comet", "彗星光尾", "原有", "较重"],
                  ["ribbon", "糖果彩带", "原有", "较重"],
                  ["spark", "星芒碎片", "原有", "轻量"],
                  ["firework", "烟花尾迹", "原有", "较重"],
                  ["prism", "色散缎带", "新增", "较重"],
                  ["twist", "飘带扭转", "新增", "中等"],
                  ["helix", "双螺旋", "新增", "中等"],
                  ["dissolve", "消散尾", "新增", "较重"],
                  ["wave", "音浪尾", "新增", "中等"],
                ] as [MazeTrailStyle, string, string, "推荐" | "轻量" | "中等" | "较重"][]).map(([value, label, badge, cost]) => (
                  <button
                    key={value}
                    type="button"
                    className={mazeTrailStyle === value ? "active" : ""}
                    aria-pressed={mazeTrailStyle === value}
                    onClick={() => {
                      setMazeTrailStyle(value);
                      previewVisualChoice("trail", label);
                    }}
                  >
                    <b>{label}</b>
                    <span className="vfx-option-badges"><small>{badge}</small><small className={`cost-${cost}`}>{cost}</small></span>
                    {value === "aurora" && <span className="visually-hidden">短拖影 · 轻量同步</span>}
                  </button>
                ))}
              </div>

              <div className="vfx-slider-grid">
                <label>
                  <span>尾巴长度 <b>{mazeTrailLength}</b></span>
                  <input
                    className="accent-range"
                    aria-label="方块迷宫尾巴长度"
                    type="range"
                    min={90}
                    max={480}
                    step={10}
                    value={mazeTrailLength}
                    onChange={(event) => setMazeTrailLength(Number(event.target.value))}
                  />
                </label>
                <label>
                  <span>尾巴粗细 <b>{mazeTrailWidth}</b></span>
                  <input
                    className="accent-range"
                    aria-label="方块迷宫尾巴粗细"
                    type="range"
                    min={8}
                    max={38}
                    value={mazeTrailWidth}
                    onChange={(event) => setMazeTrailWidth(Number(event.target.value))}
                  />
                </label>
              </div>

              <div className="setting-title maze-detail-title"><span>碰撞特效</span><small>原有效果完整保留 · 新增源码 VFX</small></div>
              <div className="vfx-option-grid impact-effect-menu">
                {([
                  ["prismatic", "霓虹爆裂", "原有", "中等"],
                  ["cartoon", "泡泡光环", "原有", "轻量"],
                  ["neon", "霓虹涟漪", "原有", "中等"],
                  ["explosion", "能量爆炸", "原有", "中等"],
                  ["shatter", "晶体破碎", "原有", "较重"],
                  ["lightning", "闪电裂隙", "原有", "推荐"],
                  ["firework", "烟花绽放", "原有", "较重"],
                  ["vfx-nova", "超新星", "新增", "较重"],
                  ["vfx-star", "星芒爆闪", "新增", "推荐"],
                  ["vfx-shatter", "碎片爆裂", "新增", "轻量"],
                  ["vfx-ripple", "网格涟漪", "新增", "中等"],
                  ["vfx-confetti", "礼炮彩纸", "新增", "较重"],
                  ["vfx-combo", "冲击波＋火花", "新增", "中等"],
                ] as [MazeImpactEffect, string, string, "推荐" | "轻量" | "中等" | "较重"][]).map(([value, label, badge, cost]) => (
                  <button
                    key={value}
                    type="button"
                    className={mazeImpactEffect === value ? "active" : ""}
                    aria-pressed={mazeImpactEffect === value}
                    onClick={() => {
                      setMazeImpactEffect(value);
                      previewVisualChoice("impact", label);
                    }}
                  >
                    <b>{label}</b>
                    <span className="vfx-option-badges"><small>{badge}</small><small className={`cost-${cost}`}>{cost}</small></span>
                  </button>
                ))}
              </div>

              <div className="vfx-slider-grid">
                <label>
                  <span>特效节奏 <b>{mazeEffectBpm}</b></span>
                  <input
                    className="accent-range"
                    aria-label="方块迷宫特效节奏"
                    type="range"
                    min={70}
                    max={200}
                    step={2}
                    value={mazeEffectBpm}
                    onChange={(event) => setMazeEffectBpm(Number(event.target.value))}
                  />
                </label>
                <label>
                  <span>碰撞强度 <b>{mazeEffectIntensity}</b></span>
                  <input
                    className="accent-range"
                    aria-label="方块迷宫碰撞强度"
                    type="range"
                    min={50}
                    max={180}
                    step={5}
                    value={mazeEffectIntensity}
                    onChange={(event) => setMazeEffectIntensity(Number(event.target.value))}
                  />
                </label>
              </div>

              <div className="setting-title maze-detail-title"><span>打击感</span><small>关掉即可逐项对比</small></div>
              <div className="vfx-toggle-grid">
                {([
                  ["泛光", "掉帧时关", mazeBloom, setMazeBloom],
                  ["震屏", "轻量", mazeShake, setMazeShake],
                  ["顿帧", "快歌不建议", mazeHitstop, setMazeHitstop],
                  ["背景网格", "掉帧时关", mazeBackgroundGrid, setMazeBackgroundGrid],
                ] as [string, string, boolean, (value: boolean) => void][]).map(([label, hint, enabled, setter]) => (
                  <button
                    key={label}
                    type="button"
                    className={enabled ? "active" : ""}
                    aria-pressed={enabled}
                    onClick={() => setter(!enabled)}
                  >
                    <b>{label}</b><small>{hint}</small>
                  </button>
                ))}
              </div>

              <div className="vfx-sync-panel">
                <div className="vfx-sync-heading">
                  <b>卡点校准</b>
                  <span>默认样本是精确谱面；上传音乐由自动起音识别，慢起音、混响或复杂混音可能整体偏后。</span>
                </div>
                <div className="vfx-sync-presets" aria-label="整条轨道快速提前">
                  <button type="button" className={timingOffsetMs === -30 ? "active" : ""} onClick={() => applyGlobalOffset(-30)}>整体提前 30ms</button>
                  <button type="button" className={timingOffsetMs === -60 ? "active" : ""} onClick={() => applyGlobalOffset(-60)}>整体提前 60ms</button>
                  <button type="button" className={timingOffsetMs === 0 ? "active" : ""} onClick={() => applyGlobalOffset(0)}>轨道归零</button>
                </div>
                <label>
                  <span>画面提前补偿 <b>{visualSyncMs}ms</b></span>
                  <input
                    className="accent-range"
                    aria-label="方块迷宫画面提前补偿"
                    type="range"
                    min={0}
                    max={500}
                    step={5}
                    value={visualSyncMs}
                    onChange={(event) => changeVisualSync(Number(event.target.value))}
                  />
                </label>
                <p>如果每个落点都慢，先用“整体提前”；如果音符时间正确、只是画面显示晚，再调“画面提前补偿”。</p>
              </div>

              <div className="vfx-performance-guide">
                <b>卡点优先推荐</b>
                <p>三色短彩带 / 短流星 ＋ 闪电裂隙 / 星芒爆闪；关闭顿帧。卡顿时再关闭泛光和背景网格。</p>
                <small>碰撞与拖尾本身不修改音符时间；只有“顿帧”会刻意冻结方块画面 50ms。较重效果叠加泛光时可能掉帧，观感会像慢拍，但音频和谱面没有被改动。</small>
              </div>

              <div className="vfx-action-row">
                <button
                  type="button"
                  onClick={() => {
                    const notes = activeNotes.length ? activeNotes : result.notes;
                    const next = notes.find((note) => note.time > currentTimeRef.current + 0.03) ?? notes[0];
                    audioRef.current?.pause();
                    setPlaying(false);
                    if (next) seek(next.time + 0.035);
                    setStage("已暂停在下一次碰撞的高光帧");
                  }}
                >
                  暂停抓拍
                </button>
                <button type="button" onClick={() => previewVisualChoice("impact", "碰撞特效")}>手动放一次</button>
                <button
                  type="button"
                  onClick={() => {
                    audioRef.current?.pause();
                    setPlaying(false);
                    seek(0);
                    setStage("方块迷宫已重来");
                  }}
                >
                  重来
                </button>
              </div>
              <p className="vfx-explainer">尾迹和爆炸使用加法混合叠色；泛光会复制并模糊亮部，震屏与 50ms 顿帧只作用于方块迷宫画面。快速或高密度音乐不建议开启顿帧。</p>
            </details>
          )}

          <details className="setting-group collapsible-setting config-file-controls">
            <summary className="setting-title"><span>视觉配置文件</span><small>保存后可重复载入</small></summary>
            <div className="config-button-row">
              <button type="button" onClick={saveVisualConfig}>↓ 保存配置 JSON</button>
              <button type="button" onClick={() => configInputRef.current?.click()}>↑ 载入配置</button>
            </div>
            <input
              ref={configInputRef}
              className="visually-hidden"
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void loadVisualConfig(file);
                event.currentTarget.value = "";
              }}
            />
            <p>这里用于导出备份文件；页面顶部的“保存全部设置”会在下次打开时自动恢复。</p>
          </details>

          <details className="setting-group collapsible-setting analysis-controls">
            <summary className="setting-title"><span>钢琴触键解析 <i>常用</i></span><small>当前模式准确优先，支持保守补漏</small></summary>
            <div className="segmented-control analysis-profile-control">
              {([
                ["balanced", "综合旋律"],
                ["piano", "钢琴重音"],
                ["rhythm", "节奏强拍"],
              ] as [AnalysisProfile, string][]).map(([value, label]) => (
                <button key={value} type="button" className={analysisProfile === value ? "active" : ""} onClick={() => setAnalysisProfile(value)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="setting-title slider-title"><span>识别灵敏度</span><b>{sensitivity}%</b></div>
            <input
              className="accent-range"
              aria-label="落点识别灵敏度"
              type="range"
              min={20}
              max={92}
              value={sensitivity}
              onChange={(event) => setSensitivity(Number(event.target.value))}
            />
            <div className="range-labels"><span>只留强重音</span><span>捕捉细触键</span></div>
            <button
              type="button"
              className="reanalyze-button"
              onClick={() => void reanalyzeCurrentTrack()}
              disabled={!audioUrl || status === "analyzing" || hasOfficialScore}
            >
              {hasOfficialScore ? "官方样本已精准对齐" : "用当前模式重新解析"}
            </button>
            <p className="deep-analysis-tip">钢琴重音会保留原有准确落点，并用独立宽频瞬态通道补充高可信漏点；仍可在算法调试面板人工增删。</p>
          </details>

          {layoutTemplate === "orbit" && (
            <details className="setting-group collapsible-setting orbit-only-controls">
              <summary className="setting-title"><span>琴片信息</span><small>仅应用于星轨弹跳</small></summary>
              <div className="segmented-control">
                {([
                  ["solfege", "DO 唱名"],
                  ["note", "C4 音名"],
                  ["symbol", "✦ 图案"],
                ] as [LabelMode, string][]).map(([value, label]) => (
                  <button key={value} type="button" className={labelMode === value ? "active" : ""} onClick={() => setLabelMode(value)}>
                    {label}
                  </button>
                ))}
              </div>
            </details>
          )}

          {layoutTemplate !== "square-maze" && (
            <details className="setting-group collapsible-setting ball-size-controls">
              <summary className="setting-title slider-title">
                <span>{layoutTemplate === "kinetic" ? "机械小球尺寸" : "弹跳小球尺寸"}</span>
                <b>{ballSize}%</b>
              </summary>
              <input
                className="accent-range"
                aria-label={layoutTemplate === "kinetic" ? "机械悬浮小球尺寸" : "星轨弹跳小球尺寸"}
                type="range"
                min={60}
                max={160}
                value={ballSize}
                onChange={(event) => setBallSize(Number(event.target.value))}
              />
              <div className="range-labels"><span>小巧</span><span>醒目</span></div>
            </details>
          )}

          {layoutTemplate !== "square-maze" && (
            <details className="setting-group collapsible-setting impact-controls" data-layout={layoutTemplate}>
              <summary className="setting-title">
                <span>碰撞特效</span>
                <small>三个版式通用 · 点击自动定位预览</small>
              </summary>
              <div className="effect-card-grid impact-effect-menu">
                {([
                  ["prismatic", "霓虹爆裂", "白核圆环 · 彩色光束碎片"],
                  ["cartoon", "泡泡光环", "轻盈卡通反馈"],
                  ["neon", "霓虹涟漪", "分层圆环扩散"],
                  ["explosion", "能量爆炸", "热能冲击波"],
                  ["shatter", "晶体破碎", "几何碎片飞散"],
                  ["lightning", "闪电裂隙", "电弧瞬间爆开"],
                  ["firework", "烟花绽放", "传统粒子放射"],
                ] as [ImpactEffect, string, string][]).map(([value, label, detail]) => (
                  <button
                    key={value}
                    type="button"
                    className={impactEffect === value ? "active" : ""}
                    aria-pressed={impactEffect === value}
                    onClick={() => {
                      setImpactEffect(value);
                      previewVisualChoice("impact", label);
                    }}
                  >
                    <span className={`effect-card-preview impact-preview-${value}`} aria-hidden="true"><i /><i /><i /></span>
                    <span className="effect-card-copy"><b>{label}</b><small>{detail}</small></span>
                  </button>
                ))}
              </div>
              <div className="setting-title slider-title"><span>特效强度</span><b>{impactIntensity}%</b></div>
              <input
                className="accent-range impact-range"
                aria-label="撞击特效强度"
                type="range"
                min={20}
                max={100}
                value={impactIntensity}
                onChange={(event) => setImpactIntensity(Number(event.target.value))}
              />
            </details>
          )}

          {layoutTemplate !== "square-maze" && (
            <details className="setting-group collapsible-setting scene-theme-controls">
              <summary className="setting-title">
                <span>{layoutTemplate === "kinetic" ? "机械氛围" : "宇宙场景"}</span>
                <small>{layoutTemplate === "kinetic" ? "调整琴片与小球光色" : "选择颜色氛围"}</small>
              </summary>
              <div className="theme-grid">
                {([
                  ["nebula", "星云紫", "#8f6cff", "#ff5db1"],
                  ["aurora", "极光蓝", "#48edc5", "#3d8cff"],
                  ["solar", "日冕橙", "#ffb24a", "#ff406f"],
                ] as [SceneTheme, string, string, string][]).map(([value, name, colorA, colorB]) => (
                  <button key={value} type="button" className={`theme-option ${theme === value ? "active" : ""}`} onClick={() => setTheme(value)}>
                    <span style={{ background: `linear-gradient(135deg, ${colorA}, ${colorB})` }} />
                    <b>{name}</b>
                  </button>
                ))}
              </div>
            </details>
          )}

          <details className="setting-group collapsible-setting ambience-density-controls" data-layout={layoutTemplate}>
            <summary className="setting-title">
              <span>{layoutTemplate === "square-maze" ? "迷宫背景光点" : layoutTemplate === "kinetic" ? "机械背景粒子" : "流星密度"}</span>
              <b>{meteorIntensity}%</b>
            </summary>
            <input
              className="accent-range"
              aria-label={layoutTemplate === "square-maze" ? "迷宫背景光点密度" : layoutTemplate === "kinetic" ? "机械背景粒子密度" : "流星密度"}
              type="range"
              min={0}
              max={100}
              value={meteorIntensity}
              onChange={(event) => setMeteorIntensity(Number(event.target.value))}
            />
            <div className="range-labels"><span>宁静</span><span>丰富</span></div>
          </details>

          <details className="melody-map collapsible-setting">
            <summary className="setting-title"><span>自定义弹跳谱面</span><small>{activeNotes.length} 个砖块触发点 · 点中后左右拖动</small></summary>
            <div className="manual-edit-mode" aria-label="手工编辑模式">
              <button
                type="button"
                className={manualEditMode === "trigger" ? "active" : ""}
                aria-pressed={manualEditMode === "trigger"}
                onClick={() => setManualEditMode("trigger")}
              >
                <b>砖块触发模式</b><small>保留原声，只编辑弹跳时间</small>
              </button>
              <button
                type="button"
                className={manualEditMode === "sound" ? "active" : ""}
                aria-pressed={manualEditMode === "sound"}
                onClick={() => setManualEditMode("sound")}
              >
                <b>声音辅助模式</b><small>保留音高、试听与辅助音量</small>
              </button>
            </div>
            <canvas
              ref={timelineCanvasRef}
              className="melody-timeline"
              width={600}
              height={190}
              role="slider"
              tabIndex={0}
                aria-label="自定义弹跳谱面，空白处点击定位，砖块触发点可左右拖动"
              aria-valuemin={0}
              aria-valuemax={Math.round(result.duration)}
              aria-valuenow={Math.round(currentTime)}
              onPointerDown={beginTimelineEdit}
              onPointerMove={dragTimelineNote}
              onPointerUp={endTimelineEdit}
              onPointerCancel={endTimelineEdit}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight") seek(currentTime + 1);
                if (event.key === "ArrowLeft") seek(currentTime - 1);
              }}
            />
            <div className="timeline-legend">
              <span><i className="legend-auto" /> 自动落点</span>
              <span><i className="legend-manual" /> 手动校准</span>
              <b>{formatPreciseTime(currentTime)}</b>
            </div>
            <div className="manual-time-entry">
              <input
                type="text"
                value={manualTimesInput}
                onChange={(event) => setManualTimesInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addLandingsFromTimes();
                }}
                placeholder="输入秒数：1, 5, 8, 12"
                aria-label="批量输入弹跳时间"
                disabled={!audioUrl || status === "analyzing"}
              />
              <button type="button" onClick={addLandingsFromTimes} disabled={!audioUrl || status === "analyzing"}>批量新增</button>
            </div>
            <div className="manual-calibration">
              <button type="button" onClick={addLandingAtCurrentTime} disabled={!audioUrl || status === "analyzing"}>＋ 当前时间加落点</button>
              <button type="button" onClick={removeNearestLanding} disabled={!audioUrl || status === "analyzing"}>－ 删除附近落点</button>
            </div>
            {selectedNote && (
              <div className="selected-landing-editor">
                <div><span>当前选中</span><b>{formatPreciseTime(selectedNote.time)}{manualEditMode === "sound" ? ` · ${noteName(selectedNote.pitch)}` : " · 砖块触发"}</b></div>
                <div className="landing-edit-buttons">
                  <button type="button" onClick={() => nudgeSelectedNote(-50)}>−50ms</button>
                  <button type="button" onClick={() => nudgeSelectedNote(-10)}>−10ms</button>
                  <button type="button" onClick={() => nudgeSelectedNote(10)}>+10ms</button>
                  <button type="button" onClick={() => nudgeSelectedNote(50)}>+50ms</button>
                </div>
                {manualEditMode === "sound" && <div className="landing-edit-buttons pitch-buttons">
                  <button type="button" onClick={() => transposeSelectedNote(-12)}>低八度</button>
                  <button type="button" onClick={() => transposeSelectedNote(-1)}>−半音</button>
                  <button type="button" onClick={() => void auditionPianoNote(selectedNote.pitch, selectedNote.velocity)}>♪ 试听</button>
                  <button type="button" onClick={() => transposeSelectedNote(1)}>+半音</button>
                  <button type="button" onClick={() => transposeSelectedNote(12)}>高八度</button>
                </div>}
              </div>
            )}
            {manualEditMode === "sound" && <div className="piano-sound-control">
              <button
                type="button"
                className={pianoSoundEnabled ? "active" : ""}
                aria-pressed={pianoSoundEnabled}
                onClick={() => setPianoSoundEnabled((enabled) => !enabled)}
              >
                <span>♫</span><b>弹跳钢琴音</b><small>{pianoSoundEnabled ? "已开启" : "已关闭"}</small>
              </button>
              <label>
                <span>音量</span>
                <input type="range" min={0} max={160} value={pianoVolume} onChange={(event) => setPianoVolume(Number(event.target.value))} disabled={!pianoSoundEnabled} />
                <b>{pianoVolume}%</b>
              </label>
            </div>}
            <div className="score-file-actions">
              <button type="button" onClick={startBlankManualScore} disabled={!audioUrl || status === "analyzing"}>新建空白谱面</button>
              <button type="button" onClick={() => scoreInputRef.current?.click()} disabled={!audioUrl || status === "analyzing"}>载入谱面</button>
              <button type="button" onClick={exportEditableScore} disabled={!audioUrl || !activeNotes.length}>导出谱面</button>
            </div>
            <input
              ref={scoreInputRef}
              className="visually-hidden"
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void loadEditableScore(file);
                event.target.value = "";
              }}
            />
            <p className="calibration-tip">砖块触发模式会继续播放上传的原始音乐，但不叠加钢琴音。调试面板中单击空白新增触发点；在空白处按住左键拖出矩形，可框选多个触发点并批量删除。</p>
          </details>
          </div>

          <details className="export-block collapsible-setting">
            <summary className="setting-title"><span>保存与导出成片</span><small>视频、画面与自动录制</small></summary>
            <div className="segmented-control two-options auto-save-control">
              <button type="button" className={!autoSaveVideo ? "active" : ""} onClick={() => setAutoSaveVideo(false)}>普通播放</button>
              <button type="button" className={autoSaveVideo ? "active" : ""} onClick={() => setAutoSaveVideo(true)}>播放即自动保存视频</button>
            </div>
            <button type="button" className="frame-export-button" onClick={saveCurrentFrame}>
              <span aria-hidden="true">▣</span>
              <div><b>保存当前画面 PNG</b><small>按所选清晰度导出 {EXPORT_RESOLUTIONS[exportResolution].width} × {EXPORT_RESOLUTIONS[exportResolution].height} 高清画面</small></div>
            </button>
            <div className="segmented-control two-options export-mode-control">
              <button type="button" className={exportMode === "frame" ? "active" : ""} onClick={() => setExportMode("frame")}>逐帧导出（推荐）</button>
              <button type="button" className={exportMode === "realtime" ? "active" : ""} onClick={() => setExportMode("realtime")}>实时录制</button>
            </div>
            <label className="export-resolution-field">
              <span>导出清晰度</span>
              <select
                value={exportResolution}
                disabled={exporting}
                onChange={(event) => setExportResolution(event.target.value as ExportResolution)}
              >
                <option value="smooth">540×960 流畅（原方案）</option>
                <option value="balanced">720×1280 均衡</option>
                <option value="ultra">1080×1920 超清（可能卡顿）</option>
              </select>
            </label>
            <button type="button" className="export-button" onClick={() => void (exportMode === "frame" ? exportVideoOffline() : exportVideo())} disabled={!audioUrl || status === "analyzing" || exporting}>
              <span aria-hidden="true">{exporting ? "◌" : "↓"}</span>
              <div><b>{exporting ? `正在${exportMode === "frame" ? "逐帧导出" : "自动录制"} ${Math.round(exportProgress * 100)}%` : "自动录制并下载"}</b><small>{exporting ? "请保持页面打开，完成后自动下载" : `${EXPORT_RESOLUTIONS[exportResolution].width}×${EXPORT_RESOLUTIONS[exportResolution].height}；${exportMode === "frame" ? "逐帧渲染，绝不卡顿" : "实时录制，优先 MP4"}`}</small></div>
            </button>
            <p>逐帧导出会逐帧精确渲染整首音乐，比实时录制慢，但任何清晰度下都不会卡顿、音画始终同步；老浏览器会自动回落为实时录制。</p>
          </details>
        </aside>
      </div>

      {audioUrl && (
        <section
          id="algorithm-debug-panel"
          ref={debugConsoleRef}
          className={`debug-console is-open ${debugExpanded ? "is-expanded" : ""}`}
          aria-label="算法调试面板"
        >
          <div className="debug-console-heading">
            <div className="debug-title">
              <span>03</span>
              <div>
                <h2>算法调试面板</h2>
                <p>对照波形与频谱起音，直接新增、删除、拖动或进行毫秒级校准。</p>
              </div>
            </div>
            <div className="debug-summary-chips">
              <span>{result.diagnostics?.profile === "score" ? "基准谱面" : "频谱"} {result.diagnostics?.spectralCount ?? result.notes.length}</span>
              <span>模型匹配 {matchedCandidates}</span>
              <span>过滤 {filteredCandidates}</span>
              <span>当前生效 {activeNotes.length}</span>
            </div>
            <div className="debug-heading-actions">
              {!debugPreviewOpen && (
                <button type="button" className="debug-preview-toggle" onClick={() => setDebugPreviewOpen(true)}>
                  显示 9:16 预览
                </button>
              )}
              <button type="button" className="debug-expand" onClick={() => {
                setDebugExpanded((value) => !value);
              }}>
                {debugExpanded ? "退出放大" : "单独放大轨道"}
              </button>
            </div>
          </div>

          {debugPreviewOpen && (
            <div
              ref={debugPreviewCardRef}
              className="debug-preview-float"
              style={{
                width: debugPreviewWidth,
                ...(debugPreviewPosition ? { left: debugPreviewPosition.x, top: debugPreviewPosition.y, right: "auto" } : {}),
              }}
            >
              <div
                className="debug-preview-handle"
                onPointerDown={beginDebugPreviewDrag}
                onPointerMove={moveDebugPreview}
                onPointerUp={endDebugPreviewDrag}
                onPointerCancel={endDebugPreviewDrag}
              >
                <div><b>9:16 同步预览</b><small>顶部拖动 · 右下角缩放</small></div>
                <button
                  type="button"
                  aria-label="关闭悬浮预览"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => setDebugPreviewOpen(false)}
                >×</button>
              </div>
              <canvas ref={debugPreviewCanvasRef} width={540} height={960} aria-label="算法调试同步动画预览" />
              <div className="debug-preview-controls">
                <button type="button" onClick={() => void togglePlay()}>{playing ? "暂停" : "播放"}</button>
                <span>{formatPreciseTime(currentTime)} · {debugPlaybackRate}×</span>
                <button type="button" onClick={() => {
                  setDebugPreviewPosition(null);
                  setDebugPreviewWidth(DEFAULT_DEBUG_PREVIEW_WIDTH);
                }}>全部还原</button>
              </div>
              <button
                type="button"
                className="debug-preview-resize-handle"
                aria-label="拖动调整 9:16 预览大小"
                onPointerDown={beginDebugPreviewResize}
                onPointerMove={resizeDebugPreview}
                onPointerUp={endDebugPreviewResize}
                onPointerCancel={endDebugPreviewResize}
              />
            </div>
          )}

          <div className="debug-console-body">
              <div className="debug-track-column">
                <div className="debug-subsection-heading"><span>编辑工具与时间轴</span><small>框选、增删、拖动和落点清单</small></div>
                <div className="debug-track-toolbar">
                  <div className="debug-track-toolbar-left">
                    <div className="manual-edit-mode debug-mode-switch" aria-label="调试编辑模式">
                      <button type="button" className={manualEditMode === "trigger" ? "active" : ""} onClick={() => setManualEditMode("trigger")}>
                        <b>砖块触发</b><small>听原声手工踩点</small>
                      </button>
                      <button type="button" className={manualEditMode === "sound" ? "active" : ""} onClick={() => setManualEditMode("sound")}>
                        <b>声音辅助</b><small>音高与试听</small>
                      </button>
                    </div>
                    <div className="debug-edit-tools" aria-label="谱面编辑工具">
                      {([
                        ["select", "↖ 选择/框选"],
                        ["draw", "+ 绘制触发点"],
                        ["erase", "− 删除触发点"],
                      ] as [DebugEditTool, string][]).map(([tool, label]) => (
                        <button
                          key={tool}
                          type="button"
                          className={debugEditTool === tool ? "active" : ""}
                          aria-pressed={debugEditTool === tool}
                          onClick={() => setDebugEditTool(tool)}
                        >{label}</button>
                      ))}
                      <button
                        type="button"
                        className="debug-undo-button"
                        onClick={undoDebugEdit}
                        disabled={debugUndoCount === 0}
                        title="撤回上一步砖块编辑（⌘/Ctrl+Z）"
                      >
                        ↶ 撤回{debugUndoCount > 0 ? ` ${debugUndoCount}` : ""}
                      </button>
                    </div>
                    <label className="debug-snap-control">
                      <span>时间吸附</span>
                      <select value={debugSnapMs} onChange={(event) => setDebugSnapMs(Number(event.target.value))}>
                        <option value={0}>关闭</option>
                        <option value={10}>10ms</option>
                        <option value={25}>25ms</option>
                        <option value={50}>50ms</option>
                        <option value={100}>100ms</option>
                      </select>
                    </label>
                    <div className="debug-window-control" aria-label="调试轨道显示范围">
                      {[8, 16, 32, 0].map((seconds) => (
                        <button
                          key={seconds}
                          type="button"
                          className={debugWindowSeconds === seconds ? "active" : ""}
                          onClick={() => setDebugWindowSeconds(seconds)}
                        >
                          {seconds === 0 ? "全曲" : `${seconds} 秒`}
                        </button>
                      ))}
                    </div>
                    <div className="debug-zoom-control" aria-label="调试时间轴缩放">
                      <button type="button" onClick={() => changeDebugTimelineZoom("out")} title="缩小时间轴">−</button>
                      <b>{debugWindowSeconds === 0 ? "全曲" : `${debugWindowSeconds.toFixed(1)}s`}</b>
                      <button type="button" onClick={() => changeDebugTimelineZoom("in")} title="放大时间轴">＋</button>
                    </div>
                    <div className="debug-speed-control" aria-label="慢动作联调播放速度">
                      <span>慢动作</span>
                      {[0.25, 0.5, 0.75, 1].map((rate) => (
                        <button
                          key={rate}
                          type="button"
                          className={debugPlaybackRate === rate ? "active" : ""}
                          onClick={() => changeDebugPlaybackRate(rate)}
                        >
                          {rate}×
                        </button>
                      ))}
                    </div>
                    <label className="visual-sync-control">
                      <span>动画同步</span>
                      <input
                        type="range"
                        min={0}
                        max={500}
                        step={5}
                        value={visualSyncMs}
                        onChange={(event) => changeVisualSync(Number(event.target.value))}
                        aria-label="动画画面提前补偿毫秒数"
                      />
                      <b>提前 {visualSyncMs}ms</b>
                    </label>
                  </div>
                  <b>{formatPreciseTime(currentTime)} / {formatTime(result.duration)}</b>
                </div>
                <canvas
                  ref={debugCanvasRef}
                  className="debug-timeline"
                  width={1_440}
                  height={460}
                  role="slider"
                  tabIndex={0}
                  aria-label="可编辑弹跳触发轨道，可单击新增、矩形框选、拖动和批量删除砖块触发点"
                  aria-valuemin={0}
                  aria-valuemax={Math.round(result.duration * 1_000)}
                  aria-valuenow={Math.round(currentTime * 1_000)}
                  onPointerDown={beginDebugNoteEdit}
                  onPointerMove={moveDebugNote}
                  onPointerUp={endDebugNoteEdit}
                  onPointerCancel={endDebugNoteEdit}
                  onWheel={zoomDebugTimelineWithWheel}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowRight" && selectedNote && selectedNoteIndices.length <= 1) {
                      event.preventDefault();
                      nudgeSelectedNote(debugSnapMs || 10);
                    } else if (event.key === "ArrowLeft" && selectedNote && selectedNoteIndices.length <= 1) {
                      event.preventDefault();
                      nudgeSelectedNote(-(debugSnapMs || 10));
                    } else if (event.key === "ArrowUp" && selectedNote && selectedNoteIndices.length <= 1 && manualEditMode === "sound") {
                      event.preventDefault();
                      transposeSelectedNote(event.shiftKey ? 12 : 1);
                    } else if (event.key === "ArrowDown" && selectedNote && selectedNoteIndices.length <= 1 && manualEditMode === "sound") {
                      event.preventDefault();
                      transposeSelectedNote(event.shiftKey ? -12 : -1);
                    } else if (event.key === "ArrowRight") seek(currentTime + 0.01);
                    else if (event.key === "ArrowLeft") seek(currentTime - 0.01);
                  }}
                />
                <div className="debug-legend">
                  <span><i className="debug-wave" /> 音频波形</span>
                  <span><i className="debug-spectral" /> 自动砖块触发</span>
                  <span><i className="debug-manual" /> 人工/谱面</span>
                  <span><i className="debug-filtered" /> 被过滤候选</span>
                </div>
                <p className="debug-slow-tip"><b>直接编辑：</b>选择模式单击空白会补充真实砖块并立即显示碰撞；鼠标滚轮缩放时间轴，⌘/Ctrl+Z 撤回。按住左键拖出矩形可框选，再按 ESC、Backspace 或 Delete 批量删除。{manualEditMode === "trigger" ? "这里只补弹跳触发，原始音乐不变。" : "拖动可改时间/音高，拖右边缘改长度。"}</p>
                <div className="debug-explain-grid">
                  <div className="explain-filtered"><b>被过滤候选是什么？</b><p>模型曾怀疑这里有触键，但因太弱、离已有点太近或更像延音而被淘汰。它只是一条诊断线，本来就不会触发弹跳。</p></div>
                </div>
                <div className="debug-note-list-heading">
                  <b>当前窗口落点清单</b>
                  <span>{visibleDebugNotes.length} 个落点{visibleDebugNotes.length > listedDebugNotes.length ? ` · 显示播放头附近 ${listedDebugNotes.length} 个` : ""}</span>
                </div>
                <div className="debug-note-list">
                  {listedDebugNotes.map(({ note, index }) => (
                    <button
                      type="button"
                      key={`${note.time}-${index}`}
                      className={`${selectedNoteIndex === index || selectedNoteIndices.includes(index) ? "active" : ""} ${modelPointsMuted && note.source === "model" ? "is-muted" : ""}`}
                      onClick={() => {
                        setSelectedNoteIndex(index);
                        setSelectedNoteIndices([]);
                        setDebugSelectionRect(null);
                        seek(note.time);
                      }}
                    >
                      <strong>{manualEditMode === "trigger" ? "砖块" : noteName(note.pitch)}</strong>
                      <span>{formatPreciseTime(note.time)}</span>
                      <small>{onsetEvidenceText(note)}{modelPointsMuted && note.source === "model" ? " · 已屏蔽" : ""}</small>
                      <i>{manualEditMode === "trigger" ? "弹跳触发" : `强度 ${Math.round(note.velocity * 100)}%`}</i>
                    </button>
                  ))}
                </div>
              </div>

              <aside className="debug-inspector">
                <div className="debug-subsection-heading"><span>选中点详情与微调</span><small>精确编辑、批量操作与谱面文件</small></div>
                <div className="debug-inspector-title">
                  <span>{selectedNoteIndices.length > 1 ? `已框选 ${selectedNoteIndices.length} 个砖块` : "当前选中落点"}</span>
                  <b>{selectedNoteIndices.length > 1 ? "可批量删除" : selectedNote ? formatPreciseTime(selectedNote.time) : "点击轨道选点"}</b>
                </div>
                <div className="debug-note-card">
                  <div><small>{manualEditMode === "trigger" ? "用途" : "音名"}</small><b>{selectedNote ? manualEditMode === "trigger" ? "生成砖块并触发弹跳" : noteName(selectedNote.pitch) : "—"}</b></div>
                  <div><small>来源</small><b>{selectedNote ? sourceText(selectedNote.source) : "—"}</b></div>
                  {manualEditMode === "sound" && <div><small>音高置信度</small><b>{selectedNote ? `${Math.round(selectedNote.confidence * 100)}%` : "—"}</b></div>}
                  {manualEditMode === "sound" && <div><small>触键强度</small><b>{selectedNote ? `${Math.round(selectedNote.velocity * 100)}%` : "—"}</b></div>}
                  <div><small>踩点依据</small><b>{selectedNote ? onsetEvidenceText(selectedNote) : "—"}</b></div>
                  <div><small>模型支持度</small><b>{selectedNote?.modelConfidence ? `${Math.round(selectedNote.modelConfidence * 100)}%` : "无模型确认"}</b></div>
                  <div><small>距播放头</small><b>{selectedNote ? `${Math.round((selectedNote.time - currentTime) * 1_000)}ms` : "—"}</b></div>
                </div>

                <div className="debug-parameter-editor">
                  <label>
                    <span>精确时间（秒）</span>
                    <input
                      type="number"
                      min={0}
                      max={result.duration}
                      step={0.001}
                      value={selectedNote ? selectedNote.time.toFixed(3) : ""}
                      disabled={!selectedNote}
                      onChange={(event) => updateSelectedNoteValue({ time: Number(event.target.value) })}
                    />
                  </label>
                  {manualEditMode === "sound" && <>
                  <label>
                    <span>音符长度（秒）</span>
                    <input
                      type="number"
                      min={0.08}
                      max={8}
                      step={0.01}
                      value={selectedNote ? selectedNote.duration.toFixed(2) : ""}
                      disabled={!selectedNote}
                      onChange={(event) => updateSelectedNoteValue({ duration: Number(event.target.value) })}
                    />
                  </label>
                  <label className="debug-velocity-editor">
                    <span>钢琴力度</span>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      value={selectedNote ? Math.round(selectedNote.velocity * 100) : 10}
                      disabled={!selectedNote}
                      onChange={(event) => updateSelectedNoteValue({ velocity: Number(event.target.value) / 100 })}
                    />
                    <b>{selectedNote ? `${Math.round(selectedNote.velocity * 100)}%` : "—"}</b>
                  </label>
                  <div className="debug-pitch-editor">
                    <button type="button" disabled={!selectedNote} onClick={() => transposeSelectedNote(-12)}>−1 八度</button>
                    <button type="button" disabled={!selectedNote} onClick={() => transposeSelectedNote(-1)}>−半音</button>
                    <b>{selectedNote ? noteName(selectedNote.pitch) : "未选中"}</b>
                    <button type="button" disabled={!selectedNote} onClick={() => transposeSelectedNote(1)}>+半音</button>
                    <button type="button" disabled={!selectedNote} onClick={() => transposeSelectedNote(12)}>+1 八度</button>
                  </div>
                  <button
                    type="button"
                    className="debug-audition-note"
                    disabled={!selectedNote}
                    onClick={() => selectedNote && void auditionPianoNote(selectedNote.pitch, selectedNote.velocity)}
                  >♪ 试听选中钢琴音</button>
                  </>}
                </div>

                <div className="debug-control-label"><span>选中点微调</span><small>处理前后几毫秒偏差</small></div>
                <div className="nudge-grid">
                  {[-50, -10, 10, 50].map((milliseconds) => (
                    <button key={milliseconds} type="button" disabled={!selectedNote || selectedNoteIndices.length > 1} onClick={() => nudgeSelectedNote(milliseconds)}>
                      {milliseconds > 0 ? "+" : ""}{milliseconds}ms
                    </button>
                  ))}
                </div>

                <div className="debug-control-label"><span>整条轨道偏移</span><b>{timingOffsetMs > 0 ? "+" : ""}{timingOffsetMs}ms</b></div>
                <input
                  className="debug-offset-range"
                  aria-label="整条音符轨道时间偏移"
                  type="range"
                  min={-240}
                  max={240}
                  step={5}
                  value={timingOffsetMs}
                  onChange={(event) => applyGlobalOffset(Number(event.target.value))}
                />
                <div className="debug-offset-labels"><span>整体提前</span><button type="button" onClick={() => applyGlobalOffset(0)}>归零</button><span>整体延后</span></div>

                <div className="debug-actions">
                  <button type="button" onClick={addLandingAtCurrentTime}>＋ 播放头补点</button>
                  <button type="button" onClick={deleteSelectedNote} disabled={!selectedNote && selectedNoteIndices.length === 0}>－ {selectedNoteIndices.length > 1 ? `批量删除 ${selectedNoteIndices.length} 个` : "删除选中点"}</button>
                  <button type="button" onClick={exportDebugJson}>导出调试 JSON</button>
                </div>
                <div className="debug-batch-entry">
                  <label htmlFor="debug-batch-times">批量弹跳秒数</label>
                  <div>
                    <input
                      id="debug-batch-times"
                      type="text"
                      value={manualTimesInput}
                      onChange={(event) => setManualTimesInput(event.target.value)}
                      onKeyDown={(event) => event.key === "Enter" && addLandingsFromTimes()}
                      placeholder="1, 5, 8, 12"
                    />
                    <button type="button" onClick={addLandingsFromTimes}>新增</button>
                  </div>
                </div>
                {manualEditMode === "sound" && <div className="debug-piano-mix">
                  <button
                    type="button"
                    className={pianoSoundEnabled ? "active" : ""}
                    aria-pressed={pianoSoundEnabled}
                    onClick={() => setPianoSoundEnabled((enabled) => !enabled)}
                  >♫ 弹跳钢琴音 {pianoSoundEnabled ? "开" : "关"}</button>
                  <input
                    aria-label="调试面板钢琴音量"
                    type="range"
                    min={0}
                    max={160}
                    value={pianoVolume}
                    disabled={!pianoSoundEnabled}
                    onChange={(event) => setPianoVolume(Number(event.target.value))}
                  />
                  <b>{pianoVolume}%</b>
                </div>}
                <div className="debug-score-actions">
                  <button type="button" onClick={startBlankManualScore}>新建空白谱面</button>
                  <button type="button" onClick={() => scoreInputRef.current?.click()}>载入谱面</button>
                  <button type="button" onClick={exportEditableScore} disabled={!activeNotes.length}>导出谱面</button>
                </div>
                <p>{manualEditMode === "trigger"
                  ? "砖块触发模式只使用每个点的时间：原始音乐继续播放，辅助钢琴音与音高编辑隐藏。算法不准时，直接听原声补点、拖动或框选删除即可。"
                  : "“双通道确认”表示频谱起音与音符模型同时命中，最接近可信触键；发现漏点可暂停补点，多余点可选中删除。"}</p>
              </aside>
            </div>
        </section>
      )}
    </main>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatPreciseTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const remainder = safe - minutes * 60;
  return `${minutes}:${remainder.toFixed(3).padStart(6, "0")}`;
}

function sourceText(source: MelodyNote["source"]) {
  if (source === "spectral") return "频谱起音";
  if (source === "model") return "模型补点";
  if (source === "manual") return "人工校准";
  if (source === "score") return "精准谱面";
  return "自动识别";
}

function onsetEvidenceText(note: MelodyNote) {
  if (note.source === "score") return "谱面确认";
  if (note.source === "manual") return "人工确认";
  if (note.source === "model") return "模型独立补点";
  if ((note.modelConfidence ?? 0) > 0) return "双通道确认";
  if (note.source === "spectral") return "仅频谱起音";
  return "自动识别";
}

function buildWaveform(buffer: AudioBuffer, points: number) {
  const output = new Array(points).fill(0) as number[];
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
  const usableSamples = Math.min(channels[0].length, Math.floor(buffer.sampleRate * 240));
  const samplesPerPoint = Math.max(1, Math.floor(usableSamples / points));
  for (let point = 0; point < points; point += 1) {
    const start = point * samplesPerPoint;
    const end = Math.min(usableSamples, start + samplesPerPoint);
    const stride = Math.max(1, Math.floor((end - start) / 96));
    let peak = 0;
    for (let index = start; index < end; index += stride) {
      let sample = 0;
      for (const channel of channels) sample += Math.abs(channel[index] ?? 0);
      peak = Math.max(peak, sample / channels.length);
    }
    output[point] = clamp(peak, 0, 1);
  }
  return output;
}

function debugTimeRange(currentTime: number, duration: number, windowSeconds: number) {
  if (windowSeconds <= 0) return { start: 0, end: Math.max(0.001, duration) };
  const length = Math.min(Math.max(1, windowSeconds), Math.max(1, duration));
  const start = clamp(currentTime - length / 2, 0, Math.max(0, duration - length));
  return { start, end: Math.min(duration, start + length) };
}

function snapEditorTime(time: number, snapMs: number, duration: number) {
  if (snapMs <= 0) return clamp(time, 0, duration);
  const step = snapMs / 1_000;
  return clamp(Math.round(time / step) * step, 0, duration);
}

function debugEditorGeometry(
  width: number,
  height: number,
  result: AnalysisResult,
  currentTime: number,
  windowSeconds: number,
  triggerOnly: boolean,
) {
  const range = debugTimeRange(currentTime, result.duration, windowSeconds);
  const left = 72;
  const right = 24;
  const plotWidth = Math.max(1, width - left - right);
  const noteTop = 190;
  const filterTop = height - 78;
  const noteBottom = filterTop - 24;
  const visibleNotes = result.notes.filter((note) => note.time >= range.start && note.time <= range.end);
  const visibleCandidates = (result.diagnostics?.modelCandidates ?? [])
    .filter((candidate) => candidate.time >= range.start && candidate.time <= range.end);
  const visiblePitches = [...visibleNotes.map((note) => note.pitch), ...visibleCandidates.map((candidate) => candidate.pitch)];
  const minPitch = visiblePitches.length ? Math.min(...visiblePitches) - 2 : 48;
  const maxPitch = visiblePitches.length ? Math.max(...visiblePitches) + 2 : 76;
  const rangeDuration = Math.max(0.001, range.end - range.start);
  const xFor = (time: number) => left + ((time - range.start) / rangeDuration) * plotWidth;
  const timeFor = (x: number) => range.start + ((x - left) / plotWidth) * rangeDuration;
  const triggerLaneY = noteTop + (noteBottom - noteTop) * 0.5;
  const yFor = (pitch: number) => triggerOnly
    ? triggerLaneY
    : noteBottom - ((pitch - minPitch) / Math.max(1, maxPitch - minPitch)) * (noteBottom - noteTop);
  const pitchFor = (y: number) => triggerOnly
    ? 60
    : Math.round(minPitch + ((noteBottom - y) / Math.max(1, noteBottom - noteTop)) * (maxPitch - minPitch));
  return {
    range,
    rangeDuration,
    left,
    right,
    plotWidth,
    noteTop,
    noteBottom,
    filterTop,
    minPitch,
    maxPitch,
    visibleNotes,
    visibleCandidates,
    triggerOnly,
    triggerLaneY,
    xFor,
    timeFor,
    yFor,
    pitchFor,
  };
}

function candidateColor(candidate: AnalysisCandidate) {
  if (candidate.status === "sustain") return "rgba(255, 190, 91, .76)";
  if (candidate.status === "weak") return "rgba(210, 203, 226, .42)";
  return "rgba(184, 163, 218, .64)";
}

function candidateStatusText(candidate: AnalysisCandidate) {
  if (candidate.status === "sustain") return "延音过滤";
  if (candidate.status === "weak") return "弱候选";
  if (candidate.status === "nearby") return "邻近去重";
  if (candidate.status === "matched") return "双通道确认";
  return "模型补点";
}

function prepareHiDpiCanvas(canvas: HTMLCanvasElement) {
  const bounds = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(bounds.width));
  const height = Math.max(1, Math.round(bounds.height));
  const pixelRatio = Math.min(2.5, Math.max(1, window.devicePixelRatio || 1));
  const backingWidth = Math.round(width * pixelRatio);
  const backingHeight = Math.round(height * pixelRatio);
  if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
    canvas.width = backingWidth;
    canvas.height = backingHeight;
  }
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.imageSmoothingEnabled = true;
  return { context, width, height };
}

function drawDebugTimeline(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  waveform: number[],
  result: AnalysisResult,
  currentTime: number,
  windowSeconds: number,
  selectedNoteIndex: number | null,
  selectedNoteIndices: number[],
  modelPointsMuted: boolean,
  manualEditMode: ManualEditMode,
  selectionRect: DebugSelectionRect | null,
) {
  const triggerOnly = manualEditMode === "trigger";
  const selectedIndexes = new Set(selectedNoteIndices);
  if (selectedNoteIndex !== null) selectedIndexes.add(selectedNoteIndex);
  const geometry = debugEditorGeometry(width, height, result, currentTime, windowSeconds, triggerOnly);
  const { range, rangeDuration, left, right, plotWidth, noteTop, noteBottom, filterTop, visibleNotes, visibleCandidates, minPitch, maxPitch, xFor, yFor, triggerLaneY } = geometry;
  context.clearRect(0, 0, width, height);
  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#070b19");
  background.addColorStop(1, "#160a21");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  const gridStep = rangeDuration <= 8 ? 1 : rangeDuration <= 16 ? 2 : rangeDuration <= 40 ? 5 : rangeDuration <= 120 ? 15 : 30;
  context.font = "600 12px ui-monospace, monospace";
  context.textAlign = "center";
  for (let second = Math.ceil(range.start / gridStep) * gridStep; second <= range.end; second += gridStep) {
    const x = xFor(second);
    context.strokeStyle = "rgba(255,255,255,.07)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(x, 18);
    context.lineTo(x, height - 23);
    context.stroke();
    context.fillStyle = "rgba(255,255,255,.38)";
    context.fillText(rangeDuration > 40 ? formatTime(second) : formatPreciseTime(second), x, height - 7);
  }

  const waveformCenter = 92;
  const waveformAmplitude = 52;
  const waveformDivider = 160;
  for (const strength of [0.25, 0.5, 0.75, 1]) {
    const offset = strength * waveformAmplitude;
    context.strokeStyle = strength === 1 ? "rgba(101,240,180,.13)" : "rgba(255,255,255,.045)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(left, waveformCenter - offset);
    context.lineTo(width - right, waveformCenter - offset);
    context.moveTo(left, waveformCenter + offset);
    context.lineTo(width - right, waveformCenter + offset);
    context.stroke();
  }
  const waveformFill = context.createLinearGradient(0, waveformCenter - waveformAmplitude, 0, waveformCenter + waveformAmplitude);
  waveformFill.addColorStop(0, "rgba(101,240,180,.42)");
  waveformFill.addColorStop(0.5, "rgba(103,232,255,.12)");
  waveformFill.addColorStop(1, "rgba(101,240,180,.42)");
  context.fillStyle = waveformFill;
  context.strokeStyle = "rgba(117,255,206,.96)";
  context.lineWidth = 1.8;
  context.lineJoin = "round";
  context.beginPath();
  const startWave = Math.floor((range.start / Math.max(0.1, result.duration)) * waveform.length);
  const endWave = Math.ceil((range.end / Math.max(0.1, result.duration)) * waveform.length);
  const waveStride = Math.max(1, Math.floor((endWave - startWave) / Math.max(1, plotWidth * 1.5)));
  for (let index = startWave; index <= endWave; index += waveStride) {
    const time = (index / Math.max(1, waveform.length - 1)) * result.duration;
    const x = xFor(time);
    const y = waveformCenter - (waveform[index] ?? 0) * waveformAmplitude;
    if (index === startWave) context.moveTo(x, waveformCenter);
    context.lineTo(x, y);
  }
  for (let index = endWave; index >= startWave; index -= waveStride) {
    const time = (index / Math.max(1, waveform.length - 1)) * result.duration;
    const x = xFor(time);
    const y = waveformCenter + (waveform[index] ?? 0) * waveformAmplitude;
    context.lineTo(x, y);
  }
  context.closePath();
  context.fill();
  context.stroke();
  context.strokeStyle = "rgba(255,255,255,.18)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(left, waveformCenter + 0.5);
  context.lineTo(width - right, waveformCenter + 0.5);
  context.stroke();

  context.textAlign = "left";
  context.font = "650 12px system-ui, sans-serif";
  context.fillStyle = "rgba(255,255,255,.5)";
  context.fillText("音量强度", 12, waveformCenter + 4);
  context.fillText(triggerOnly ? "砖块触发" : "识别音符", 12, noteTop + (noteBottom - noteTop) / 2);
  context.fillText("过滤候选", 16, filterTop + 31);
  context.strokeStyle = "rgba(255,255,255,.08)";
  context.beginPath();
  context.moveTo(left, waveformDivider);
  context.lineTo(width - right, waveformDivider);
  context.moveTo(left, filterTop);
  context.lineTo(width - right, filterTop);
  context.stroke();

  if (triggerOnly) {
    context.fillStyle = "rgba(103,232,255,.035)";
    context.fillRect(left, triggerLaneY - 40, plotWidth, 80);
    context.strokeStyle = "rgba(103,232,255,.22)";
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(left, triggerLaneY);
    context.lineTo(width - right, triggerLaneY);
    context.stroke();
  } else {
    const blackPitchClasses = new Set([1, 3, 6, 8, 10]);
    const pitchRowHeight = Math.max(5, (noteBottom - noteTop) / Math.max(1, maxPitch - minPitch));
    for (let pitch = Math.floor(minPitch); pitch <= Math.ceil(maxPitch); pitch += 1) {
      const y = yFor(pitch);
      const blackKey = blackPitchClasses.has(((pitch % 12) + 12) % 12);
      context.fillStyle = blackKey ? "rgba(0,0,0,.16)" : "rgba(255,255,255,.012)";
      context.fillRect(left, y - pitchRowHeight / 2, plotWidth, pitchRowHeight);
      context.fillStyle = blackKey ? "rgba(7,10,18,.98)" : "rgba(235,242,255,.76)";
      context.fillRect(8, y - pitchRowHeight / 2, left - 16, pitchRowHeight - 1);
      context.strokeStyle = "rgba(255,255,255,.045)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(left, y + pitchRowHeight / 2);
      context.lineTo(width - right, y + pitchRowHeight / 2);
      context.stroke();
    }

    context.font = "600 10px ui-monospace, monospace";
    context.textAlign = "right";
    for (let pitch = Math.ceil(minPitch / 6) * 6; pitch <= maxPitch; pitch += 6) {
      const y = yFor(pitch);
      context.strokeStyle = pitch % 12 === 0 ? "rgba(103,232,255,.10)" : "rgba(255,255,255,.045)";
      context.beginPath();
      context.moveTo(left, y);
      context.lineTo(width - right, y);
      context.stroke();
      context.fillStyle = "rgba(255,255,255,.32)";
      context.fillText(noteName(pitch), left - 8, y + 3);
    }
  }

  let lastLabelX = -Infinity;
  let labelRow = 0;
  visibleNotes.forEach((note) => {
    const noteIndex = result.notes.indexOf(note);
    const selected = selectedIndexes.has(noteIndex);
    const x = xFor(note.time);
    const y = yFor(note.pitch);
    const color = note.source === "model"
      ? "#ff657d"
      : note.source === "manual" || note.source === "score"
        ? "#ffcf63"
        : "#65f0b4";
    const noteIsMuted = modelPointsMuted && note.source === "model";
    context.strokeStyle = color;
    context.globalAlpha = noteIsMuted ? 0.2 : 0.34 + note.confidence * 0.58;
    const endX = triggerOnly ? x + 12 : xFor(Math.min(range.end, note.time + Math.max(0.04, note.duration)));
    context.globalAlpha = noteIsMuted ? 0.14 : 0.2 + note.confidence * 0.24;
    context.lineWidth = selected ? 11 : 8;
    context.lineCap = "round";
    context.setLineDash(noteIsMuted ? [5, 5] : []);
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(Math.max(x + 3, endX), y);
    context.stroke();
    context.lineCap = "butt";
    context.setLineDash([]);
    context.globalAlpha = noteIsMuted ? 0.24 : 0.34 + note.confidence * 0.58;
    context.lineWidth = selected ? 3 : 1.6;
    context.beginPath();
    context.moveTo(x, noteBottom + 8);
    context.lineTo(x, y);
    context.stroke();
    context.globalAlpha = 1;
    context.fillStyle = color;
    context.shadowColor = color;
    context.shadowBlur = selected ? 16 : 5;
    context.beginPath();
    if (triggerOnly) context.roundRect(x - (selected ? 10 : 8), y - (selected ? 10 : 8), selected ? 20 : 16, selected ? 20 : 16, 4);
    else context.arc(x, y, selected ? 9 : 5.4, 0, Math.PI * 2);
    context.fill();
    if (!triggerOnly && selected && endX - x >= 18) {
      context.fillStyle = "rgba(255,255,255,.95)";
      context.fillRect(endX - 2, y - 6, 4, 12);
    }
    if (noteIsMuted) {
      context.strokeStyle = "rgba(255,255,255,.82)";
      context.lineWidth = 1.4;
      context.beginPath();
      context.moveTo(x - 6, y - 6);
      context.lineTo(x + 6, y + 6);
      context.moveTo(x + 6, y - 6);
      context.lineTo(x - 6, y + 6);
      context.stroke();
    }
    context.shadowBlur = 0;
    context.globalAlpha = 1;
    context.fillStyle = noteIsMuted ? "rgba(255,101,125,.35)" : color;
    const strengthHeight = Math.max(3, Math.round(note.velocity * 18));
    context.fillRect(x - 2.5, noteBottom + 21 - strengthHeight, 5, strengthHeight);
    const shouldLabel = selected || rangeDuration <= 16 || x - lastLabelX >= 74;
    if (shouldLabel) {
      context.fillStyle = selected ? "#ffffff" : "rgba(255,255,255,.76)";
      context.font = selected ? "750 13px ui-monospace, monospace" : "650 11px ui-monospace, monospace";
      context.textAlign = "center";
      const labelY = Math.max(noteTop + 11, y - 12 - (labelRow % 2) * 15);
      context.fillText(triggerOnly
        ? `${formatPreciseTime(note.time)} · 砖块${noteIsMuted ? " · 已屏蔽" : ""}`
        : `${noteName(note.pitch)} · 强度${Math.round(note.velocity * 100)}${noteIsMuted ? " · 已屏蔽" : ""}`, x, labelY);
      lastLabelX = x;
      labelRow += 1;
    }
  });

  visibleCandidates
    .filter((candidate) => candidate.status !== "matched" && candidate.status !== "added")
    .forEach((candidate) => {
      const x = xFor(candidate.time);
      const y = yFor(candidate.pitch);
      context.strokeStyle = candidateColor(candidate);
      context.lineWidth = 1.5;
      context.setLineDash([4, 4]);
      context.beginPath();
      context.moveTo(x, filterTop + 8);
      context.lineTo(x, y);
      context.stroke();
      context.setLineDash([]);
      context.save();
      context.translate(x, y);
      context.rotate(Math.PI / 4);
      context.strokeRect(-4.5, -4.5, 9, 9);
      context.restore();
      context.beginPath();
      context.moveTo(x, filterTop + 12);
      context.lineTo(x, height - 31);
      context.stroke();
      if (rangeDuration <= 16) {
        context.fillStyle = candidateColor(candidate);
        context.font = "600 10px ui-monospace, monospace";
        context.textAlign = "center";
        context.fillText(triggerOnly
          ? candidateStatusText(candidate)
          : `${noteName(candidate.pitch)} ${candidateStatusText(candidate)}`, x, height - 35);
      }
    });

  if (selectionRect && (selectionRect.width > 1 || selectionRect.height > 1)) {
    context.fillStyle = "rgba(103,232,255,.12)";
    context.strokeStyle = "rgba(103,232,255,.92)";
    context.lineWidth = 1.5;
    context.setLineDash([7, 5]);
    context.fillRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height);
    context.strokeRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height);
    context.setLineDash([]);
  }

  const markerX = xFor(currentTime);
  context.strokeStyle = "rgba(255,255,255,.96)";
  context.shadowColor = "#ffffff";
  context.shadowBlur = 8;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(markerX, 14);
  context.lineTo(markerX, height - 24);
  context.stroke();
  context.shadowBlur = 0;
}

function analysisFromSampleScore(score: SampleScore, duration: number): AnalysisResult {
  const secondsPerBeat = 60 / score.bpm;
  const notes: MelodyNote[] = score.notes.map((note) => ({
    time: score.lead_in_seconds + note.beat * secondsPerBeat,
    duration: Math.max(0.12, note.duration * secondsPerBeat),
    pitch: note.pitch,
    confidence: 1,
    velocity: 0.92,
    source: "score",
  }));
  const pitchClasses = new Array(12).fill(0) as number[];
  notes.forEach((note) => { pitchClasses[note.pitch % 12] += note.duration; });
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const root = pitchClasses.indexOf(Math.max(...pitchClasses));
  return {
    notes,
    duration,
    keyLabel: `${names[root]} 调感`,
    tempo: score.bpm,
    quality: "high",
    diagnostics: {
      profile: "score",
      sensitivity: 1,
      spectralCount: notes.length,
      modelCandidates: [],
    },
  };
}

function drawMelodyTimeline(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  notes: MelodyNote[],
  duration: number,
  currentTime: number,
  selectedNote: MelodyNote | null,
) {
  context.clearRect(0, 0, width, height);
  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#090d21");
  background.addColorStop(0.55, "#12102a");
  background.addColorStop(1, "#190b25");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "rgba(255,255,255,.07)";
  context.lineWidth = 1;
  for (let column = 1; column < 8; column += 1) {
    const x = (column / 8) * width;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let row = 1; row < 4; row += 1) {
    const y = (row / 4) * height;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }

  if (notes.length) {
    const pitches = notes.map((note) => note.pitch);
    const minPitch = Math.min(...pitches) - 2;
    const maxPitch = Math.max(...pitches) + 2;
    const xFor = (time: number) => (time / Math.max(0.1, duration)) * width;
    const yFor = (pitch: number) => height - 18 - ((pitch - minPitch) / Math.max(1, maxPitch - minPitch)) * (height - 36);

    const line = context.createLinearGradient(0, 0, width, 0);
    line.addColorStop(0, "#64eaff");
    line.addColorStop(0.52, "#9b83ff");
    line.addColorStop(1, "#ff74bd");
    context.strokeStyle = line;
    context.lineWidth = 2.2;
    context.globalAlpha = 0.68;
    context.beginPath();
    notes.forEach((note, index) => {
      const x = xFor(note.time);
      const y = yFor(note.pitch);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
    context.globalAlpha = 1;

    notes.forEach((note) => {
      const x = xFor(note.time);
      const y = yFor(note.pitch);
      const manual = note.source === "manual";
      const selected = note === selectedNote;
      context.fillStyle = manual ? "#ffd75e" : "#72ecff";
      context.shadowColor = manual ? "#ffd75e" : "#55dfff";
      context.shadowBlur = selected ? 20 : manual ? 12 : 5;
      if (selected) {
        context.strokeStyle = "rgba(255,255,255,.96)";
        context.lineWidth = 2;
        context.beginPath();
        context.arc(x, y, 9.5, 0, Math.PI * 2);
        context.stroke();
      }
      context.beginPath();
      context.arc(x, y, selected ? 6.5 : manual ? 5.2 : 2.2 + note.velocity * 1.9, 0, Math.PI * 2);
      context.fill();
    });
    context.shadowBlur = 0;

    const nearest = notes.reduce((best, note) =>
      Math.abs(note.time - currentTime) < Math.abs(best.time - currentTime) ? note : best,
    );
    context.fillStyle = "rgba(255,255,255,.7)";
    context.font = "600 16px ui-monospace, monospace";
    context.textAlign = "right";
    context.fillText(noteName(nearest.pitch), width - 12, 21);
  }

  const markerX = clamp(currentTime / Math.max(0.1, duration), 0, 1) * width;
  context.strokeStyle = "rgba(255,255,255,.95)";
  context.lineWidth = 2;
  context.shadowColor = "#ffffff";
  context.shadowBlur = 8;
  context.beginPath();
  context.moveTo(markerX, 0);
  context.lineTo(markerX, height);
  context.stroke();
  context.shadowBlur = 0;
}
