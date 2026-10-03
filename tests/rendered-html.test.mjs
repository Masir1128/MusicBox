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
  const [page, styles, analyzer, pianoAnalyzer, synthPiano, localMusicLibrary, creatorSettings, renderer, kineticRenderer, squareMazeRenderer, universalImpactRenderer] = await Promise.all([
    readFile(new URL("../app/creator-studio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../lib/melodyAnalyzer.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/pianoOnsetAnalyzer.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/synthPiano.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/localMusicLibrary.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/creatorSettings.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/renderMusicBox.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/renderKineticMusicBox.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/renderSquareMazeMusicBox.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/drawUniversalImpactEffect.ts", import.meta.url), "utf8"),
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
  assert.doesNotMatch(analyzer, /densePianoMode/);
  assert.match(analyzer, /const supportPulses = selectPulseFrames/);
  assert.match(analyzer, /sensitivity: Math\.min\(options\.sensitivity, 0\.82\)/);
  assert.match(analyzer, /const minimumGapFloor = options\.profile === "piano" \? 0\.052 : 0\.07/);
  assert.match(analyzer, /followUpGap > 0\.18/);
  assert.match(analyzer, /adaptiveFlux\[index\] >= adaptiveFloor \* 0\.72/);
  assert.match(analyzer, /frame\.novelty >= noveltyFloor \* 0\.32/);
  assert.match(analyzer, /mergeNearbyFrames\(\[\.\.\.pulses, \.\.\.supportPulses\], 0\.052\)/);
  assert.match(analyzer, /全曲弹跳轨迹已生成/);
  assert.match(pianoAnalyzer, /BasicPitch/);
  assert.match(pianoAnalyzer, /pickModelOnsets/);
  assert.match(pianoAnalyzer, /never insert another model-only hit of the same/);
  assert.match(pianoAnalyzer, /refinePianoOnsets/);
  assert.match(pianoAnalyzer, /candidateStatus/);
  assert.match(pianoAnalyzer, /source: "model"/);
  assert.match(page, /钢琴重音/);
  assert.doesNotMatch(page, /square-maze-reference/);
  assert.match(page, /useState<LayoutTemplate>\("square-maze"\)/);
  assert.match(page, /analysisFromSampleScore/);
  assert.match(page, /官方样本已精准对齐/);
  assert.match(page, /算法调试面板/);
  assert.match(page, /整条音符轨道时间偏移/);
  assert.match(page, /导出踩点调试 JSON/);
  assert.match(page, /单独放大轨道/);
  assert.match(page, /双通道确认/);
  assert.match(page, /当前窗口落点清单/);
  assert.doesNotMatch(page, />屏蔽红色补点</);
  assert.match(page, /withoutModelOnlyNotes/);
  assert.match(page, /9:16 同步预览/);
  assert.match(page, /beginDebugPreviewDrag/);
  assert.match(page, /beginDebugPreviewResize/);
  assert.match(page, /debugPreviewWidth/);
  assert.match(page, /DEFAULT_DEBUG_PREVIEW_WIDTH = 420/);
  assert.match(page, /MAX_DEBUG_PREVIEW_WIDTH = 500/);
  assert.match(styles, /\.debug-preview-float \{[\s\S]*?width: 560px;[\s\S]*?max-width: min\(640px, calc\(100% - 24px\)\)/);
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
  assert.match(page, /自定义弹跳谱面/);
  assert.match(page, /当前时间加落点/);
  assert.match(page, /输入秒数：1, 5, 8, 12/);
  assert.match(page, /beginTimelineEdit/);
  assert.match(page, /dragTimelineNote/);
  assert.match(page, /beginDebugNoteEdit/);
  assert.match(page, /moveDebugNote/);
  assert.match(page, /debugEditorGeometry/);
  assert.match(page, /选择\/框选/);
  assert.match(page, /绘制触发点/);
  assert.match(page, /删除触发点/);
  assert.match(page, /时间吸附/);
  assert.match(page, /精确时间（秒）/);
  assert.match(page, /音符长度（秒）/);
  assert.match(page, /试听选中钢琴音/);
  assert.match(page, /\["Escape", "Backspace", "Delete"\]/);
  assert.match(page, /debugMarqueeDragRef/);
  assert.match(page, /notesInsideDebugSelection/);
  assert.match(page, /已批量删除/);
  assert.match(page, /MANUAL_TRIGGER_DEDUPE_SECONDS = 0\.018/);
  assert.match(page, /补充砖块并显示碰撞预览/);
  assert.match(page, /previewLandingCollision/);
  assert.match(page, /time - visualSyncMsRef\.current \/ 1_000 \+ 0\.035/);
  assert.match(page, /debugUndoStackRef/);
  assert.match(page, /undoDebugEdit/);
  assert.match(page, /↶ 撤回/);
  assert.match(page, /event\.metaKey \|\| event\.ctrlKey/);
  assert.match(page, /onWheel=\{zoomDebugTimelineWithWheel\}/);
  assert.match(page, /changeDebugTimelineZoom/);
  assert.match(page, /鼠标滚轮缩放时间轴/);
  assert.match(page, /砖块触发模式/);
  assert.match(page, /保留原声，只编辑弹跳时间/);
  assert.match(page, /manualEditMode === "trigger"/);
  assert.match(page, /本地音乐库/);
  assert.match(page, /保存当前音乐/);
  assert.match(page, /后续谱面修改会自动写入/);
  assert.match(localMusicLibrary, /orbitone-local-music/);
  assert.match(localMusicLibrary, /indexedDB\.open/);
  assert.match(localMusicLibrary, /audioBlob: Blob/);
  assert.match(localMusicLibrary, /saveLocalMusicProject/);
  assert.match(localMusicLibrary, /trackConfigId/);
  assert.match(page, /orbitone-music-score/);
  assert.match(page, /弹跳钢琴音/);
  assert.match(synthPiano, /scheduleSynthPianoNote/);
  assert.match(synthPiano, /sample-free piano-like tone/);
  assert.match(page, /用当前模式重新解析/);
  assert.doesNotMatch(page, /精细识别整首音乐/);
  assert.doesNotMatch(page, /detailedLandingResult/);
  assert.match(page, /钢琴触键解析 <i>常用<\/i>/);
  assert.match(page, /当前模式准确优先，支持保守补漏/);
  assert.match(page, /独立宽频瞬态通道补充高可信漏点/);
  assert.match(page, /settings-bulk-actions/);
  assert.match(page, /setAllSettingsOpen\(true\)/);
  assert.match(page, /setAllSettingsOpen\(false\)/);
  assert.doesNotMatch(page, /setAllDebugSectionsOpen/);
  assert.doesNotMatch(page, /debug-toggle/);
  assert.doesNotMatch(page, /<details className="debug-subsection/);
  assert.match(page, /className=\{`debug-console is-open/);
  assert.match(page, /debug-subsection-heading/);
  assert.match(page, /aria-controls="algorithm-debug-panel"/);
  assert.match(page, /scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
  assert.match(styles, /debug-console\.is-open:not\(\.is-expanded\)/);
  assert.match(styles, /max-height: calc\(100vh - 24px\)/);
  assert.ok((page.match(/<details className="[^"]*collapsible-setting/g) ?? []).length >= 10);
  assert.doesNotMatch(page, /<details className="[^"]*collapsible-setting[^"]*" open/);
  assert.match(page, /泡泡光环/);
  assert.match(page, /烟花绽放/);
  assert.match(page, /能量爆炸/);
  assert.match(page, /晶体破碎/);
  assert.match(page, /闪电裂隙/);
  assert.match(page, /霓虹涟漪/);
  assert.match(page, /霓虹爆裂/);
  assert.match(page, /白核圆环 · 彩色光束碎片/);
  assert.doesNotMatch(page, /value !== "prismatic"/);
  assert.match(page, /三色短彩带/);
  assert.match(page, /短拖影 · 轻量同步/);
  assert.match(page, /方块迷宫专属 · 点击定位预览/);
  assert.match(page, /三个版式通用 · 点击自动定位预览/);
  assert.match(page, /弹跳效果设置/);
  assert.match(page, /色散缎带/);
  assert.match(page, /飘带扭转/);
  assert.match(page, /双螺旋/);
  assert.match(page, /消散尾/);
  assert.match(page, /音浪尾/);
  assert.match(page, /超新星/);
  assert.match(page, /星芒爆闪/);
  assert.match(page, /碎片爆裂/);
  assert.match(page, /网格涟漪/);
  assert.match(page, /礼炮彩纸/);
  assert.match(page, /冲击波＋火花/);
  assert.match(page, /尾巴长度/);
  assert.match(page, /尾巴粗细/);
  assert.match(page, /特效节奏/);
  assert.match(page, /泛光/);
  assert.match(page, /震屏/);
  assert.match(page, /顿帧/);
  assert.match(page, /背景网格/);
  assert.match(page, /暂停抓拍/);
  assert.match(page, /手动放一次/);
  assert.match(page, /卡点校准/);
  assert.match(page, /默认样本是精确谱面/);
  assert.match(page, /整体提前 30ms/);
  assert.match(page, /整体提前 60ms/);
  assert.match(page, /方块迷宫画面提前补偿/);
  assert.match(page, /卡点优先推荐/);
  assert.match(page, /快歌不建议/);
  assert.match(page, /快速或高密度音乐不建议开启顿帧/);
  assert.match(page, /const \[mazeHitstop, setMazeHitstop\] = useState\(false\)/);
  assert.match(squareMazeRenderer, /visualHitstopTime/);
  assert.match(squareMazeRenderer, /age >= 0 && age < 0\.05/);
  assert.match(page, /星轨弹跳/);
  assert.match(page, /机械悬浮/);
  assert.match(page, /物理滚落 · 砸后点亮/);
  assert.match(page, /方块迷宫/);
  assert.match(page, /斜向弹墙 · 节奏地图/);
  assert.match(page, /layoutTemplate/);
  assert.match(page, /顶部场景文字/);
  assert.match(page, /科学羊 Logo/);
  assert.match(page, /自动录制并下载/);
  assert.match(page, /samplesExpanded/);
  assert.match(page, /aria-controls="sample-library"/);
  assert.match(page, /展开选择/);
  assert.match(page, /播放即自动保存视频/);
  assert.match(page, /保存当前画面 PNG/);
  assert.match(page, /彩虹流光/);
  assert.match(page, /午夜蓝/);
  assert.match(page, /蓝图网格/);
  assert.match(page, /漫画爆点/);
  assert.match(page, /动漫黄昏/);
  assert.match(page, /赛博矩阵/);
  assert.match(page, /棱镜急行/);
  assert.match(page, /折返脉冲/);
  assert.match(page, /玻璃三连/);
  assert.match(page, /弹跳物尺寸/);
  assert.match(page, /外框描边宽度/);
  assert.match(page, /外框发光强度/);
  assert.match(page, /全色填充/);
  assert.match(page, /短流星/);
  assert.match(page, /烟花尾迹/);
  assert.match(page, /糖果梦境/);
  assert.match(page, /热血宇宙/);
  assert.match(page, /海岛冒险/);
  assert.match(page, /霓虹萌兽/);
  assert.match(page, /上传自定义皮肤/);
  assert.match(page, /最佳 1080×1920/);
  assert.match(page, /点击“保存全部设置”后会随配置一起保留/);
  assert.match(page, /customMazeSkinUrlRef/);
  assert.match(page, /上传本地视频背景/);
  assert.match(page, /任意分辨率都可以/);
  assert.match(page, /视频静音循环/);
  assert.match(page, /loadCustomMazeVideo/);
  assert.match(page, /loadTrackMedia/);
  assert.match(page, /saveTrackMedia/);
  assert.match(page, /removeTrackMedia/);
  assert.match(page, /customMazeVideoUrlRef/);
  assert.match(page, /视频会与这首歌绑定/);
  assert.match(page, /previewVisualChoice/);
  assert.match(page, /边缘与碰撞色块/);
  assert.match(page, /保存配置 JSON/);
  assert.match(page, /orbitone-visual-config/);
  assert.match(page, /保存当前歌曲全部设置/);
  assert.match(page, /saveCurrentSongCompletely/);
  assert.match(page, /音频、谱面和视频背景同时写入本地曲库/);
  assert.match(page, /existingProject\?\.id/);
  assert.match(page, /project\.trackConfigId === currentTrackConfigId/);
  assert.match(page, /当前歌曲修改后自动保存/);
  assert.match(page, /歌曲专属配置已恢复/);
  assert.match(page, /sample:\$\{sample\.url\}/);
  assert.match(page, /import:\$\{encodeURIComponent\(file\.name\)\}/);
  assert.match(page, /loadTrackCreatorSettings/);
  assert.match(page, /saveTrackCreatorSettings/);
  assert.match(page, /trackState:[\s\S]*?result: withoutModelOnlyNotes\(result\)/);
  assert.match(page, /debugPreviewPosition/);
  assert.match(page, /max=\{500\}/);
  assert.match(page, /修改后自动保存/);
  assert.match(page, /onPointerUp=\{\(\) => void persistCreatorSettings\(false\)\}/);
  assert.match(page, /window\.setTimeout\(\(\) => \{[\s\S]*?persistCreatorSettings\(false\)/);
  assert.match(page, /下次打开时自动恢复/);
  assert.match(page, /loadCreatorSettings/);
  assert.match(page, /saveCreatorSettings/);
  assert.match(creatorSettings, /orbitone-creator-settings/);
  assert.match(creatorSettings, /indexedDB\.open/);
  assert.match(creatorSettings, /customMazeSkin/);
  assert.match(creatorSettings, /track-settings/);
  assert.match(creatorSettings, /track-media/);
  assert.match(creatorSettings, /PersistedTrackMedia/);
  assert.match(creatorSettings, /export async function loadTrackMedia/);
  assert.match(creatorSettings, /export async function saveTrackMedia/);
  assert.match(creatorSettings, /export async function removeTrackMedia/);
  assert.match(creatorSettings, /PersistedTrackCreatorSettings/);
  assert.match(creatorSettings, /trackState/);
  assert.match(creatorSettings, /export async function loadTrackCreatorSettings/);
  assert.match(creatorSettings, /export async function saveTrackCreatorSettings/);
  assert.match(creatorSettings, /export async function loadCreatorSettings/);
  assert.match(creatorSettings, /export async function saveCreatorSettings/);
  assert.match(renderer, /showBranding/);
  assert.match(renderer, /drawBranding/);
  assert.match(renderer, /drawImpactEffects/);
  assert.match(renderer, /inertialTrackValue/);
  assert.match(renderer, /Binary search keeps dense full-speed playback stable/);
  assert.match(renderer, /effectLifetime/);
  assert.match(renderer, /trailCount = currentGap < 0\.18 \? 4 : 7/);
  assert.match(renderer, /trackTangent/);
  assert.match(renderer, /shape-preserving harmonic tangent/);
  assert.match(renderer, /ImpactEffect = "cartoon" \| "firework" \| "neon" \| "explosion" \| "shatter" \| "lightning" \| "prismatic"/);
  assert.match(renderer, /LayoutTemplate = "orbit" \| "kinetic" \| "square-maze"/);
  assert.match(renderer, /ballSize: number/);
  assert.match(renderer, /style\.ballSize \/ 100/);
  assert.match(renderer, /renderKineticMusicBox/);
  assert.match(renderer, /renderSquareMazeMusicBox/);
  assert.match(renderer, /rgba\(255,255,255,\.96\)/);
  assert.match(kineticRenderer, /anticipation/);
  assert.match(kineticRenderer, /drawPlatform/);
  assert.match(kineticRenderer, /platformWidthFor/);
  assert.match(kineticRenderer, /rollPhaseForGap/);
  assert.match(kineticRenderer, /obstacleCountForGap/);
  assert.match(kineticRenderer, /obstacleLiftAt/);
  assert.match(kineticRenderer, /hasBeenHit/);
  assert.match(kineticRenderer, /drawGravityTrail/);
  assert.match(kineticRenderer, /fallProgress - cameraProgress/);
  assert.match(kineticRenderer, /BACKGROUND_PARALLAX = 0\.32/);
  assert.match(kineticRenderer, /Alternating mirrored tiles/);
  assert.doesNotMatch(kineticRenderer, /CAMERA_CATCH_UP_START/);
  assert.match(kineticRenderer, /MIN_ROLL_PHASE = 0\.3/);
  assert.match(kineticRenderer, /PLATFORM_RELEASE_TILT = 0\.18/);
  assert.match(kineticRenderer, /departureX/);
  assert.match(kineticRenderer, /exitDirection \* releaseTiltForGap/);
  assert.match(kineticRenderer, /style: KineticStyle,\s+exitDirection: number,\s+\) \{/);
  assert.match(kineticRenderer, /fallDistance/);
  assert.match(kineticRenderer, /rotation/);
  assert.match(kineticRenderer, /trailProgress/);
  assert.match(kineticRenderer, /GRAVITY DROP/);
  assert.match(kineticRenderer, /focusY \+ relative \* TRACK_VERTICAL_GAP/);
  assert.match(kineticRenderer, /style\.showSceneText/);
  assert.match(kineticRenderer, /style\.ballSize/);
  assert.match(kineticRenderer, /impactEffect !== "cartoon"/);
  assert.match(kineticRenderer, /drawUniversalImpactEffect/);
  assert.doesNotMatch(kineticRenderer, /impactEffect === "prismatic" \? "cartoon"/);
  assert.match(kineticRenderer, /rgba\(255,255,255,\.97\)/);
  assert.match(squareMazeRenderer, /SQUARE_SIZE = 44/);
  assert.match(squareMazeRenderer, /chooseBounceAxis/);
  assert.match(squareMazeRenderer, /MIDI WALL MAP/);
  assert.match(squareMazeRenderer, /drawImpactParticles/);
  assert.match(squareMazeRenderer, /drawMaze/);
  assert.match(squareMazeRenderer, /squareColor/);
  assert.match(squareMazeRenderer, /midnight/);
  assert.match(squareMazeRenderer, /致敬 quasar098\/midi-playground/);
  assert.match(squareMazeRenderer, /objectPath/);
  assert.match(squareMazeRenderer, /globalCompositeOperation = "lighter"/);
  assert.match(squareMazeRenderer, /mazeTrailStyle/);
  assert.match(squareMazeRenderer, /drawSkinPattern/);
  assert.match(squareMazeRenderer, /drawCandyBurstTrail/);
  assert.match(squareMazeRenderer, /drawCometTrail/);
  assert.match(squareMazeRenderer, /drawSparkTrail/);
  assert.match(squareMazeRenderer, /drawFireworkTrail/);
  assert.match(squareMazeRenderer, /drawSourceVfxTrail/);
  assert.match(squareMazeRenderer, /drawSourceImpactEffect/);
  assert.match(squareMazeRenderer, /visualHitstopTime/);
  assert.match(squareMazeRenderer, /impactShake/);
  assert.match(squareMazeRenderer, /drawVfxBackgroundGrid/);
  assert.match(squareMazeRenderer, /context\.filter = "blur\(11px\)"/);
  assert.match(squareMazeRenderer, /mazeCustomSkinUrl/);
  assert.match(squareMazeRenderer, /mazeCustomVideoUrl/);
  assert.match(squareMazeRenderer, /customBackgroundVideo/);
  assert.match(squareMazeRenderer, /drawCoverVideo/);
  assert.match(squareMazeRenderer, /element\.muted = true/);
  assert.match(squareMazeRenderer, /GENERATED_SKIN_IMAGES/);
  assert.match(squareMazeRenderer, /mazeStrokeWidth/);
  assert.match(squareMazeRenderer, /mazeGlowIntensity/);
  assert.match(squareMazeRenderer, /mazeFillMode/);
  assert.match(squareMazeRenderer, /horizontal seams inside the maze/);
  assert.match(styles, /height: calc\(100vh - 76px\)/);
  assert.doesNotMatch(styles, /column-count:\s*[23]/);
  assert.match(styles, /grid-template-columns: 270px minmax\(650px, 1fr\) 420px/);
  assert.match(page, /layoutTemplate === "orbit" &&/);
  assert.match(page, /layoutTemplate !== "square-maze" &&/);
  assert.match(page, /机械悬浮小球尺寸/);
  assert.match(styles, /height: min\(80vh, 840px\)/);
  assert.match(styles, /custom-maze-skin-control/);
  assert.match(universalImpactRenderer, /effect === "firework"/);
  assert.match(universalImpactRenderer, /effect === "explosion"/);
  assert.match(universalImpactRenderer, /effect === "shatter"/);
  assert.match(universalImpactRenderer, /boltCount/);
  assert.match(universalImpactRenderer, /effect === "prismatic"/);
  assert.doesNotMatch(renderer, /impactEffect === "prismatic" \? "cartoon"/);
  assert.match(squareMazeRenderer, /drawAuroraRibbonTrail/);
  assert.match(squareMazeRenderer, /const ribbonColors = \[custom, "#ffd866", "#62eaff"\]/);
  assert.match(squareMazeRenderer, /12, 0\.018/);
  assert.doesNotMatch(squareMazeRenderer, /56, 0\.024/);
  assert.doesNotMatch(renderer, /砰！|⭐|🚀/);
  assert.match(page, /currentTimeRef/);
  assert.match(page, /来源：科学羊原创实验项目/);
});

test("ships the requested logo and social preview", async () => {
  const logo = new URL("../public/kexueyang.jpg", import.meta.url);
  const social = new URL("../public/og.png", import.meta.url);
  const model = new URL("../public/models/basic-pitch/model.json", import.meta.url);
  const weights = new URL("../public/models/basic-pitch/group1-shard1of1.bin", import.meta.url);
  const kineticBackground = new URL("../public/kinetic-studio-bg.png", import.meta.url);
  await Promise.all([access(logo), access(social), access(model), access(weights), access(kineticBackground)]);
  const [logoStat, socialStat, modelStat, weightsStat, kineticBackgroundStat] = await Promise.all([
    stat(logo),
    stat(social),
    stat(model),
    stat(weights),
    stat(kineticBackground),
  ]);
  assert.ok(logoStat.size > 5_000);
  assert.ok(socialStat.size > 100_000);
  assert.ok(modelStat.size > 100_000);
  assert.ok(weightsStat.size > 500_000);
  assert.ok(kineticBackgroundStat.size > 50_000);
});

test("ships eleven original playable score-backed samples", async () => {
  const sampleIds = [
    "starlight",
    "neon-run",
    "moon-drift",
    "summer-hook",
    "city-heartbeat",
    "rain-confession",
    "rapid-star-keys",
    "immortal-echo",
    "prism-rush",
    "switchback-groove",
    "glass-triplets",
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
