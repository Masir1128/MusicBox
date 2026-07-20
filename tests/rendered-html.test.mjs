import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the finished Orbitone creator studio", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>ORBITONE 星轨音乐盒<\/title>/i);
  assert.match(html, /科学羊 Logo/);
  assert.match(html, /开发者：/);
  assert.match(html, /来源：科学羊原创实验项目/);
  assert.match(html, /点击上传或拖入音乐/);
  assert.match(html, /9:16 成片预览/);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview/);
});

test("keeps long-track and playback fixes in the product source", async () => {
  const [page, analyzer, pianoAnalyzer, renderer] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/melodyAnalyzer.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/pianoOnsetAnalyzer.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/renderMusicBox.ts", import.meta.url), "utf8"),
  ]);

  assert.match(analyzer, /const MAX_SECONDS = 240/);
  assert.match(analyzer, /const TARGET_RATE = 12_000/);
  assert.match(analyzer, /const ANALYSIS_HOP = 128/);
  assert.match(analyzer, /const MAX_NOTES = 1_600/);
  assert.match(analyzer, /localMedian/);
  assert.match(analyzer, /previousLogSpectrum/);
  assert.match(analyzer, /export type AnalysisProfile = "balanced" \| "piano" \| "rhythm"/);
  assert.match(analyzer, /pianoFlux/);
  assert.match(analyzer, /laggedLogSpectra/);
  assert.match(analyzer, /frame\.novelty >= noveltyFloor/);
  assert.match(analyzer, /export type AnalysisDiagnostics/);
  assert.match(analyzer, /source: "spectral"/);
  assert.match(analyzer, /thinByStrength/);
  assert.match(analyzer, /densePianoMode/);
  assert.match(analyzer, /strongPianoDensity >= 3\.2/);
  assert.match(analyzer, /全曲弹跳轨迹已生成/);
  assert.match(pianoAnalyzer, /BasicPitch/);
  assert.match(pianoAnalyzer, /pickModelOnsets/);
  assert.match(pianoAnalyzer, /never insert another model-only hit of the same/);
  assert.match(pianoAnalyzer, /refinePianoOnsets/);
  assert.match(pianoAnalyzer, /candidateStatus/);
  assert.match(pianoAnalyzer, /source: "model"/);
  assert.match(page, /钢琴重音/);
  assert.match(page, /scoreUrl: "\/samples\/starlight\.json"/);
  assert.match(page, /analysisFromSampleScore/);
  assert.match(page, /官方样本已精准对齐/);
  assert.match(page, /算法调试面板/);
  assert.match(page, /整条音符轨道时间偏移/);
  assert.match(page, /导出踩点调试 JSON/);
  assert.match(page, /单独放大轨道/);
  assert.match(page, /双通道确认/);
  assert.match(page, /当前窗口落点清单/);
  assert.match(page, /屏蔽红色补点/);
  assert.match(page, /modelPointsMuted/);
  assert.match(page, /9:16 同步预览/);
  assert.match(page, /beginDebugPreviewDrag/);
  assert.match(page, /beginDebugPreviewResize/);
  assert.match(page, /debugPreviewWidth/);
  assert.match(page, /拖动调整 9:16 预览大小/);
  assert.match(page, /prepareHiDpiCanvas/);
  assert.match(page, /被过滤候选是什么/);
  assert.match(page, /慢动作联调播放速度/);
  assert.match(page, /debugPlaybackRate/);
  assert.match(page, /visualSyncMsRef/);
  assert.match(page, /动画画面提前补偿毫秒数/);
  assert.match(page, /debugPreviewContext\.drawImage\(canvas/);
  assert.match(page, /上传前先看/);
  assert.match(page, /请仅上传你拥有使用权的音乐/);
  assert.match(page, /seconds === 0 \? "全曲"/);
  assert.match(page, /原创流行 · 快速钢琴/);
  assert.match(page, /全曲旋律轨迹/);
  assert.match(page, /当前时间加落点/);
  assert.match(page, /用当前模式重新解析/);
  assert.match(page, /卡通爆发/);
  assert.match(page, /烟花派对/);
  assert.match(renderer, /drawImpactEffects/);
  assert.match(renderer, /inertialTrackValue/);
  assert.match(renderer, /Binary search keeps dense full-speed playback stable/);
  assert.match(renderer, /effectLifetime/);
  assert.match(renderer, /trailCount = currentGap < 0\.18 \? 4 : 7/);
  assert.match(renderer, /trackTangent/);
  assert.match(renderer, /shape-preserving harmonic tangent/);
  assert.match(renderer, /ImpactEffect = "firework" \| "cartoon" \| "neon"/);
  assert.doesNotMatch(renderer, /砰！|⭐|🚀/);
  assert.match(page, /currentTimeRef/);
  assert.match(page, /来源：科学羊原创实验项目/);
});

test("ships the requested logo and social preview", async () => {
  const logo = new URL("../public/kexueyang.jpg", import.meta.url);
  const social = new URL("../public/og.png", import.meta.url);
  const model = new URL("../public/models/basic-pitch/model.json", import.meta.url);
  const weights = new URL("../public/models/basic-pitch/group1-shard1of1.bin", import.meta.url);
  await Promise.all([access(logo), access(social), access(model), access(weights)]);
  const [logoStat, socialStat, modelStat, weightsStat] = await Promise.all([
    stat(logo),
    stat(social),
    stat(model),
    stat(weights),
  ]);
  assert.ok(logoStat.size > 5_000);
  assert.ok(socialStat.size > 100_000);
  assert.ok(modelStat.size > 100_000);
  assert.ok(weightsStat.size > 500_000);
});

test("ships eight playable score-backed samples", async () => {
  const sampleIds = [
    "starlight",
    "neon-run",
    "moon-drift",
    "summer-hook",
    "city-heartbeat",
    "rain-confession",
    "rapid-star-keys",
    "immortal-echo",
  ];
  for (const id of sampleIds) {
    const json = new URL(`../public/samples/${id}.json`, import.meta.url);
    const mp3 = new URL(`../public/samples/${id}.mp3`, import.meta.url);
    const [score, audioStat] = await Promise.all([
      readFile(json, "utf8").then(JSON.parse),
      stat(mp3),
    ]);
    assert.ok(score.bpm > 0, `${id} has a BPM`);
    assert.ok(score.notes.length >= 10, `${id} has enough score notes`);
    assert.ok(score.notes.every((note) => Number.isFinite(note.pitch) && Number.isFinite(note.beat)));
    assert.ok(audioStat.size > 10_000, `${id} has playable audio`);
  }
});
