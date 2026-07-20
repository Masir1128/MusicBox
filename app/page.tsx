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
import {
  renderMusicBox,
  type ImpactEffect,
  type LabelMode,
  type SceneTheme,
  type VisualStyle,
} from "../lib/renderMusicBox";

const SAMPLE_TRACKS = [
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
] as const;

type SampleScore = {
  bpm: number;
  lead_in_seconds: number;
  notes: Array<{ pitch: number; beat: number; duration: number }>;
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

const profileText: Record<AnalysisProfile, string> = {
  balanced: "综合旋律",
  piano: "钢琴重音",
  rhythm: "节奏强拍",
};

const noteName = (pitch: number) => {
  const names = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  return `${names[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
};

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const debugPreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const timelineCanvasRef = useRef<HTMLCanvasElement>(null);
  const debugCanvasRef = useRef<HTMLCanvasElement>(null);
  const debugConsoleRef = useRef<HTMLElement>(null);
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
  const animationRef = useRef<number | null>(null);
  const currentTimeRef = useRef(0);
  const lastUiUpdateRef = useRef(0);
  const exportAudioRef = useRef<HTMLAudioElement | null>(null);
  const decodedBufferRef = useRef<AudioBuffer | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const defaultLoadedRef = useRef(false);
  const notesRef = useRef<MelodyNote[]>(INITIAL_RESULT.notes);
  const durationRef = useRef(INITIAL_RESULT.duration);
  const analysisProfileRef = useRef<AnalysisProfile>("piano");
  const sensitivityRef = useRef(68);
  const visualSyncMsRef = useRef(28);
  const styleRef = useRef<VisualStyle>({
    labelMode: "solfege",
    theme: "nebula",
    meteorIntensity: 72,
    impactEffect: "cartoon",
    impactIntensity: 82,
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
  const [analysisProfile, setAnalysisProfile] = useState<AnalysisProfile>("piano");
  const [sensitivity, setSensitivity] = useState(68);
  const [labelMode, setLabelMode] = useState<LabelMode>("solfege");
  const [theme, setTheme] = useState<SceneTheme>("nebula");
  const [meteorIntensity, setMeteorIntensity] = useState(72);
  const [impactEffect, setImpactEffect] = useState<ImpactEffect>("cartoon");
  const [impactIntensity, setImpactIntensity] = useState(82);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [hasOfficialScore, setHasOfficialScore] = useState(false);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [debugOpen, setDebugOpen] = useState(true);
  const [debugWindowSeconds, setDebugWindowSeconds] = useState(16);
  const [debugExpanded, setDebugExpanded] = useState(false);
  const [debugPreviewOpen, setDebugPreviewOpen] = useState(true);
  const [debugPreviewPosition, setDebugPreviewPosition] = useState<{ x: number; y: number } | null>(null);
  const [debugPreviewWidth, setDebugPreviewWidth] = useState(188);
  const [modelPointsMuted, setModelPointsMuted] = useState(true);
  const [debugPlaybackRate, setDebugPlaybackRate] = useState(1);
  const [visualSyncMs, setVisualSyncMs] = useState(28);
  const [selectedNoteIndex, setSelectedNoteIndex] = useState<number | null>(null);
  const [timingOffsetMs, setTimingOffsetMs] = useState(0);

  const visualStyle = useMemo<VisualStyle>(
    () => ({ labelMode, theme, meteorIntensity, impactEffect, impactIntensity }),
    [labelMode, theme, meteorIntensity, impactEffect, impactIntensity],
  );

  const activeNotes = useMemo(
    () => modelPointsMuted ? result.notes.filter((note) => note.source !== "model") : result.notes,
    [modelPointsMuted, result.notes],
  );

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
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDebugExpanded(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [debugExpanded]);

  const analyzeDecodedAudio = useCallback(async (decoded: AudioBuffer) => {
    const profile = analysisProfileRef.current;
    const base = await analyzeMelody(
      decoded,
      (nextProgress, nextStage) => {
        setProgress(profile === "piano" ? nextProgress * 0.6 : nextProgress);
        setStage(nextStage);
      },
      { profile, sensitivity: sensitivityRef.current / 100 },
    );
    if (profile !== "piano") return base;
    try {
      return await refinePianoOnsets(
        decoded,
        base,
        sensitivityRef.current / 100,
        (nextProgress, nextStage) => {
          setProgress(nextProgress);
          setStage(nextStage);
        },
      );
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
    drawMelodyTimeline(context, canvas.width, canvas.height, activeNotes, result.duration, currentTime);
  }, [activeNotes, result.duration, currentTime]);

  useEffect(() => {
    if (!debugOpen) return;
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
        modelPointsMuted,
      );
    };
    draw();
    const resizeObserver = new ResizeObserver(draw);
    resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, [debugOpen, debugWindowSeconds, currentTime, modelPointsMuted, result, selectedNoteIndex, waveform]);

  const analyzeFile = useCallback(async (file: File, displayName = file.name, sampleScore?: SampleScore) => {
    if (file.size > 80 * 1024 * 1024) {
      setStatus("error");
      setStage("文件大于 80MB，请先截取要制作的段落");
      return;
    }
    setStatus("analyzing");
    setProgress(0.02);
    setStage("正在读取音频");
    setFileName(displayName);
    setPlaying(false);
    setCurrentTime(0);
    setHasOfficialScore(Boolean(sampleScore));
    setSelectedNoteIndex(null);
    setTimingOffsetMs(0);
    setModelPointsMuted(true);
    setDebugPlaybackRate(1);
    currentTimeRef.current = 0;
    audioRef.current?.pause();

    try {
      const arrayBuffer = await file.arrayBuffer();
      const AudioContextClass = window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) throw new Error("AudioContext unavailable");
      const context = new AudioContextClass();
      const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
      decodedBufferRef.current = decoded;
      setWaveform(buildWaveform(decoded, Math.min(48_000, Math.max(5_000, Math.ceil(decoded.duration * 160)))));
      const analysis = sampleScore
        ? analysisFromSampleScore(sampleScore, decoded.duration)
        : await analyzeDecodedAudio(decoded);
      await context.close();

      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const nextUrl = URL.createObjectURL(file);
      objectUrlRef.current = nextUrl;
      setAudioUrl(nextUrl);
      setResult(analysis);
      setStatus("ready");
      setProgress(1);
      const coverage = decoded.duration > analysis.duration ? ` · 已取前 ${formatTime(analysis.duration)}` : "";
      setStage(`${sampleScore ? "官方精准谱面" : profileText[analysisProfileRef.current]} · ${analysis.notes.length} 个同步落点${coverage}`);
    } catch (error) {
      console.error(error);
      setStatus("error");
      setProgress(0);
      setStage("无法解码该音频，可尝试转成 MP3 或 WAV");
    }
  }, [analyzeDecodedAudio]);

  const reanalyzeCurrentTrack = useCallback(async () => {
    const decoded = decodedBufferRef.current;
    if (!decoded || status === "analyzing") return;
    audioRef.current?.pause();
    setPlaying(false);
    setStatus("analyzing");
    setProgress(0.02);
    setStage(`正在用「${profileText[analysisProfileRef.current]}」重新解析`);
    setCurrentTime(0);
    currentTimeRef.current = 0;
    if (audioRef.current) audioRef.current.currentTime = 0;
    try {
      const analysis = await analyzeDecodedAudio(decoded);
      setHasOfficialScore(false);
      setSelectedNoteIndex(null);
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
        await analyzeFile(file, sample.name, score);
      } catch (error) {
        console.error(error);
        setStatus("error");
        setStage("测试样本加载失败");
      }
    },
    [analyzeFile],
  );

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
      renderMusicBox(
        context,
        canvas.width,
        canvas.height,
        time,
        notesRef.current,
        durationRef.current,
        styleRef.current,
      );
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
    setCurrentTime(next);
  };

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
    const next = clamp(milliseconds, 0, 60);
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
      maxWidth: Math.max(150, Math.min(460, panelBounds.right - cardBounds.left - 12)),
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

  const addLandingAtCurrentTime = () => {
    const time = clamp(currentTimeRef.current, 0, result.duration);
    const nearest = result.notes.reduce<MelodyNote | undefined>((best, note) => {
      if (!best) return note;
      return Math.abs(note.time - time) < Math.abs(best.time - time) ? note : best;
    }, undefined);
    const manualNote: MelodyNote = {
      time,
      duration: 0.34,
      pitch: nearest?.pitch ?? 60,
      confidence: 1,
      velocity: 1,
      source: "manual",
    };
    const notes = [...result.notes.filter((note) => Math.abs(note.time - time) > 0.08), manualNote]
      .sort((a, b) => a.time - b.time);
    setResult({ ...result, notes });
    setSelectedNoteIndex(notes.indexOf(manualNote));
    setHasOfficialScore(false);
    setStage(`已在 ${formatTime(time)} 加入手动重音落点`);
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
    const notes = result.notes.filter((_, index) => index !== nearestIndex);
    setResult({ ...result, notes });
    setSelectedNoteIndex(null);
    setStage(`已删除 ${formatTime(time)} 附近的落点`);
  };

  const seekFromTimeline = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const fraction = clamp((event.clientX - bounds.left) / Math.max(1, bounds.width), 0, 1);
    seek(fraction * result.duration);
  };

  const selectFromDebugTimeline = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const fraction = clamp((event.clientX - bounds.left) / Math.max(1, bounds.width), 0, 1);
    const range = debugTimeRange(currentTimeRef.current, result.duration, debugWindowSeconds);
    const target = range.start + fraction * (range.end - range.start);
    let nearestIndex = -1;
    let nearestDistance = Number.POSITIVE_INFINITY;
    result.notes.forEach((note, index) => {
      const distance = Math.abs(note.time - target);
      if (distance < nearestDistance) {
        nearestIndex = index;
        nearestDistance = distance;
      }
    });
    seek(target);
    const nearestPixels = (nearestDistance / Math.max(0.001, range.end - range.start)) * bounds.width;
    setSelectedNoteIndex(nearestPixels <= 18 ? nearestIndex : null);
  };

  const nudgeSelectedNote = (milliseconds: number) => {
    if (selectedNoteIndex === null || !result.notes[selectedNoteIndex]) return;
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
    seek(updated.time);
    setHasOfficialScore(false);
    setStage(`已将选中落点${milliseconds < 0 ? "提前" : "延后"} ${Math.abs(milliseconds)}ms`);
  };

  const deleteSelectedNote = () => {
    if (selectedNoteIndex === null || !result.notes[selectedNoteIndex]) return;
    const removed = result.notes[selectedNoteIndex];
    setResult({ ...result, notes: result.notes.filter((_, index) => index !== selectedNoteIndex) });
    setSelectedNoteIndex(null);
    setHasOfficialScore(false);
    setStage(`已删除 ${formatPreciseTime(removed.time)} 的落点`);
  };

  const applyGlobalOffset = (nextOffsetMs: number) => {
    const next = clamp(nextOffsetMs, -120, 120);
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
    setStage("正在实时生成 9:16 视频");

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
        videoBitsPerSecond: 6_000_000,
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
        await exportAudio.play();
        const progressTimer = window.setInterval(() => {
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
      exportAudioRef.current?.pause();
      exportAudioRef.current = null;
      await audioContext?.close();
      setExporting(false);
      setExportProgress(0);
      setCurrentTime(0);
    }
  };

  const selectedNote = selectedNoteIndex === null ? null : result.notes[selectedNoteIndex] ?? null;
  const modelOnlyCount = result.notes.filter((note) => note.source === "model").length;
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

  const toggleModelPoints = () => {
    const nextMuted = !modelPointsMuted;
    setModelPointsMuted(nextMuted);
    notesRef.current = nextMuted ? result.notes.filter((note) => note.source !== "model") : result.notes;
    setStage(nextMuted
      ? `已屏蔽 ${modelOnlyCount} 个红色模型独立补点，播放和导出都不会再踩这些点`
      : `已恢复 ${modelOnlyCount} 个红色模型独立补点，可继续对比试听`);
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
            onChange={(event) => event.target.files && handleFiles(event.target.files)}
          />

          <div className="music-fit-guide" aria-label="适用音乐类型说明">
            <div><b>上传前先看</b><span>开源版适用范围</span></div>
            <p><strong>推荐：</strong>钢琴独奏、单音旋律清楚、触键明确、混响较少的录音；快速钢琴也支持，但建议使用慢动作复核。</p>
            <p><strong>暂不建议：</strong>人声、鼓、弦乐或笛声大量叠加，复杂齐奏、现场噪声和强混响音乐。</p>
            <small>请仅上传你拥有使用权的音乐。音频只在当前浏览器本地解析，不会上传或保存。</small>
          </div>

          <div className={`analysis-status status-${status}`}>
            <div className="analysis-copy">
              <span>{status === "analyzing" ? "旋律分析中" : fileName}</span>
              <b>{Math.round(progress * 100)}%</b>
            </div>
            <div className="analysis-track"><span style={{ width: `${progress * 100}%` }} /></div>
            <p>{stage}</p>
          </div>

          <div className="sample-header">
            <span>免费测试样本</span>
            <small>点击即解析</small>
          </div>
          <div className="sample-list">
            {SAMPLE_TRACKS.map((sample, index) => (
              <button
                type="button"
                className={`sample-row sample-${sample.accent}`}
                key={sample.url}
                onClick={() => void loadSample(sample)}
                disabled={status === "analyzing"}
              >
                <span className="sample-index">0{index + 1}</span>
                <span className="sample-copy"><b>{sample.name}</b><small>{sample.description}</small></span>
                <span className="sample-play" aria-hidden="true">▶</span>
              </button>
            ))}
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
            <button type="button" className="play-button" onClick={() => void togglePlay()} aria-label={playing ? "暂停" : "播放"}>
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
          </div>
          <audio
            ref={audioRef}
            src={audioUrl || undefined}
            preload="metadata"
            onPlay={() => {
              setPlaying(true);
              setStage(`正在${debugPlaybackRate < 1 ? `${debugPlaybackRate}× 慢放` : "播放"} · ${activeNotes.length} 个同步落点${modelPointsMuted ? " · 红色补点已屏蔽" : ""}`);
            }}
            onPause={() => setPlaying(false)}
            onEnded={() => {
              setPlaying(false);
              currentTimeRef.current = result.duration;
              setCurrentTime(result.duration);
            }}
          />
        </section>

        <aside className="control-panel style-panel">
          <div className="section-heading compact">
            <span>02</span>
            <div>
              <h2>设计成片</h2>
              <p>所有调整会立即更新预览</p>
            </div>
          </div>

          <div className="setting-group analysis-controls">
            <div className="setting-title"><span>钢琴触键解析</span><small>默认捕捉快速钢琴起音</small></div>
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
          </div>

          <div className="setting-group">
            <div className="setting-title"><span>琴片信息</span><small>解决小字看不清</small></div>
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
          </div>

          <div className="setting-group">
            <div className="setting-title"><span>撞击特效</span><small>让每次落点更有激情</small></div>
            <div className="segmented-control">
              {([
                ["cartoon", "卡通爆发"],
                ["firework", "烟花派对"],
                ["neon", "霓虹冲击"],
              ] as [ImpactEffect, string][]).map(([value, label]) => (
                <button key={value} type="button" className={impactEffect === value ? "active" : ""} onClick={() => setImpactEffect(value)}>
                  {label}
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
          </div>

          <div className="setting-group">
            <div className="setting-title"><span>宇宙场景</span><small>选择颜色氛围</small></div>
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
          </div>

          <div className="setting-group">
            <div className="setting-title"><span>流星密度</span><b>{meteorIntensity}%</b></div>
            <input
              className="accent-range"
              aria-label="流星密度"
              type="range"
              min={0}
              max={100}
              value={meteorIntensity}
              onChange={(event) => setMeteorIntensity(Number(event.target.value))}
            />
            <div className="range-labels"><span>宁静</span><span>炫酷</span></div>
          </div>

          <div className="melody-map">
            <div className="setting-title"><span>全曲旋律轨迹</span><small>{result.notes.length} 个落点 · 点击定位</small></div>
            <canvas
              ref={timelineCanvasRef}
              className="melody-timeline"
              width={600}
              height={190}
              role="slider"
              tabIndex={0}
              aria-label="全曲旋律轨迹，点击可定位播放位置"
              aria-valuemin={0}
              aria-valuemax={Math.round(result.duration)}
              aria-valuenow={Math.round(currentTime)}
              onClick={seekFromTimeline}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight") seek(currentTime + 1);
                if (event.key === "ArrowLeft") seek(currentTime - 1);
              }}
            />
            <div className="timeline-legend">
              <span><i className="legend-auto" /> 自动落点</span>
              <span><i className="legend-manual" /> 手动校准</span>
              <b>{formatTime(currentTime)}</b>
            </div>
            <div className="manual-calibration">
              <button type="button" onClick={addLandingAtCurrentTime} disabled={!audioUrl || status === "analyzing"}>＋ 当前时间加落点</button>
              <button type="button" onClick={removeNearestLanding} disabled={!audioUrl || status === "analyzing"}>－ 删除附近落点</button>
            </div>
            <p className="calibration-tip">钢琴重音漏掉时：在轨迹图定位，试听到触键瞬间后暂停，再补一个落点。</p>
          </div>

          <div className="export-block">
            <button type="button" className="export-button" onClick={() => void exportVideo()} disabled={!audioUrl || status === "analyzing" || exporting}>
              <span aria-hidden="true">{exporting ? "◌" : "↓"}</span>
              <div><b>{exporting ? `正在生成 ${Math.round(exportProgress * 100)}%` : "导出 9:16 视频"}</b><small>{exporting ? "请保持页面打开" : "优先 MP4，自动兼容 WebM"}</small></div>
            </button>
            <p>视频实时合成，导出时会播放一遍完整音乐。</p>
          </div>
        </aside>
      </div>

      {audioUrl && (
        <section
          ref={debugConsoleRef}
          className={`debug-console ${debugOpen ? "is-open" : ""} ${debugExpanded ? "is-expanded" : ""}`}
          aria-label="算法调试面板"
        >
          <div className="debug-console-heading">
            <div className="debug-title">
              <span>03</span>
              <div>
                <h2>算法调试面板</h2>
                <p>对照波形、频谱起音和模型候选，人工确认哪些点该留、该删或需要毫秒级校准。</p>
              </div>
            </div>
            <div className="debug-summary-chips">
              <span>{result.diagnostics?.profile === "score" ? "基准谱面" : "频谱"} {result.diagnostics?.spectralCount ?? result.notes.length}</span>
              <span className={modelPointsMuted ? "is-muted" : ""}>模型补点 {modelOnlyCount}{modelPointsMuted ? " · 已屏蔽" : ""}</span>
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
                setDebugOpen(true);
                setDebugExpanded((value) => !value);
              }}>
                {debugExpanded ? "退出放大" : "单独放大轨道"}
              </button>
              <button type="button" className="debug-toggle" onClick={() => setDebugOpen((value) => !value)}>
                {debugOpen ? "收起调试轨道" : "展开调试轨道"}
              </button>
            </div>
          </div>

          {debugOpen && debugPreviewOpen && (
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
                  setDebugPreviewWidth(188);
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

          {debugOpen && (
            <div className="debug-console-body">
              <div className="debug-track-column">
                <div className="debug-track-toolbar">
                  <div className="debug-track-toolbar-left">
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
                        max={60}
                        step={2}
                        value={visualSyncMs}
                        onChange={(event) => changeVisualSync(Number(event.target.value))}
                        aria-label="动画画面提前补偿毫秒数"
                      />
                      <b>提前 {visualSyncMs}ms</b>
                    </label>
                    <button
                      type="button"
                      className={`model-mute-toggle ${modelPointsMuted ? "is-muted" : ""}`}
                      aria-pressed={modelPointsMuted}
                      onClick={toggleModelPoints}
                      disabled={modelOnlyCount === 0}
                    >
                      {modelPointsMuted ? "恢复红色补点" : "屏蔽红色补点"}
                    </button>
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
                  aria-label="局部算法调试轨道，点击可选择附近音符并定位"
                  aria-valuemin={0}
                  aria-valuemax={Math.round(result.duration * 1_000)}
                  aria-valuenow={Math.round(currentTime * 1_000)}
                  onClick={selectFromDebugTimeline}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowRight") seek(currentTime + 0.01);
                    if (event.key === "ArrowLeft") seek(currentTime - 0.01);
                  }}
                />
                <div className="debug-legend">
                  <span><i className="debug-wave" /> 音频波形</span>
                  <span><i className="debug-spectral" /> 频谱起音</span>
                  <span className={modelPointsMuted ? "is-muted" : ""}><i className="debug-model" /> 模型独立补点{modelPointsMuted ? "（已屏蔽）" : ""}</span>
                  <span><i className="debug-manual" /> 人工/谱面</span>
                  <span><i className="debug-filtered" /> 被过滤候选</span>
                </div>
                <p className="debug-slow-tip">慢动作会同时降低音乐和动画速度，不改变时间轴落点；建议用 0.25× 检查“音符识别不准”，用 0.5× 检查“小球是否落在正确时刻”。</p>
                <div className="debug-explain-grid">
                  <div className="explain-model"><b>红色模型补点是什么？</b><p>钢琴模型听到了触键，但绿色频谱轨道没有命中，于是系统额外加一个弹跳。屏蔽后，这些红点仍留在图上供对照，但不会参与播放或导出。</p></div>
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
                      className={`${selectedNoteIndex === index ? "active" : ""} ${modelPointsMuted && note.source === "model" ? "is-muted" : ""}`}
                      onClick={() => {
                        setSelectedNoteIndex(index);
                        seek(note.time);
                      }}
                    >
                      <strong>{noteName(note.pitch)}</strong>
                      <span>{formatPreciseTime(note.time)}</span>
                      <small>{onsetEvidenceText(note)}{modelPointsMuted && note.source === "model" ? " · 已屏蔽" : ""}</small>
                      <i>强度 {Math.round(note.velocity * 100)}%</i>
                    </button>
                  ))}
                </div>
              </div>

              <aside className="debug-inspector">
                <div className="debug-inspector-title">
                  <span>当前选中落点</span>
                  <b>{selectedNote ? formatPreciseTime(selectedNote.time) : "点击轨道选点"}</b>
                </div>
                <div className="debug-note-card">
                  <div><small>音名</small><b>{selectedNote ? noteName(selectedNote.pitch) : "—"}</b></div>
                  <div><small>来源</small><b>{selectedNote ? sourceText(selectedNote.source) : "—"}</b></div>
                  <div><small>音高置信度</small><b>{selectedNote ? `${Math.round(selectedNote.confidence * 100)}%` : "—"}</b></div>
                  <div><small>触键强度</small><b>{selectedNote ? `${Math.round(selectedNote.velocity * 100)}%` : "—"}</b></div>
                  <div><small>踩点依据</small><b>{selectedNote ? onsetEvidenceText(selectedNote) : "—"}</b></div>
                  <div><small>模型支持度</small><b>{selectedNote?.modelConfidence ? `${Math.round(selectedNote.modelConfidence * 100)}%` : "无模型确认"}</b></div>
                  <div><small>距播放头</small><b>{selectedNote ? `${Math.round((selectedNote.time - currentTime) * 1_000)}ms` : "—"}</b></div>
                </div>

                <div className="debug-control-label"><span>选中点微调</span><small>处理前后几毫秒偏差</small></div>
                <div className="nudge-grid">
                  {[-50, -10, 10, 50].map((milliseconds) => (
                    <button key={milliseconds} type="button" disabled={!selectedNote} onClick={() => nudgeSelectedNote(milliseconds)}>
                      {milliseconds > 0 ? "+" : ""}{milliseconds}ms
                    </button>
                  ))}
                </div>

                <div className="debug-control-label"><span>整条轨道偏移</span><b>{timingOffsetMs > 0 ? "+" : ""}{timingOffsetMs}ms</b></div>
                <input
                  className="debug-offset-range"
                  aria-label="整条音符轨道时间偏移"
                  type="range"
                  min={-120}
                  max={120}
                  step={5}
                  value={timingOffsetMs}
                  onChange={(event) => applyGlobalOffset(Number(event.target.value))}
                />
                <div className="debug-offset-labels"><span>整体提前</span><button type="button" onClick={() => applyGlobalOffset(0)}>归零</button><span>整体延后</span></div>

                <div className="debug-actions">
                  <button type="button" onClick={addLandingAtCurrentTime}>＋ 播放头补点</button>
                  <button type="button" onClick={deleteSelectedNote} disabled={!selectedNote}>－ 删除选中点</button>
                  <button type="button" onClick={exportDebugJson}>导出调试 JSON</button>
                </div>
                <p>“双通道确认”表示频谱起音与音符模型同时命中，最接近可信触键；“仅频谱起音”更容易被笛声或杂乱音讯干扰。发现漏点可暂停补点，多余点可选中删除。</p>
              </aside>
            </div>
          )}
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
  modelPointsMuted: boolean,
) {
  const range = debugTimeRange(currentTime, result.duration, windowSeconds);
  const left = 72;
  const right = 24;
  const plotWidth = width - left - right;
  const xFor = (time: number) => left + ((time - range.start) / Math.max(0.001, range.end - range.start)) * plotWidth;
  context.clearRect(0, 0, width, height);
  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#070b19");
  background.addColorStop(1, "#160a21");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  const rangeDuration = range.end - range.start;
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
  const noteTop = 190;
  const filterTop = height - 78;
  const noteBottom = filterTop - 24;
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
  context.fillText("识别音符", 16, noteTop + (noteBottom - noteTop) / 2);
  context.fillText("过滤候选", 16, filterTop + 31);
  context.strokeStyle = "rgba(255,255,255,.08)";
  context.beginPath();
  context.moveTo(left, waveformDivider);
  context.lineTo(width - right, waveformDivider);
  context.moveTo(left, filterTop);
  context.lineTo(width - right, filterTop);
  context.stroke();

  const visibleNotes = result.notes.filter((note) => note.time >= range.start && note.time <= range.end);
  const visibleCandidates = (result.diagnostics?.modelCandidates ?? [])
    .filter((candidate) => candidate.time >= range.start && candidate.time <= range.end);
  const visiblePitches = [...visibleNotes.map((note) => note.pitch), ...visibleCandidates.map((candidate) => candidate.pitch)];
  const minPitch = visiblePitches.length ? Math.min(...visiblePitches) - 2 : 48;
  const maxPitch = visiblePitches.length ? Math.max(...visiblePitches) + 2 : 76;
  const yFor = (pitch: number) => noteBottom - ((pitch - minPitch) / Math.max(1, maxPitch - minPitch)) * (noteBottom - noteTop);

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

  let lastLabelX = -Infinity;
  let labelRow = 0;
  visibleNotes.forEach((note) => {
    const noteIndex = result.notes.indexOf(note);
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
    const endX = xFor(Math.min(range.end, note.time + Math.max(0.04, note.duration)));
    context.globalAlpha = noteIsMuted ? 0.14 : 0.2 + note.confidence * 0.24;
    context.lineWidth = noteIndex === selectedNoteIndex ? 11 : 8;
    context.setLineDash(noteIsMuted ? [5, 5] : []);
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(Math.max(x + 3, endX), y);
    context.stroke();
    context.setLineDash([]);
    context.globalAlpha = noteIsMuted ? 0.24 : 0.34 + note.confidence * 0.58;
    context.lineWidth = noteIndex === selectedNoteIndex ? 3 : 1.6;
    context.beginPath();
    context.moveTo(x, noteBottom + 8);
    context.lineTo(x, y);
    context.stroke();
    context.globalAlpha = 1;
    context.fillStyle = color;
    context.shadowColor = color;
    context.shadowBlur = noteIndex === selectedNoteIndex ? 16 : 5;
    context.beginPath();
    context.arc(x, y, noteIndex === selectedNoteIndex ? 9 : 5.4, 0, Math.PI * 2);
    context.fill();
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
    const shouldLabel = noteIndex === selectedNoteIndex || rangeDuration <= 16 || x - lastLabelX >= 74;
    if (shouldLabel) {
      context.fillStyle = noteIndex === selectedNoteIndex ? "#ffffff" : "rgba(255,255,255,.76)";
      context.font = noteIndex === selectedNoteIndex ? "750 13px ui-monospace, monospace" : "650 11px ui-monospace, monospace";
      context.textAlign = "center";
      const labelY = Math.max(noteTop + 11, y - 12 - (labelRow % 2) * 15);
      context.fillText(`${noteName(note.pitch)} · 强度${Math.round(note.velocity * 100)}${noteIsMuted ? " · 已屏蔽" : ""}`, x, labelY);
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
        context.fillText(`${noteName(candidate.pitch)} ${candidateStatusText(candidate)}`, x, height - 35);
      }
    });

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
      context.fillStyle = manual ? "#ffd75e" : "#72ecff";
      context.shadowColor = manual ? "#ffd75e" : "#55dfff";
      context.shadowBlur = manual ? 12 : 5;
      context.beginPath();
      context.arc(x, y, manual ? 5.2 : 2.2 + note.velocity * 1.9, 0, Math.PI * 2);
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
