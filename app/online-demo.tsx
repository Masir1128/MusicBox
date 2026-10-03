"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MelodyNote } from "../lib/melodyAnalyzer";
import { publicAsset } from "../lib/publicAsset";
import {
  renderMusicBox,
  type LayoutTemplate,
  type VisualStyle,
} from "../lib/renderMusicBox";

type DemoTrack = {
  name: string;
  description: string;
  audio: string;
  score: string;
};

type DemoScore = {
  bpm: number;
  lead_in_seconds: number;
  notes: Array<{ pitch: number; beat: number; duration: number }>;
};

const DEMO_TRACKS: readonly DemoTrack[] = [
  {
    name: "星光八音盒",
    description: "舒缓钢琴 · 14 个精准落点",
    audio: publicAsset("/samples/starlight.mp3"),
    score: publicAsset("/samples/starlight.json"),
  },
  {
    name: "霓虹疾跑",
    description: "快速节奏 · 连续弹跳",
    audio: publicAsset("/samples/neon-run.mp3"),
    score: publicAsset("/samples/neon-run.json"),
  },
  {
    name: "月面漂流",
    description: "空灵旋律 · 长音组合",
    audio: publicAsset("/samples/moon-drift.mp3"),
    score: publicAsset("/samples/moon-drift.json"),
  },
];

const LAYOUTS: ReadonlyArray<{ value: LayoutTemplate; label: string; detail: string }> = [
  { value: "square-maze", label: "方块迷宫", detail: "轻量拖尾" },
  { value: "orbit", label: "星轨弹跳", detail: "经典版式" },
  { value: "kinetic", label: "机械悬浮", detail: "滚落琴片" },
];

const DEFAULT_SCORE: DemoScore = {
  bpm: 112,
  lead_in_seconds: 0.6,
  notes: [
    { pitch: 60, beat: 0, duration: 1 },
    { pitch: 60, beat: 1, duration: 1 },
    { pitch: 67, beat: 2, duration: 1 },
    { pitch: 67, beat: 3, duration: 1 },
    { pitch: 69, beat: 4, duration: 1 },
    { pitch: 69, beat: 5, duration: 1 },
    { pitch: 67, beat: 6, duration: 2 },
    { pitch: 65, beat: 8, duration: 1 },
    { pitch: 65, beat: 9, duration: 1 },
    { pitch: 64, beat: 10, duration: 1 },
    { pitch: 64, beat: 11, duration: 1 },
    { pitch: 62, beat: 12, duration: 1 },
    { pitch: 62, beat: 13, duration: 1 },
    { pitch: 60, beat: 14, duration: 2 },
  ],
};

const LIGHTWEIGHT_STYLE: VisualStyle = {
  layoutTemplate: "square-maze",
  labelMode: "solfege",
  theme: "nebula",
  meteorIntensity: 38,
  impactEffect: "lightning",
  impactIntensity: 70,
  ballSize: 92,
  showSceneText: true,
  showBranding: true,
  mazeSkin: "crimson",
  mazeCustomSkinUrl: "",
  mazeCustomVideoUrl: "",
  squareColorMode: "rainbow",
  mazeSquareColor: "#ff5ccf",
  mazeShape: "square",
  mazeObjectSize: 42,
  mazeEdgeColor: "#65eaff",
  mazeTrailColor: "#ff5ccf",
  mazeTrailStyle: "meteor",
  mazeStrokeWidth: 2,
  mazeGlowIntensity: 28,
  mazeFillMode: "half",
  mazeImpactEffect: "vfx-star",
  mazeTrailLength: 150,
  mazeTrailWidth: 14,
  mazeEffectBpm: 120,
  mazeEffectIntensity: 72,
  mazeBloom: false,
  mazeShake: true,
  mazeHitstop: false,
  mazeBackgroundGrid: false,
};

function notesFromScore(score: DemoScore) {
  const secondsPerBeat = 60 / score.bpm;
  return score.notes.map<MelodyNote>((note) => ({
    time: score.lead_in_seconds + note.beat * secondsPerBeat,
    duration: Math.max(0.12, note.duration * secondsPerBeat),
    pitch: note.pitch,
    confidence: 1,
    velocity: 0.92,
    source: "score",
  }));
}

const DEFAULT_NOTES = notesFromScore(DEFAULT_SCORE);

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds || 0);
  return `${Math.floor(safe / 60)}:${Math.floor(safe % 60).toString().padStart(2, "0")}`;
}

export default function OnlineDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const animationRef = useRef<number | null>(null);
  const lastUiUpdateRef = useRef(0);
  const [selectedTrack, setSelectedTrack] = useState(0);
  const [audioSource, setAudioSource] = useState(DEMO_TRACKS[0].audio);
  const [notes, setNotes] = useState<MelodyNote[]>(DEFAULT_NOTES);
  const [duration, setDuration] = useState(9.52);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [layoutTemplate, setLayoutTemplate] = useState<LayoutTemplate>("square-maze");

  const visualStyle = useMemo(
    () => ({ ...LIGHTWEIGHT_STYLE, layoutTemplate }),
    [layoutTemplate],
  );

  const drawFrame = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const scale = canvas.width / 540;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    renderMusicBox(context, 540, 960, time, notes, duration, visualStyle);
    context.setTransform(1, 0, 0, 1, 0, 0);
  }, [duration, notes, visualStyle]);

  const loadTrack = useCallback(async (index: number) => {
    const track = DEMO_TRACKS[index];
    const audio = audioRef.current;
    audio?.pause();
    setPlaying(false);
    setLoading(true);
    setSelectedTrack(index);
    setCurrentTime(0);
    setAudioSource(track.audio);
    try {
      const response = await fetch(track.score);
      if (!response.ok) throw new Error("score unavailable");
      const score = await response.json() as DemoScore;
      const nextNotes = notesFromScore(score);
      setNotes(nextNotes);
      const last = nextNotes.at(-1);
      setDuration(last ? last.time + last.duration + 0.35 : 9);
    } catch (error) {
      console.error(error);
      setNotes(DEFAULT_NOTES);
      setDuration(9);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!playing) drawFrame(currentTime);
  }, [currentTime, drawFrame, playing]);

  useEffect(() => {
    if (!playing) return;
    const tick = (timestamp: number) => {
      const audio = audioRef.current;
      if (!audio || audio.paused) return;
      drawFrame(audio.currentTime);
      if (timestamp - lastUiUpdateRef.current > 100) {
        setCurrentTime(audio.currentTime);
        lastUiUpdateRef.current = timestamp;
      }
      animationRef.current = window.requestAnimationFrame(tick);
    };
    animationRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (animationRef.current) window.cancelAnimationFrame(animationRef.current);
    };
  }, [drawFrame, playing]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || loading) return;
    if (audio.paused) {
      if (audio.currentTime >= duration - 0.05) audio.currentTime = 0;
      await audio.play();
      setPlaying(true);
    } else {
      audio.pause();
      setCurrentTime(audio.currentTime);
      setPlaying(false);
    }
  };

  const seek = (time: number) => {
    const next = Math.max(0, Math.min(duration, time));
    if (audioRef.current) audioRef.current.currentTime = next;
    setCurrentTime(next);
    drawFrame(next);
  };

  return (
    <main className="online-demo-shell">
      <header className="online-demo-header">
        <a className="online-demo-brand" href="https://github.com/Masir1128/MusicBox" target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={publicAsset("/kexueyang.jpg")} alt="科学羊 Logo" width={42} height={42} />
          <span><b>ORBITONE</b><small>星轨音乐盒</small></span>
        </a>
        <span className="online-demo-badge">ONLINE PLAYGROUND · 轻量试玩</span>
        <a className="online-demo-source-link" href="https://github.com/Masir1128/MusicBox" target="_blank" rel="noreferrer">完整源码 ↗</a>
      </header>

      <section className="online-demo-hero">
        <div className="online-demo-copy">
          <span className="online-demo-eyebrow">BROWSER-LOCAL MUSIC VISUALIZER</span>
          <h1>先流畅体验，<br />再在本地完整创作。</h1>
          <p>在线版只保留三首原创样本和三种核心动画，确保访客第一次打开就能顺畅试玩。音乐导入、钢琴触键识别、算法调试、逐歌曲配置、视频背景和高清导出均保留在开源本地版。</p>
          <div className="online-demo-points" aria-label="在线试玩说明">
            <span><b>01</b> 无需上传文件</span>
            <span><b>02</b> 轻量实时渲染</span>
            <span><b>03</b> 音乐不离开浏览器</span>
          </div>
        </div>

        <div className="online-demo-stage">
          <div className="online-demo-phone">
            <canvas ref={canvasRef} width={360} height={640} aria-label="ORBITONE 在线轻量动画预览" />
          </div>
          <div className="online-demo-transport">
            <button type="button" onClick={() => void togglePlay()} disabled={loading} aria-label={playing ? "暂停试玩" : "播放试玩"}>
              {playing ? "Ⅱ" : "▶"}
            </button>
            <span>{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={Math.max(0.1, duration)}
              step={0.01}
              value={Math.min(currentTime, duration)}
              onChange={(event) => seek(Number(event.target.value))}
              aria-label="试玩播放进度"
            />
            <span>{formatTime(duration)}</span>
          </div>
          <audio
            ref={audioRef}
            src={audioSource}
            preload="metadata"
            onLoadedMetadata={(event) => {
              if (Number.isFinite(event.currentTarget.duration)) setDuration(event.currentTarget.duration);
            }}
            onEnded={() => {
              setPlaying(false);
              setCurrentTime(0);
            }}
          />
        </div>

        <aside className="online-demo-controls" aria-label="在线试玩控制">
          <div className="online-demo-control-heading"><span>01</span><div><b>选择样本</b><small>三首原创音乐</small></div></div>
          <div className="online-demo-track-list">
            {DEMO_TRACKS.map((track, index) => (
              <button key={track.name} type="button" className={selectedTrack === index ? "is-active" : ""} onClick={() => void loadTrack(index)}>
                <span>{String(index + 1).padStart(2, "0")}</span><div><b>{track.name}</b><small>{track.description}</small></div>
              </button>
            ))}
          </div>

          <div className="online-demo-control-heading"><span>02</span><div><b>切换动画</b><small>全部采用流畅配置</small></div></div>
          <div className="online-demo-layout-list">
            {LAYOUTS.map((layout) => (
              <button key={layout.value} type="button" className={layoutTemplate === layout.value ? "is-active" : ""} onClick={() => setLayoutTemplate(layout.value)}>
                <i aria-hidden="true" /><b>{layout.label}</b><small>{layout.detail}</small>
              </button>
            ))}
          </div>

          <div className="online-demo-local-card">
            <span>FULL CREATOR STUDIO</span>
            <b>完整功能请在本地运行</b>
            <p>这是一个高强度 Canvas、音频分析与视频导出项目。本地部署能获得完整功能和更稳定的性能。</p>
            <a href="https://github.com/Masir1128/MusicBox#本地运行" target="_blank" rel="noreferrer">查看本地部署说明 ↗</a>
          </div>
        </aside>
      </section>

      <section className="online-demo-full-features" aria-labelledby="online-full-title">
        <div><span>完整开源版</span><h2 id="online-full-title">在线展示核心体验，本地释放完整工作台。</h2></div>
        <ul>
          <li><b>音乐分析</b><span>导入本地音乐、钢琴触键识别与人工补点</span></li>
          <li><b>逐歌配置</b><span>每首歌独立保存谱面、动画参数和视频背景</span></li>
          <li><b>专业调试</b><span>波形时间轴、毫秒校准、撤回和缩放编辑</span></li>
          <li><b>成片导出</b><span>逐帧高清 MP4、PNG 与可编辑配置文件</span></li>
        </ul>
        <a href="https://github.com/Masir1128/MusicBox" target="_blank" rel="noreferrer">在 GitHub 查看完整截图与源码</a>
      </section>
    </main>
  );
}
