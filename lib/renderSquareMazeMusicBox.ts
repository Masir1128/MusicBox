import type { MelodyNote } from "./melodyAnalyzer";
import { drawUniversalImpactEffect, impactLifetime, type UniversalImpactEffect } from "./drawUniversalImpactEffect";

type SquareMazeStyle = {
  meteorIntensity: number;
  impactEffect: "cartoon" | "firework" | "neon" | "explosion" | "shatter" | "lightning" | "prismatic";
  impactIntensity: number;
  showSceneText: boolean;
  mazeSkin: "midnight" | "aurora" | "sunset" | "crimson" | "blueprint" | "comic" | "anime" | "candy" | "cyber" | "ink" | "cosmic" | "voyage" | "monster" | "custom";
  mazeCustomSkinUrl: string;
  mazeCustomVideoUrl: string;
  squareColorMode: "rainbow" | "red" | "yellow" | "cyan" | "pink" | "violet" | "green" | "orange" | "white" | "custom";
  mazeSquareColor: string;
  mazeShape: "square" | "circle" | "diamond" | "hexagon" | "star" | "heart" | "note" | "moon" | "sparkle" | "clover" | "droplet";
  mazeObjectSize: number;
  mazeEdgeColor: string;
  mazeTrailColor: string;
  mazeTrailStyle: "meteor" | "ribbon" | "comet" | "spark" | "firework" | "aurora" | "prism" | "twist" | "helix" | "dissolve" | "wave";
  mazeStrokeWidth: number;
  mazeGlowIntensity: number;
  mazeFillMode: "outline" | "half" | "solid";
  mazeImpactEffect: "cartoon" | UniversalImpactEffect | "vfx-nova" | "vfx-star" | "vfx-shatter" | "vfx-ripple" | "vfx-confetti" | "vfx-combo";
  mazeTrailLength: number;
  mazeTrailWidth: number;
  mazeEffectBpm: number;
  mazeEffectIntensity: number;
  mazeBloom: boolean;
  mazeShake: boolean;
  mazeHitstop: boolean;
  mazeBackgroundGrid: boolean;
};

type Axis = "x" | "y";
type Direction = { x: -1 | 1; y: -1 | 1 };
type MazeNode = {
  x: number;
  y: number;
  axis: Axis;
  incoming: Direction;
  outgoing: Direction;
  index: number;
};
type MazeGeometry = { width: number; height: number; nodes: MazeNode[] };
type Segment = { index: number; progress: number };
type TrailPoint = { x: number; y: number; offset: number; index: number };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const smoothstep = (value: number) => value * value * (3 - 2 * value);
const hash = (value: number) => {
  const x = Math.sin(value * 91.733 + 17.13) * 43758.5453;
  return x - Math.floor(x);
};

const PALETTES = {
  midnight: {
    backgroundA: "#12315d",
    backgroundB: "#020711",
    corridor: "#03070c",
    corridorEdge: "#1c365c",
    pegs: ["#ff557d", "#62ebff", "#85ff74", "#b680ff", "#ffe06b"],
  },
  aurora: {
    backgroundA: "#0d897f",
    backgroundB: "#03182a",
    corridor: "#02090b",
    corridorEdge: "#123331",
    pegs: ["#76ffe0", "#6ed7ff", "#c2ff65", "#b99cff", "#fff07a"],
  },
  sunset: {
    backgroundA: "#934c91",
    backgroundB: "#1c0b3b",
    corridor: "#080507",
    corridorEdge: "#4c2a5d",
    pegs: ["#ffd36a", "#ff765e", "#ff9dd3", "#7feeff", "#d7ff75"],
  },
  crimson: {
    backgroundA: "#ff3a49",
    backgroundB: "#741439",
    corridor: "#03070c",
    corridorEdge: "#34202d",
    pegs: ["#ff5777", "#66e9ff", "#84ff62", "#a85cff", "#ffd45f"],
  },
  blueprint: {
    backgroundA: "#164f88",
    backgroundB: "#031323",
    corridor: "#03101c",
    corridorEdge: "#4fd8ff",
    pegs: ["#4fd8ff", "#ffffff", "#76aaff", "#8fffff", "#b8d9ff"],
  },
  comic: {
    backgroundA: "#ffd83d",
    backgroundB: "#e74c3c",
    corridor: "#11131a",
    corridorEdge: "#ffffff",
    pegs: ["#ffed49", "#ff4e72", "#52d8ff", "#7a5cff", "#ffffff"],
  },
  anime: {
    backgroundA: "#ff8db8",
    backgroundB: "#34245f",
    corridor: "#0c0b1b",
    corridorEdge: "#ffb9dc",
    pegs: ["#ffb9dc", "#8fe9ff", "#fff1a8", "#bca1ff", "#ffffff"],
  },
  candy: {
    backgroundA: "#d75bda",
    backgroundB: "#3d1769",
    corridor: "#120b24",
    corridorEdge: "#ff9fe8",
    pegs: ["#ff9fe8", "#7ff3ff", "#fff49a", "#9effb0", "#ffffff"],
  },
  cyber: {
    backgroundA: "#07533e",
    backgroundB: "#010908",
    corridor: "#010605",
    corridorEdge: "#20ff9b",
    pegs: ["#20ff9b", "#b8ff44", "#00e5ff", "#ffffff", "#53ffcf"],
  },
  ink: {
    backgroundA: "#76808a",
    backgroundB: "#161a1d",
    corridor: "#090b0c",
    corridorEdge: "#d6dde2",
    pegs: ["#f2f2f2", "#aab5bd", "#e2d0a7", "#8fa4b2", "#ffffff"],
  },
  cosmic: {
    backgroundA: "#1b1a79",
    backgroundB: "#030421",
    corridor: "#03040d",
    corridorEdge: "#ff45c8",
    pegs: ["#ffd84f", "#24ddff", "#ff45c8", "#8a6dff", "#ffffff"],
  },
  voyage: {
    backgroundA: "#086f8b",
    backgroundB: "#03172d",
    corridor: "#02080e",
    corridorEdge: "#ffc553",
    pegs: ["#ffc553", "#1fe0ea", "#ff7659", "#78d5ff", "#ffffff"],
  },
  monster: {
    backgroundA: "#342078",
    backgroundB: "#030627",
    corridor: "#03040f",
    corridorEdge: "#bd5cff",
    pegs: ["#ff73d1", "#45e9ff", "#ffe45d", "#8affb8", "#ffffff"],
  },
  custom: {
    backgroundA: "#17305b",
    backgroundB: "#030817",
    corridor: "#02060d",
    corridorEdge: "#65eaff",
    pegs: ["#65eaff", "#ff5ccf", "#ffe45d", "#7dff9b", "#ffffff"],
  },
} as const;

const GENERATED_SKIN_IMAGES: Partial<Record<SquareMazeStyle["mazeSkin"], string>> = {
  cosmic: "/maze-skins/anime-cosmic-burst.webp",
  voyage: "/maze-skins/cartoon-ocean-adventure.webp",
  monster: "/maze-skins/neon-monster-festival.webp",
};

const generatedSkinCache = new Map<string, HTMLImageElement>();
const customVideoCache = new Map<string, {
  element: HTMLVideoElement;
  lastTimelineTime: number | null;
  lastWallTime: number;
}>();

// Holds the most recent successfully drawn video frame per source. While the
// video element seeks or decodes (readyState drops), the renderer draws this
// snapshot instead of falling back to the image skin — that fallback used to
// visibly flip the background between video and image mid-playback.
let lastVideoFrame: { source: string; canvas: HTMLCanvasElement } | null = null;

function generatedSkinImage(skin: SquareMazeStyle["mazeSkin"], customSource: string) {
  const source = skin === "custom" ? customSource : GENERATED_SKIN_IMAGES[skin];
  if (!source || typeof Image === "undefined") return null;
  let image = generatedSkinCache.get(source);
  if (!image) {
    image = new Image();
    image.src = source;
    generatedSkinCache.set(source, image);
  }
  return image;
}

function drawCoverImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
) {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const canvasRatio = width / height;
  const sourceWidth = imageRatio > canvasRatio ? image.naturalHeight * canvasRatio : image.naturalWidth;
  const sourceHeight = imageRatio > canvasRatio ? image.naturalHeight : image.naturalWidth / canvasRatio;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
}

function getCachedBackgroundVideo(source: string) {
  let cached = customVideoCache.get(source);
  if (!cached) {
    const element = document.createElement("video");
    element.src = source;
    element.muted = true;
    element.loop = true;
    element.playsInline = true;
    element.preload = "auto";
    element.load();
    cached = { element, lastTimelineTime: null, lastWallTime: performance.now() / 1_000 };
    customVideoCache.set(source, cached);
  }
  return cached;
}

// Sources under external sync are driven frame-by-frame by the offline
// exporter: customBackgroundVideo returns the element untouched (no auto
// play/seek), so exporter and live preview never fight over the playhead.
const externalVideoSync = new Set<string>();

export function setMazeVideoExternalSync(source: string, enabled: boolean) {
  if (enabled) externalVideoSync.add(source);
  else externalVideoSync.delete(source);
}

const waitForMediaEvent = (element: HTMLVideoElement, event: string, timeoutMs: number) =>
  new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      element.removeEventListener(event, onEvent);
      element.removeEventListener("error", onEvent);
      window.clearTimeout(timer);
      resolve();
    };
    const onEvent = () => finish();
    const timer = window.setTimeout(finish, timeoutMs);
    element.addEventListener(event, onEvent);
    element.addEventListener("error", onEvent);
  });

/**
 * Position the cached background video at the exact timeline time and wait
 * until that frame is decodable. Used by the offline exporter so MV-style
 * backgrounds are frame-accurate instead of advancing at seek cadence.
 */
export async function seekMazeVideoFrame(source: string, time: number) {
  if (typeof document === "undefined" || !source) return;
  const cached = getCachedBackgroundVideo(source);
  const element = cached.element;
  if (!element.paused) element.pause();
  if (element.readyState < HTMLMediaElement.HAVE_METADATA) {
    await waitForMediaEvent(element, "loadedmetadata", 3_000);
    if (element.readyState < HTMLMediaElement.HAVE_METADATA) return;
  }
  const duration = Number.isFinite(element.duration) && element.duration > 0 ? element.duration : 0;
  if (!duration) return;
  const desiredTime = ((time % duration) + duration) % duration;
  if (
    element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    && Math.abs(element.currentTime - desiredTime) < 1 / 120
  ) {
    return;
  }
  const seeked = waitForMediaEvent(element, "seeked", 800);
  element.currentTime = desiredTime;
  await seeked;
  cached.lastTimelineTime = time;
  cached.lastWallTime = performance.now() / 1_000;
}

function customBackgroundVideo(source: string, time: number) {
  if (typeof document === "undefined") return null;
  for (const [cachedSource, cached] of customVideoCache) {
    if (cachedSource === source) continue;
    cached.element.pause();
    cached.element.removeAttribute("src");
    cached.element.load();
    customVideoCache.delete(cachedSource);
    if (lastVideoFrame?.source === cachedSource) lastVideoFrame = null;
  }
  if (!source) return null;
  const cached = getCachedBackgroundVideo(source);

  if (externalVideoSync.has(source)) {
    cached.lastTimelineTime = time;
    cached.lastWallTime = performance.now() / 1_000;
    return cached.element;
  }

  const wallTime = performance.now() / 1_000;
  const timelineDelta = cached.lastTimelineTime === null ? 0 : time - cached.lastTimelineTime;
  const wallDelta = Math.max(1 / 120, wallTime - cached.lastWallTime);
  const moving = timelineDelta > 0.001 && timelineDelta < 0.35;
  const duration = Number.isFinite(cached.element.duration) && cached.element.duration > 0
    ? cached.element.duration
    : 0;
  const desiredTime = duration ? ((time % duration) + duration) % duration : 0;
  if (
    cached.element.readyState >= HTMLMediaElement.HAVE_METADATA &&
    !cached.element.seeking &&
    Math.abs(cached.element.currentTime - desiredTime) > 0.28
  ) {
    cached.element.currentTime = desiredTime;
  }
  if (moving) {
    cached.element.playbackRate = clamp(timelineDelta / wallDelta, 0.25, 4);
    if (cached.element.paused) void cached.element.play().catch(() => undefined);
  } else if (!cached.element.paused) {
    cached.element.pause();
  }
  cached.lastTimelineTime = time;
  cached.lastWallTime = wallTime;
  return cached.element;
}

function drawCoverVideo(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
) {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth || !video.videoHeight) return false;
  const videoRatio = video.videoWidth / video.videoHeight;
  const canvasRatio = width / height;
  const sourceWidth = videoRatio > canvasRatio ? video.videoHeight * canvasRatio : video.videoWidth;
  const sourceHeight = videoRatio > canvasRatio ? video.videoHeight : video.videoWidth / canvasRatio;
  const sourceX = (video.videoWidth - sourceWidth) / 2;
  const sourceY = (video.videoHeight - sourceHeight) / 2;
  context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
  return true;
}

function squareColor(style: SquareMazeStyle, time: number, pitch: number) {
  const mode = style.squareColorMode;
  if (mode === "red") return "#ff4057";
  if (mode === "yellow") return "#ffe04f";
  if (mode === "cyan") return "#65eaff";
  if (mode === "pink") return "#ff5ccf";
  if (mode === "violet") return "#b26bff";
  if (mode === "green") return "#5dffa0";
  if (mode === "orange") return "#ff9a3d";
  if (mode === "white") return "#f4f7ff";
  if (mode === "custom") return style.mazeSquareColor || "#ff5ccf";
  return `hsl(${Math.round((time * 145 + pitch * 8) % 360)} 96% 64%)`;
}

const geometryCache = new WeakMap<MelodyNote[], MazeGeometry>();
const SQUARE_SIZE = 44;
const CORRIDOR_PADDING = 72;
const CAMERA_FOCUS_Y = 0.56;

function hexAlpha(color: string, alpha: number) {
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return `${color}${Math.round(clamp(alpha, 0, 1) * 255).toString(16).padStart(2, "0")}`;
  }
  return color;
}

function segmentAt(notes: MelodyNote[], time: number): Segment {
  if (notes.length <= 1 || time <= notes[0].time) return { index: 0, progress: 0 };
  if (time >= notes.at(-1)!.time) return { index: notes.length - 1, progress: 0 };
  let low = 0;
  let high = notes.length - 1;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (notes[middle].time <= time) low = middle;
    else high = middle;
  }
  const duration = Math.max(0.05, notes[low + 1].time - notes[low].time);
  return { index: low, progress: clamp((time - notes[low].time) / duration, 0, 1) };
}

function flip(direction: Direction, axis: Axis): Direction {
  return {
    x: axis === "x" ? (direction.x * -1) as -1 | 1 : direction.x,
    y: axis === "y" ? (direction.y * -1) as -1 | 1 : direction.y,
  };
}

function distanceForGap(gap: number, width: number) {
  return clamp(58 + gap * 238, width * 0.15, width * 0.48);
}

function chooseBounceAxis(
  note: MelodyNote,
  index: number,
  x: number,
  incoming: Direction,
  nextDistance: number,
  lane: number,
): Axis {
  // An upward leg lasts for one segment only. This lets the route create the
  // boxy pockets of the reference map while the full song still travels down.
  if (incoming.y < 0) return "y";
  if (Math.abs(x + incoming.x * nextDistance) > lane) return "x";
  const shortGapTurn = nextDistance < lane * 0.62;
  const pitchPattern = (Math.round(note.pitch) + index * 3) % 11;
  if (shortGapTurn && (pitchPattern === 0 || pitchPattern === 4 || index % 9 === 6)) return "y";
  return "x";
}

function createGeometry(notes: MelodyNote[], width: number, height: number): MazeGeometry {
  const cached = geometryCache.get(notes);
  if (cached?.width === width && cached.height === height) return cached;

  const nodes: MazeNode[] = [];
  const lane = width * 0.74;
  let x = 0;
  let y = 0;
  let incoming: Direction = { x: 1, y: 1 };

  for (let index = 0; index < notes.length; index += 1) {
    const nextGap = index < notes.length - 1
      ? Math.max(0.05, notes[index + 1].time - notes[index].time)
      : 0.3;
    const distance = distanceForGap(nextGap, width);
    const axis = chooseBounceAxis(notes[index], index, x, incoming, distance, lane);
    const outgoing = flip(incoming, axis);
    nodes.push({ x, y, axis, incoming, outgoing, index });
    if (index < notes.length - 1) {
      x += outgoing.x * distance;
      y += outgoing.y * distance;
      incoming = outgoing;
    }
  }

  const geometry = { width, height, nodes };
  geometryCache.set(notes, geometry);
  return geometry;
}

function positionAt(notes: MelodyNote[], nodes: MazeNode[], time: number) {
  const segment = segmentAt(notes, time);
  const first = nodes[0];
  if (time < notes[0].time) {
    const lead = Math.max(0.1, notes[0].time);
    const progress = smoothstep(clamp(time / lead, 0, 1));
    const approach = 130 * (1 - progress);
    return {
      x: first.x - first.incoming.x * approach,
      y: first.y - first.incoming.y * approach,
      segment: { index: 0, progress },
    };
  }
  const nextIndex = Math.min(nodes.length - 1, segment.index + 1);
  if (nextIndex === segment.index) return { x: nodes[segment.index].x, y: nodes[segment.index].y, segment };
  const start = nodes[segment.index];
  const end = nodes[nextIndex];
  return {
    x: start.x + (end.x - start.x) * segment.progress,
    y: start.y + (end.y - start.y) * segment.progress,
    segment,
  };
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function drawSkinPattern(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  skin: SquareMazeStyle["mazeSkin"],
) {
  context.save();
  if (GENERATED_SKIN_IMAGES[skin] || skin === "custom") {
    context.restore();
    return;
  }
  if (skin === "comic") {
    context.fillStyle = "rgba(12,18,28,.16)";
    for (let y = 8; y < height; y += 18) {
      for (let x = 8 + (Math.floor(y / 18) % 2) * 9; x < width; x += 18) {
        context.beginPath();
        context.arc(x, y, 2.2, 0, Math.PI * 2);
        context.fill();
      }
    }
  } else if (skin === "anime") {
    context.strokeStyle = "rgba(255,255,255,.08)";
    context.lineWidth = 1.2;
    for (let index = 0; index < 28; index += 1) {
      const angle = index / 28 * Math.PI * 2;
      context.beginPath();
      context.moveTo(width * 0.5 + Math.cos(angle) * 45, height * 0.48 + Math.sin(angle) * 45);
      context.lineTo(width * 0.5 + Math.cos(angle) * width, height * 0.48 + Math.sin(angle) * width);
      context.stroke();
    }
  } else if (skin === "candy") {
    for (let index = 0; index < 18; index += 1) {
      const x = hash(index * 4.2) * width;
      const y = (hash(index * 7.1) * height + time * (4 + index % 3)) % height;
      const radius = 8 + hash(index * 2.4) * 26;
      context.strokeStyle = `rgba(255,255,255,${0.04 + hash(index) * 0.08})`;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.stroke();
    }
  } else if (skin === "cyber") {
    context.strokeStyle = "rgba(32,255,155,.13)";
    context.lineWidth = 1;
    for (let index = 0; index < 20; index += 1) {
      const y = index * 54 + (time * 12) % 54;
      const turn = width * (0.2 + hash(index) * 0.6);
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(turn, y);
      context.lineTo(turn + 28, y + 28);
      context.lineTo(width, y + 28);
      context.stroke();
    }
  } else if (skin === "ink") {
    context.strokeStyle = "rgba(255,255,255,.045)";
    context.lineWidth = 10;
    context.lineCap = "round";
    for (let index = 0; index < 13; index += 1) {
      const y = hash(index * 6.1) * height;
      context.globalAlpha = 0.3 + hash(index) * 0.5;
      context.beginPath();
      context.moveTo(-30, y);
      context.quadraticCurveTo(width * 0.45, y + Math.sin(index) * 35, width + 30, y - 18);
      context.stroke();
    }
  } else {
    const grid = skin === "blueprint" ? 24 : 48;
    const drift = (time * (skin === "blueprint" ? 3 : 8)) % grid;
    context.strokeStyle = skin === "blueprint" ? "rgba(100,220,255,.14)" : "rgba(255,255,255,.045)";
    context.lineWidth = 1;
    for (let x = -grid + drift; x < width + grid; x += grid) {
      context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
    }
    for (let y = -grid + drift; y < height + grid; y += grid) {
      context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
    }
  }
  context.restore();
}

function drawBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  style: SquareMazeStyle,
) {
  const palette = PALETTES[style.mazeSkin];
  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, palette.backgroundB);
  background.addColorStop(0.46, palette.backgroundA);
  background.addColorStop(1, palette.backgroundB);
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  const videoUrl = style.mazeCustomVideoUrl;
  const video = customBackgroundVideo(videoUrl, time);
  const illustratedSkin = generatedSkinImage(style.mazeSkin, style.mazeCustomSkinUrl);
  let customMediaDrawn = false;
  if (videoUrl) {
    // An active video background always wins over the image skin and never
    // falls back to it: while the element seeks or decodes, hold the last
    // good frame so the background cannot flip between video and image.
    context.save();
    context.globalAlpha = 0.9;
    const drawnLive = video ? drawCoverVideo(context, video, width, height) : false;
    context.restore();
    if (drawnLive && video) {
      customMediaDrawn = true;
      if (
        !lastVideoFrame
        || lastVideoFrame.source !== videoUrl
        || lastVideoFrame.canvas.width !== width
        || lastVideoFrame.canvas.height !== height
      ) {
        const snapshot = document.createElement("canvas");
        snapshot.width = width;
        snapshot.height = height;
        lastVideoFrame = { source: videoUrl, canvas: snapshot };
      }
      const snapshotContext = lastVideoFrame.canvas.getContext("2d");
      if (snapshotContext) drawCoverVideo(snapshotContext, video, width, height);
    } else if (lastVideoFrame?.source === videoUrl) {
      context.save();
      context.globalAlpha = 0.9;
      context.drawImage(lastVideoFrame.canvas, 0, 0, width, height);
      context.restore();
      customMediaDrawn = true;
    }
  } else if (illustratedSkin?.complete && illustratedSkin.naturalWidth > 0) {
    context.save();
    context.globalAlpha = 0.88;
    drawCoverImage(context, illustratedSkin, width, height);
    context.restore();
    customMediaDrawn = true;
  }
  if (customMediaDrawn) {
    const readabilityShade = context.createRadialGradient(
      width * 0.5,
      height * 0.52,
      width * 0.08,
      width * 0.5,
      height * 0.52,
      width * 0.78,
    );
    readabilityShade.addColorStop(0, "rgba(0,3,14,.23)");
    readabilityShade.addColorStop(0.52, "rgba(0,3,14,.06)");
    readabilityShade.addColorStop(1, "rgba(0,3,14,.18)");
    context.fillStyle = readabilityShade;
    context.fillRect(0, 0, width, height);
  }

  const pulse = 0.18 + Math.sin(time * 0.72) * 0.04;
  const glow = context.createRadialGradient(width * 0.52, height * 0.52, 0, width * 0.52, height * 0.52, width * 0.75);
  glow.addColorStop(0, `rgba(255,255,255,${pulse})`);
  glow.addColorStop(0.42, "rgba(255,255,255,.02)");
  glow.addColorStop(1, "rgba(0,0,0,.38)");
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);

  drawSkinPattern(context, width, height, time, style.mazeSkin);

  const specks = Math.round(8 + style.meteorIntensity / 10);
  for (let index = 0; index < specks; index += 1) {
    const x = hash(index * 4.7) * width;
    const y = (hash(index * 9.1) * height + time * (7 + hash(index) * 12)) % height;
    context.fillStyle = `rgba(255,255,255,${0.08 + hash(index * 3.3) * 0.16})`;
    context.fillRect(x, y, 1.2, 1.2);
  }
}

function mapRect(a: MazeNode, b: MazeNode) {
  return {
    x: Math.min(a.x, b.x) - CORRIDOR_PADDING,
    y: Math.min(a.y, b.y) - CORRIDOR_PADDING,
    width: Math.abs(b.x - a.x) + CORRIDOR_PADDING * 2,
    height: Math.abs(b.y - a.y) + CORRIDOR_PADDING * 2,
  };
}

function drawMaze(
  context: CanvasRenderingContext2D,
  nodes: MazeNode[],
  currentIndex: number,
  cameraX: number,
  cameraY: number,
  width: number,
  height: number,
  skin: SquareMazeStyle["mazeSkin"],
) {
  const palette = PALETTES[skin];
  const start = Math.max(0, currentIndex - 10);
  const end = Math.min(nodes.length - 2, currentIndex + 16);
  context.save();
  context.shadowColor = "rgba(0,0,0,.66)";
  context.shadowBlur = 28;
  for (let index = start; index <= end; index += 1) {
    const rect = mapRect(nodes[index], nodes[index + 1]);
    const x = rect.x - cameraX;
    const y = rect.y - cameraY;
    if (x > width + 120 || y > height + 120 || x + rect.width < -120 || y + rect.height < -120) continue;
    context.fillStyle = palette.corridor;
    // Fill-only corridor tiles merge into one dark route. Stroking every tile
    // created horizontal seams inside the maze when adjacent rectangles overlap.
    roundedRect(context, x, y, rect.width, rect.height, 7);
    context.fill();
  }
  context.restore();
}

function drawPegs(
  context: CanvasRenderingContext2D,
  notes: MelodyNote[],
  nodes: MazeNode[],
  currentIndex: number,
  time: number,
  cameraX: number,
  cameraY: number,
  style: SquareMazeStyle,
) {
  const start = Math.max(0, currentIndex - 11);
  const end = Math.min(nodes.length - 1, currentIndex + 16);
  const objectSize = clamp(style.mazeObjectSize || SQUARE_SIZE, 24, 78);
  const pegLength = clamp(27 + (objectSize - SQUARE_SIZE) * 0.34, 24, 44);
  const color = style.mazeEdgeColor || "#65eaff";
  for (let index = start; index <= end; index += 1) {
    const node = nodes[index];
    const hit = time >= notes[index].time;
    const age = time - notes[index].time;
    const flash = age >= 0 && age < 0.42 ? 1 - age / 0.42 : 0;
    const pegWidth = node.axis === "x" ? 10 : pegLength;
    const pegHeight = node.axis === "x" ? pegLength : 10;
    const x = node.x + (node.axis === "x" ? node.incoming.x * (objectSize / 2 + 5) : 0) - pegWidth / 2 - cameraX;
    const y = node.y + (node.axis === "y" ? node.incoming.y * (objectSize / 2 + 5) : 0) - pegHeight / 2 - cameraY;
    context.save();
    context.globalCompositeOperation = flash > 0 ? "lighter" : "source-over";
    context.globalAlpha = hit ? 0.82 + flash * 0.18 : 0.34;
    context.shadowColor = color;
    context.shadowBlur = hit ? 14 + flash * 34 : 5;
    context.fillStyle = flash > 0.55 ? "#ffffff" : color;
    roundedRect(context, x, y, pegWidth, pegHeight, 2.5);
    context.fill();
    if (flash > 0) {
      const centerX = x + pegWidth / 2;
      const centerY = y + pegHeight / 2;
      context.globalAlpha = flash * 0.78;
      context.strokeStyle = color;
      context.lineWidth = 2 + flash * 3;
      context.beginPath();
      context.arc(centerX, centerY, 15 + (1 - flash) * 48, 0, Math.PI * 2);
      context.stroke();
      const halo = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, 62);
      halo.addColorStop(0, hexAlpha(color, flash * 0.42));
      halo.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = halo;
      context.fillRect(centerX - 62, centerY - 62, 124, 124);
    }
    context.restore();
  }
}

function impactAge(notes: MelodyNote[], segment: Segment, time: number) {
  const index = time >= notes[segment.index].time ? segment.index : -1;
  return { index, age: index >= 0 ? time - notes[index].time : Number.POSITIVE_INFINITY };
}

type SourceImpactEffect = Extract<SquareMazeStyle["mazeImpactEffect"], `vfx-${string}`>;

function sourceImpactLifetime(effect: SourceImpactEffect) {
  if (effect === "vfx-nova") return 1.05;
  if (effect === "vfx-star") return 0.56;
  if (effect === "vfx-ripple") return 0.95;
  if (effect === "vfx-confetti") return 1.2;
  if (effect === "vfx-shatter") return 0.9;
  return 0.74;
}

function sourceLine(
  context: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  alpha: number,
  width: number,
) {
  context.strokeStyle = color;
  context.globalAlpha = alpha;
  context.lineWidth = Math.max(0.4, width);
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
}

function sourceDot(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number,
) {
  context.globalAlpha = alpha;
  context.fillStyle = color;
  context.beginPath();
  context.arc(x, y, Math.max(0.3, radius), 0, Math.PI * 2);
  context.fill();
}

function drawSourceImpactEffect(
  context: CanvasRenderingContext2D,
  effect: SourceImpactEffect,
  x: number,
  y: number,
  age: number,
  seed: number,
  style: SquareMazeStyle,
) {
  const lifetime = sourceImpactLifetime(effect);
  if (age < 0 || age > lifetime) return;
  const progress = clamp(age / lifetime, 0, 1);
  const spread = 1 - Math.pow(1 - progress, 3);
  const fade = Math.pow(1 - progress, 1.8);
  const power = clamp(style.mazeEffectIntensity / 100, 0.5, 1.8);
  const rhythm = clamp(style.mazeEffectBpm / 124, 0.56, 1.62);
  const primary = style.mazeEdgeColor || "#65eaff";
  const secondary = style.mazeTrailColor || "#ff5ccf";
  const colors = [primary, secondary, "#fff36a", "#62efff", "#ff63bd", "#87ff7b", "#9e78ff"];

  context.save();
  context.globalCompositeOperation = "lighter";
  context.lineCap = "round";

  if (effect === "vfx-star") {
    const length = 250 * power * Math.pow(1 - progress, 0.55);
    sourceLine(context, x - length * 0.92, y - 3, x + length * 0.92, y - 3, "#00d8ff", fade * 0.42, 2);
    sourceLine(context, x - length * 0.92, y + 3, x + length * 0.92, y + 3, "#ff2fd0", fade * 0.42, 2);
    ([[1, 1.4, 0.42], [0.72, 3, 0.55], [0.46, 6, 0.72], [0.26, 11, 1]] as const).forEach(([lengthFactor, width, alpha]) => {
      sourceLine(context, x - length * lengthFactor, y, x + length * lengthFactor, y, "#ffffff", fade * alpha, width * fade + 0.4);
      sourceLine(context, x, y - length * lengthFactor * 0.5, x, y + length * lengthFactor * 0.5, "#ffffff", fade * alpha * 0.9, width * fade * 0.85 + 0.4);
    });
    const diagonal = length * 0.2;
    sourceLine(context, x - diagonal, y - diagonal, x + diagonal, y + diagonal, "#bfebff", fade * 0.3, 2);
    sourceLine(context, x + diagonal, y - diagonal, x - diagonal, y + diagonal, "#bfebff", fade * 0.3, 2);
    sourceDot(context, x, y, 14 * fade + 3, "#ffffff", fade);
    context.strokeStyle = primary;
    context.globalAlpha = fade * 0.5;
    context.lineWidth = 1.4;
    context.beginPath();
    context.arc(x, y, 10 + 130 * power * spread, 0, Math.PI * 2);
    context.stroke();
  } else if (effect === "vfx-ripple") {
    ([[1, primary, 3.4], [1.24, secondary, 1.7], [0.74, "#8ff3ff", 1.2]] as const).forEach(([multiple, color, width]) => {
      context.strokeStyle = color;
      context.globalAlpha = fade * 0.95;
      context.lineWidth = width * fade + 0.4;
      context.beginPath();
      context.arc(x, y, 8 + 230 * power * spread * multiple, 0, Math.PI * 2);
      context.stroke();
    });
    for (let tick = 0; tick < 14; tick += 1) {
      const angle = tick / 14 * Math.PI * 2 + 0.25;
      const inner = 16 + 230 * power * spread;
      const outer = inner + 13 * fade + 3;
      sourceLine(
        context,
        x + Math.cos(angle) * inner,
        y + Math.sin(angle) * inner,
        x + Math.cos(angle) * outer,
        y + Math.sin(angle) * outer,
        "#e8f6ff",
        fade * 0.9,
        2.6 * fade + 0.5,
      );
    }
  } else if (effect === "vfx-shatter" || effect === "vfx-confetti") {
    const particleCount = effect === "vfx-confetti" ? 30 : 11;
    for (let particle = 0; particle < particleCount; particle += 1) {
      const base = seed * 29 + particle * 7.13;
      const angle = effect === "vfx-confetti"
        ? -Math.PI / 2 + (hash(base) - 0.5) * 2.2
        : particle / particleCount * Math.PI * 2 + hash(base) * 0.35;
      const speed = (effect === "vfx-confetti" ? 170 : 160) + hash(base + 4.2) * (effect === "vfx-confetti" ? 300 : 230);
      const px = x + Math.cos(angle) * speed * power * age;
      const py = y + Math.sin(angle) * speed * power * age + (effect === "vfx-confetti" ? 430 : 380) * age * age;
      const color = colors[particle % colors.length];
      const rotation = hash(base + 8.8) * Math.PI * 2 + (hash(base + 11.2) - 0.5) * age * 15;
      context.save();
      context.translate(px, py);
      context.rotate(rotation);
      context.globalAlpha = fade;
      context.fillStyle = color;
      context.shadowColor = color;
      context.shadowBlur = style.mazeBloom ? 12 : 3;
      if (effect === "vfx-confetti") {
        const width = 5 + hash(base + 16.4) * 5;
        context.fillRect(-width / 2, -2, width, 4);
      } else {
        const size = 8 + hash(base + 19.7) * 7;
        context.beginPath();
        context.moveTo(0, -size);
        context.lineTo(size, size * 0.78);
        context.lineTo(-size, size * 0.65);
        context.closePath();
        context.fill();
      }
      context.restore();
    }
    if (effect === "vfx-shatter") sourceDot(context, x, y, 10 * fade, "#ffffff", fade * 0.8);
  } else {
    const rayCount = effect === "vfx-nova" ? 14 : 12;
    for (let ray = 0; ray < rayCount; ray += 1) {
      const random = hash(seed * 17 + ray * 5.1);
      const angle = ray / rayCount * Math.PI * 2 + random * 0.2;
      const speed = (effect === "vfx-nova" ? 190 : 150) + random * 160;
      const outer = 12 + speed * power * spread * 0.62;
      const inner = Math.max(12, outer - (18 + hash(ray * 8.2) * 22) * fade - 6);
      const color = colors[ray % colors.length];
      sourceLine(
        context,
        x + Math.cos(angle) * inner,
        y + Math.sin(angle) * inner,
        x + Math.cos(angle) * outer,
        y + Math.sin(angle) * outer,
        color,
        fade,
        3.4 * fade + 0.6,
      );
      sourceDot(context, x + Math.cos(angle) * (outer + 18 * fade), y + Math.sin(angle) * (outer + 18 * fade), 2.4 * fade + 0.3, color, fade * 0.85);
    }
    const rings = effect === "vfx-nova"
      ? [[110, primary, 2.8], [118, secondary, 1.3], [152, "#7fefff", 1]] as const
      : [[92, primary, 2.6], [112, secondary, 1.3]] as const;
    rings.forEach(([radius, color, width], index) => {
      context.strokeStyle = color;
      context.globalAlpha = fade * (1 - index * 0.22);
      context.lineWidth = width * fade + 0.35;
      context.beginPath();
      context.arc(x, y, 8 + radius * power * spread, 0, Math.PI * 2);
      context.stroke();
    });
    if (effect === "vfx-nova") {
      const core = Math.min(1, age / 0.11);
      if (core < 1) sourceDot(context, x, y, 10 + 36 * core, "#ffffff", (1 - core) * 0.9);
      for (let glint = 0; glint < 16; glint += 1) {
        const angle = hash(seed * 41 + glint * 3.7) * Math.PI * 2;
        const distance = (50 + hash(glint * 9.1) * 110) * power * (0.35 + 0.65 * spread);
        const px = x + Math.cos(angle) * distance;
        const py = y + Math.sin(angle) * distance;
        const twinkle = Math.abs(Math.sin(age * 11 * rhythm + glint));
        const size = 2.5 + 3.5 * twinkle;
        sourceLine(context, px - size, py, px + size, py, "#ffffff", fade * twinkle * 0.9, 1.3);
        sourceLine(context, px, py - size, px, py + size, "#ffffff", fade * twinkle * 0.9, 1.3);
      }
    }
  }
  context.restore();
}

function drawImpactParticles(
  context: CanvasRenderingContext2D,
  notes: MelodyNote[],
  nodes: MazeNode[],
  segment: Segment,
  time: number,
  cameraX: number,
  cameraY: number,
  style: SquareMazeStyle,
) {
  const start = Math.max(0, segment.index - 3);
  const count = Math.round(12 + clamp(style.mazeEffectIntensity, 50, 180) / 4.5);
  for (let noteIndex = start; noteIndex <= segment.index; noteIndex += 1) {
    const age = time - notes[noteIndex].time;
    const effect = style.mazeImpactEffect ?? style.impactEffect;
    const sourceEffect = effect.startsWith("vfx-") ? effect as SourceImpactEffect : null;
    const lifetime = sourceEffect
      ? sourceImpactLifetime(sourceEffect)
      : effect === "cartoon"
      ? 0.64
      : impactLifetime(effect as UniversalImpactEffect);
    if (age < 0 || age > lifetime) continue;
    const node = nodes[noteIndex];
    const color = style.mazeEdgeColor || "#65eaff";
    const secondary = style.mazeTrailColor || "#ff5ccf";
    const fade = Math.pow(1 - age / lifetime, 1.25);
    const originX = node.x - cameraX;
    const originY = node.y - cameraY;

    if (sourceEffect) {
      drawSourceImpactEffect(context, sourceEffect, originX, originY, age, noteIndex + 211, style);
      continue;
    }

    if (effect !== "cartoon") {
      drawUniversalImpactEffect(context, effect as UniversalImpactEffect, {
        x: originX,
        y: originY,
        age,
        lifetime,
        seed: noteIndex + 211,
        primary: color,
        secondary,
        intensity: clamp(style.mazeEffectIntensity, 20, 100),
        scale: 0.9,
      });
      continue;
    }

    context.save();
    context.globalCompositeOperation = "lighter";
    context.globalAlpha = fade;
    context.shadowColor = color;
    context.shadowBlur = 26;
    context.strokeStyle = color;
    context.lineWidth = Math.max(1, fade * 5);
    context.beginPath();
    context.arc(originX, originY, 20 + age * 115, 0, Math.PI * 2);
    context.stroke();
    context.globalAlpha = fade * 0.6;
    context.strokeStyle = secondary;
    context.beginPath();
    context.arc(originX, originY, 8 + age * 175, 0, Math.PI * 2);
    context.stroke();
    context.restore();
    for (let particle = 0; particle < count; particle += 1) {
      const angle = hash(noteIndex * 17 + particle * 5.3) * Math.PI * 2;
      const speed = 72 + hash(particle * 8.7 + noteIndex) * 230;
      const distance = speed * age;
      const x = originX + Math.cos(angle) * distance;
      const y = originY + Math.sin(angle) * distance + age * age * 70;
      const size = (3 + hash(particle * 4.1) * 9) * fade;
      context.save();
      context.globalCompositeOperation = "lighter";
      context.globalAlpha = fade * 0.82;
      const particleColor = particle % 4 === 0 ? "#ffffff" : particle % 2 ? color : secondary;
      context.shadowColor = particleColor;
      context.shadowBlur = 8;
      context.fillStyle = particleColor;
      context.translate(x, y);
      context.rotate(angle + age * 8);
      context.fillRect(-size * 1.5, -size / 3, size * 3, size * 0.66);
      context.restore();
    }
  }
}

function drawStarPath(context: CanvasRenderingContext2D, radius: number) {
  context.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const angle = -Math.PI / 2 + point * Math.PI / 5;
    const pointRadius = point % 2 === 0 ? radius : radius * 0.43;
    const x = Math.cos(angle) * pointRadius;
    const y = Math.sin(angle) * pointRadius;
    if (point === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
}

function drawCandyBurstTrail(
  context: CanvasRenderingContext2D,
  points: TrailPoint[],
  time: number,
  style: SquareMazeStyle,
  pitch: number,
) {
  const custom = style.mazeTrailColor || "#ff5ccf";
  const scale = clamp(style.mazeObjectSize / SQUARE_SIZE, 0.76, 1.42) * clamp(style.mazeTrailWidth / 20, 0.4, 1.9);
  const candyColors = [custom, "#ff4fcb", "#3feaff", "#ffe45b", "#74ff8d", "#9c72ff"];

  context.save();
  context.globalCompositeOperation = "lighter";
  context.lineCap = "round";
  context.lineJoin = "round";

  // A wide translucent core keeps the trail readable over all three illustrated skins.
  context.strokeStyle = custom;
  context.shadowColor = custom;
  context.shadowBlur = 30;
  context.globalAlpha = 0.24;
  context.lineWidth = 18 * scale;
  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.stroke();

  [-2, -1, 0, 1, 2].forEach((strand) => {
    const color = strand === 0
      ? custom
      : candyColors[(strand + candyColors.length) % candyColors.length];
    context.strokeStyle = color;
    context.shadowColor = color;
    context.shadowBlur = strand === 0 ? 24 : 15;
    context.globalAlpha = strand === 0 ? 0.95 : 0.72;
    context.lineWidth = (strand === 0 ? 7.5 : 4.2) * scale;
    context.beginPath();
    points.forEach((point, index) => {
      const progress = index / Math.max(1, points.length - 1);
      const wave = Math.sin(index * 0.66 + time * 10.5 + strand * 1.7) * strand * (3.4 + progress * 2.4);
      const x = point.x + wave;
      const y = point.y - wave * 0.58;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
  });

  const particleCount = 34;
  for (let particle = 0; particle < particleCount; particle += 1) {
    const anchorIndex = Math.floor(hash(particle * 5.71 + pitch) * points.length);
    const anchor = points[anchorIndex];
    const trailProgress = anchor.index / Math.max(1, points.length - 1);
    const phase = time * (2.6 + hash(particle * 3.13) * 3.5) + particle * 2.17;
    const spread = (9 + hash(particle * 8.31) * 28) * scale * (0.55 + trailProgress * 0.7);
    const x = anchor.x + Math.cos(phase) * spread;
    const y = anchor.y + Math.sin(phase * 1.13) * spread * 0.72;
    const size = (3.5 + hash(particle * 4.77) * 7.5) * scale * (0.62 + trailProgress * 0.62);
    const color = candyColors[particle % candyColors.length];
    const kind = particle % 4;

    context.save();
    context.translate(x, y);
    context.rotate(phase * 0.58);
    context.globalAlpha = 0.32 + trailProgress * 0.66;
    context.fillStyle = color;
    context.strokeStyle = color;
    context.shadowColor = color;
    context.shadowBlur = 10 + size;
    if (kind === 0) {
      drawStarPath(context, size);
      context.fill();
    } else if (kind === 1) {
      context.beginPath();
      context.arc(0, 0, size, 0, Math.PI * 2);
      context.arc(size * 0.45, -size * 0.18, size * 0.82, 0, Math.PI * 2);
      context.fill("evenodd");
    } else if (kind === 2) {
      context.fillRect(-size * 0.72, -size * 0.48, size * 1.44, size * 0.96);
      context.beginPath();
      context.moveTo(-size * 0.68, 0);
      context.lineTo(-size * 1.35, -size * 0.72);
      context.lineTo(-size * 1.35, size * 0.72);
      context.closePath();
      context.moveTo(size * 0.68, 0);
      context.lineTo(size * 1.35, -size * 0.72);
      context.lineTo(size * 1.35, size * 0.72);
      context.closePath();
      context.fill();
      context.globalAlpha *= 0.82;
      context.fillStyle = "#ffffff";
      context.fillRect(-size * 0.16, -size * 0.48, size * 0.32, size * 0.96);
    } else {
      context.lineWidth = Math.max(2, size * 0.34);
      context.beginPath();
      context.moveTo(-size, 0);
      context.lineTo(size, 0);
      context.stroke();
    }
    context.restore();
  }

  const head = points.at(-1)!;
  context.save();
  context.translate(head.x, head.y);
  context.rotate(time * 2.8);
  for (let ray = 0; ray < 12; ray += 1) {
    const angle = ray / 12 * Math.PI * 2;
    const color = candyColors[ray % candyColors.length];
    context.save();
    context.rotate(angle);
    context.strokeStyle = color;
    context.shadowColor = color;
    context.shadowBlur = 18;
    context.globalAlpha = 0.72;
    context.lineWidth = 2.6 * scale;
    context.beginPath();
    context.moveTo(24 * scale, 0);
    context.lineTo((38 + (ray % 3) * 8) * scale, 0);
    context.stroke();
    context.restore();
  }
  context.strokeStyle = squareColor(style, time, pitch + 12);
  context.shadowColor = custom;
  context.shadowBlur = 28;
  context.globalAlpha = 0.94;
  context.lineWidth = 4 * scale;
  context.beginPath();
  context.arc(0, 0, (26 + Math.sin(time * 9) * 3) * scale, 0, Math.PI * 2);
  context.stroke();
  context.restore();
  context.restore();
}

function drawAuroraRibbonTrail(
  context: CanvasRenderingContext2D,
  points: TrailPoint[],
  style: SquareMazeStyle,
) {
  const custom = style.mazeTrailColor || "#ff5ccf";
  const scale = clamp(style.mazeObjectSize / SQUARE_SIZE, 0.76, 1.42) * clamp(style.mazeTrailWidth / 20, 0.4, 1.9);
  const ribbonColors = [custom, "#ffd866", "#62eaff"];
  const center = (ribbonColors.length - 1) / 2;
  const strandSpacing = 11 * scale;

  const ribbonPoints = (strand: number) => points.map((point, index) => {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    const length = Math.max(0.001, Math.hypot(dx, dy));
    const progress = index / Math.max(1, points.length - 1);
    const normalX = -dy / length;
    const normalY = dx / length;
    const flowingOffset = (strand - center) * strandSpacing * (0.86 + (1 - progress) * 0.14);
    return {
      x: point.x + normalX * flowingOffset,
      y: point.y + normalY * flowingOffset,
    };
  });

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.globalCompositeOperation = "lighter";

  ribbonColors.forEach((color, strand) => {
    const pathPoints = ribbonPoints(strand);
    context.strokeStyle = color;
    context.shadowColor = color;
    for (let index = 1; index < pathPoints.length; index += 1) {
      const progress = index / Math.max(1, pathPoints.length - 1);
      context.globalAlpha = 0.12 + progress * 0.72;
      context.shadowBlur = (3 + progress * 5) * scale;
      context.lineWidth = (6.5 + progress * 3) * scale;
      context.beginPath();
      context.moveTo(pathPoints[index - 1].x, pathPoints[index - 1].y);
      context.lineTo(pathPoints[index].x, pathPoints[index].y);
      context.stroke();
    }
  });

  context.restore();
}

function sampleTrailPoints(
  notes: MelodyNote[],
  nodes: MazeNode[],
  time: number,
  cameraX: number,
  cameraY: number,
  count: number,
  step: number,
) {
  return Array.from({ length: count }, (_, index) => {
    const offset = (count - 1 - index) * step;
    const sample = positionAt(notes, nodes, Math.max(0, time - offset));
    return { x: sample.x - cameraX, y: sample.y - cameraY, offset, index };
  });
}

function drawMeteorTrail(context: CanvasRenderingContext2D, points: TrailPoint[], style: SquareMazeStyle) {
  const custom = style.mazeTrailColor || "#ff5ccf";
  const widthScale = clamp(style.mazeTrailWidth / 20, 0.4, 1.9);
  context.save();
  context.globalCompositeOperation = "lighter";
  points.forEach((point, index) => {
    const progress = index / Math.max(1, points.length - 1);
    const size = (1.2 + Math.pow(progress, 2.2) * style.mazeObjectSize * 0.32) * widthScale;
    context.globalAlpha = 0.08 + progress * 0.82;
    context.fillStyle = progress > 0.82 ? "#ffffff" : custom;
    context.shadowColor = custom;
    context.shadowBlur = 8 + progress * 24;
    context.beginPath();
    context.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
    context.fill();
  });
  context.restore();
}

function strokeTrailPath(context: CanvasRenderingContext2D, points: TrailPoint[]) {
  context.beginPath();
  points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
}

function drawCometTrail(context: CanvasRenderingContext2D, points: TrailPoint[], style: SquareMazeStyle) {
  const custom = style.mazeTrailColor || "#ff5ccf";
  const scale = clamp(style.mazeObjectSize / SQUARE_SIZE, 0.72, 1.45) * clamp(style.mazeTrailWidth / 20, 0.4, 1.9);
  context.save();
  context.globalCompositeOperation = "lighter";
  context.lineCap = "round";
  context.lineJoin = "round";
  context.globalAlpha = 0.2;
  context.strokeStyle = custom;
  context.shadowColor = custom;
  context.shadowBlur = 32;
  context.lineWidth = 22 * scale;
  strokeTrailPath(context, points);
  context.stroke();
  context.globalAlpha = 0.72;
  context.lineWidth = 8 * scale;
  strokeTrailPath(context, points);
  context.stroke();
  context.globalAlpha = 0.95;
  context.strokeStyle = "#ffffff";
  context.shadowColor = custom;
  context.shadowBlur = 22;
  context.lineWidth = 2.4 * scale;
  strokeTrailPath(context, points.slice(Math.floor(points.length * 0.38)));
  context.stroke();
  const head = points.at(-1)!;
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.arc(head.x, head.y, 8 * scale, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawSparkTrail(context: CanvasRenderingContext2D, points: TrailPoint[], time: number, style: SquareMazeStyle, pitch: number) {
  const widthScale = clamp(style.mazeTrailWidth / 20, 0.4, 1.9);
  context.save();
  context.globalCompositeOperation = "lighter";
  points.forEach((point, index) => {
    if (index % 2 !== 0) return;
    const progress = index / Math.max(1, points.length - 1);
    const color = squareColor(style, time - point.offset, pitch + index * 1.7);
    const size = (3 + progress * 12) * clamp(style.mazeObjectSize / SQUARE_SIZE, 0.74, 1.4) * widthScale;
    context.save();
    context.translate(point.x, point.y);
    context.rotate(time * 4 + index * 0.63);
    context.globalAlpha = 0.2 + progress * 0.8;
    context.fillStyle = color;
    context.shadowColor = color;
    context.shadowBlur = 18;
    drawStarPath(context, size);
    context.fill();
    context.fillStyle = "#ffffff";
    context.fillRect(-size * 1.45, -0.8, size * 2.9, 1.6);
    context.fillRect(-0.8, -size * 1.45, 1.6, size * 2.9);
    context.restore();
  });
  context.restore();
}

function drawFireworkTrail(context: CanvasRenderingContext2D, points: TrailPoint[], time: number, style: SquareMazeStyle, pitch: number) {
  const custom = style.mazeTrailColor || "#ff5ccf";
  const colors = [custom, "#fff05a", "#62efff", "#ff63bd", "#87ff7b", "#9e78ff"];
  const scale = clamp(style.mazeObjectSize / SQUARE_SIZE, 0.74, 1.4) * clamp(style.mazeTrailWidth / 20, 0.4, 1.9);
  context.save();
  context.globalCompositeOperation = "lighter";
  points.forEach((point, index) => {
    if (index % 3 !== 0 && index !== points.length - 1) return;
    const progress = index / Math.max(1, points.length - 1);
    const pulse = 0.55 + 0.45 * Math.sin(time * 11 + index);
    const radius = (7 + progress * 24 + pulse * 7) * scale;
    for (let ray = 0; ray < 9; ray += 1) {
      const angle = ray / 9 * Math.PI * 2 + time * 1.8 + hash(index * 9 + ray + pitch) * 0.22;
      const color = colors[(ray + index) % colors.length];
      context.globalAlpha = 0.2 + progress * 0.78;
      context.strokeStyle = color;
      context.shadowColor = color;
      context.shadowBlur = 13;
      context.lineWidth = (1.2 + progress * 1.8) * scale;
      context.beginPath();
      context.moveTo(point.x + Math.cos(angle) * radius * 0.32, point.y + Math.sin(angle) * radius * 0.32);
      context.lineTo(point.x + Math.cos(angle) * radius, point.y + Math.sin(angle) * radius);
      context.stroke();
    }
  });
  context.restore();
}

function drawSourceVfxTrail(
  context: CanvasRenderingContext2D,
  points: TrailPoint[],
  time: number,
  style: SquareMazeStyle,
  pitch: number,
) {
  const mode = style.mazeTrailStyle;
  if (!["prism", "twist", "helix", "dissolve", "wave"].includes(mode)) return;
  const baseWidth = clamp(style.mazeTrailWidth, 8, 38) * clamp(style.mazeObjectSize / SQUARE_SIZE, 0.76, 1.42);
  const rhythm = clamp(style.mazeEffectBpm / 124, 0.56, 1.62);
  const primary = style.mazeTrailColor || "#ff5ccf";
  const activeAge = Math.max(0, time - Math.floor(time * style.mazeEffectBpm / 60) * 60 / style.mazeEffectBpm);

  context.save();
  context.globalCompositeOperation = "lighter";
  context.lineCap = "round";
  context.lineJoin = "round";

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const point = points[index];
    const progress = index / Math.max(1, points.length - 1);
    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    const distance = Math.max(0.001, Math.hypot(dx, dy));
    const normalX = -dy / distance;
    const normalY = dx / distance;
    const rainbow = `hsl(${(pitch * 7 + time * 100 + (1 - progress) * 320) % 360} 100% 63%)`;

    if (mode === "prism") {
      const width = baseWidth * Math.pow(progress, 0.75);
      const offset = width * 0.28;
      sourceLine(context, previous.x + normalX * offset, previous.y + normalY * offset, point.x + normalX * offset, point.y + normalY * offset, "#00c8ff", 0.5 * Math.pow(progress, 1.2), width);
      sourceLine(context, previous.x - normalX * offset, previous.y - normalY * offset, point.x - normalX * offset, point.y - normalY * offset, "#ff1fb8", 0.5 * Math.pow(progress, 1.2), width);
      sourceLine(context, previous.x, previous.y, point.x, point.y, "#e9fbff", Math.pow(progress, 1.25), width * 0.5);
    } else if (mode === "twist") {
      const modulation = 0.4 + 0.6 * Math.abs(Math.sin(progress * 9 - time * 6 * rhythm));
      const width = baseWidth * Math.pow(progress, 0.7) * modulation;
      sourceLine(context, previous.x, previous.y, point.x, point.y, rainbow, Math.pow(progress, 1.15), width);
      sourceLine(context, previous.x + normalX * width * 0.32, previous.y + normalY * width * 0.32, point.x + normalX * width * 0.32, point.y + normalY * width * 0.32, "#ffffff", 0.45 * progress, width * 0.16);
    } else if (mode === "helix") {
      const amplitude = baseWidth * 0.6;
      const previousProgress = (index - 1) / Math.max(1, points.length - 1);
      const previousOffset = amplitude * Math.sin(previousProgress * 13 - time * 9 * rhythm);
      const offset = amplitude * Math.sin(progress * 13 - time * 9 * rhythm);
      const width = baseWidth * 0.3 * Math.pow(progress, 0.55) + 0.6;
      sourceLine(context, previous.x + normalX * previousOffset, previous.y + normalY * previousOffset, point.x + normalX * offset, point.y + normalY * offset, rainbow, Math.pow(progress, 1.1), width);
      sourceLine(context, previous.x - normalX * previousOffset, previous.y - normalY * previousOffset, point.x - normalX * offset, point.y - normalY * offset, `hsl(${(pitch * 7 + time * 100 + 190 + (1 - progress) * 150) % 360} 100% 64%)`, Math.pow(progress, 1.1), width);
    } else if (mode === "dissolve") {
      const visible = Math.max(0, (progress - 0.38) / 0.62);
      if (visible > 0) sourceLine(context, previous.x, previous.y, point.x, point.y, rainbow, Math.pow(visible, 0.9), baseWidth * Math.pow(visible, 0.7));
    } else {
      const envelope = Math.exp(-activeAge * 7);
      const width = baseWidth * Math.pow(progress, 0.8) * (1 + envelope * 0.95 * Math.sin(progress * 26 - time * 20 * rhythm));
      sourceLine(context, previous.x, previous.y, point.x, point.y, rainbow, Math.pow(progress, 1.15), Math.abs(width) + 0.5);
    }
  }

  if (mode === "dissolve") {
    const particleCount = Math.round(18 + style.mazeTrailLength / 24);
    for (let particle = 0; particle < particleCount; particle += 1) {
      const anchorIndex = Math.floor(hash(particle * 6.17 + pitch) * Math.max(1, points.length * 0.68));
      const anchor = points[Math.min(points.length - 1, anchorIndex)];
      const life = hash(particle * 8.31 + pitch * 2.1);
      const phase = time * (2.5 + rhythm * 2.2) + particle * 1.73;
      const spread = (8 + life * 32) * (1 - anchor.index / Math.max(1, points.length - 1) * 0.35);
      const x = anchor.x + Math.cos(phase) * spread;
      const y = anchor.y + Math.sin(phase * 1.17) * spread * 0.7 - life * 14;
      const color = particle % 3 === 0 ? primary : `hsl(${(particle * 47 + time * 80) % 360} 100% 66%)`;
      sourceDot(context, x, y, 1 + life * 2.6, color, 0.25 + life * 0.62);
    }
  }

  context.restore();
}

function drawTrail(
  context: CanvasRenderingContext2D,
  notes: MelodyNote[],
  nodes: MazeNode[],
  time: number,
  cameraX: number,
  cameraY: number,
  style: SquareMazeStyle,
  pitch: number,
) {
  const lengthScale = clamp(style.mazeTrailLength / 230, 0.39, 2.09);
  if (["prism", "twist", "helix", "dissolve", "wave"].includes(style.mazeTrailStyle)) {
    const count = Math.round(clamp(style.mazeTrailLength / 12, 8, 40));
    const step = style.mazeTrailLength / 1_000 / Math.max(1, count - 1);
    drawSourceVfxTrail(context, sampleTrailPoints(notes, nodes, time, cameraX, cameraY, count, step), time, style, pitch);
    return;
  }
  if (style.mazeTrailStyle === "aurora") {
    drawAuroraRibbonTrail(context, sampleTrailPoints(notes, nodes, time, cameraX, cameraY, 12, 0.018 * lengthScale), style);
    return;
  }
  if (style.mazeTrailStyle === "ribbon") {
    drawCandyBurstTrail(context, sampleTrailPoints(notes, nodes, time, cameraX, cameraY, 24, 0.027 * lengthScale), time, style, pitch);
    return;
  }
  if (style.mazeTrailStyle === "comet") {
    drawCometTrail(context, sampleTrailPoints(notes, nodes, time, cameraX, cameraY, 28, 0.034 * lengthScale), style);
    return;
  }
  if (style.mazeTrailStyle === "spark") {
    drawSparkTrail(context, sampleTrailPoints(notes, nodes, time, cameraX, cameraY, 18, 0.028 * lengthScale), time, style, pitch);
    return;
  }
  if (style.mazeTrailStyle === "firework") {
    drawFireworkTrail(context, sampleTrailPoints(notes, nodes, time, cameraX, cameraY, 16, 0.032 * lengthScale), time, style, pitch);
    return;
  }

  drawMeteorTrail(context, sampleTrailPoints(notes, nodes, time, cameraX, cameraY, 10, 0.014 * lengthScale), style);
}

function objectPath(
  context: CanvasRenderingContext2D,
  shape: SquareMazeStyle["mazeShape"],
  width: number,
  height: number,
) {
  context.beginPath();
  const halfW = width / 2;
  const halfH = height / 2;
  if (shape === "circle") {
    context.ellipse(0, 0, halfW, halfH, 0, 0, Math.PI * 2);
    context.closePath();
    return;
  }
  if (shape === "square") {
    roundedRect(context, -halfW, -halfH, width, height, Math.max(3, width * 0.08));
    return;
  }
  if (shape === "heart") {
    context.moveTo(0, halfH * 0.92);
    context.bezierCurveTo(-halfW * 1.25, halfH * 0.1, -halfW * 0.82, -halfH * 0.95, 0, -halfH * 0.28);
    context.bezierCurveTo(halfW * 0.82, -halfH * 0.95, halfW * 1.25, halfH * 0.1, 0, halfH * 0.92);
    context.closePath();
    return;
  }
  if (shape === "note") {
    // Eighth note: tilted head + stem + flag — the music box signature shape.
    context.ellipse(-halfW * 0.34, halfH * 0.58, halfW * 0.44, halfH * 0.32, -0.32, 0, Math.PI * 2);
    context.rect(halfW * 0.02, -halfH, halfW * 0.15, halfH * 1.6);
    context.moveTo(halfW * 0.17, -halfH);
    context.bezierCurveTo(halfW * 0.85, -halfH * 0.86, halfW * 0.88, -halfH * 0.3, halfW * 0.42, -halfH * 0.02);
    context.bezierCurveTo(halfW * 0.62, -halfH * 0.4, halfW * 0.52, -halfH * 0.62, halfW * 0.17, -halfH * 0.64);
    context.closePath();
    return;
  }
  if (shape === "moon") {
    const radius = Math.min(halfW, halfH) * 0.96;
    context.arc(0, 0, radius, Math.PI * 0.32, Math.PI * 1.68, false);
    context.arc(radius * 0.52, 0, radius * 0.8, Math.PI * 1.62, Math.PI * 0.38, true);
    context.closePath();
    return;
  }
  if (shape === "clover") {
    // Four overlapping leaves read as a lucky clover (or a flower).
    const leaf = Math.min(halfW, halfH) * 0.6;
    ([[-0.52, -0.52], [0.52, -0.52], [-0.52, 0.52], [0.52, 0.52]] as const).forEach(([dx, dy]) => {
      const cx = dx * halfW * 0.92;
      const cy = dy * halfH * 0.92;
      context.moveTo(cx + leaf, cy);
      context.arc(cx, cy, leaf, 0, Math.PI * 2);
    });
    return;
  }
  if (shape === "droplet") {
    context.moveTo(0, -halfH);
    context.bezierCurveTo(halfW * 0.92, -halfH * 0.1, halfW * 0.86, halfH * 0.42, 0, halfH * 0.86);
    context.bezierCurveTo(-halfW * 0.86, halfH * 0.42, -halfW * 0.92, -halfH * 0.1, 0, -halfH);
    context.closePath();
    return;
  }
  const isSparkle = shape === "sparkle";
  const vertices = shape === "diamond"
    ? 4
    : shape === "hexagon"
      ? 6
      : shape === "star"
        ? 10
        : isSparkle
          ? 8
          : 4;
  const innerScale = isSparkle ? 0.3 : 0.43;
  for (let index = 0; index < vertices; index += 1) {
    const starPoint = (shape !== "star" && !isSparkle) || index % 2 === 0;
    const radiusX = halfW * (starPoint ? 1 : innerScale);
    const radiusY = halfH * (starPoint ? 1 : innerScale);
    const angleOffset = shape === "diamond" ? 0 : -Math.PI / 2;
    const angle = angleOffset + index / vertices * Math.PI * 2;
    const x = Math.cos(angle) * radiusX;
    const y = Math.sin(angle) * radiusY;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
}

function drawSquare(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  node: MazeNode,
  age: number,
  color: string,
  style: SquareMazeStyle,
) {
  const recoil = age >= 0 && age < 0.22
    ? Math.sin((1 - age / 0.22) * Math.PI / 2) * (1 - age / 0.22)
    : 0;
  const objectSize = clamp(style.mazeObjectSize || SQUARE_SIZE, 24, 78);
  const width = objectSize * (node.axis === "x" ? 1 - recoil * 0.18 : 1 + recoil * 0.17);
  const height = objectSize * (node.axis === "y" ? 1 - recoil * 0.18 : 1 + recoil * 0.17);
  const strokeWidth = clamp(style.mazeStrokeWidth || 2, 0.5, 8);
  const glowStrength = clamp(style.mazeGlowIntensity ?? 42, 0, 100) / 100;
  context.save();
  context.translate(x, y);
  if (style.mazeShape === "star" || style.mazeShape === "sparkle") context.rotate(age >= 0 && age < 0.5 ? age * 1.8 : 0);
  context.shadowColor = color;
  context.shadowBlur = glowStrength * (18 + strokeWidth * 2.2 + recoil * 24);
  context.fillStyle = style.mazeFillMode === "outline" ? "rgba(0,3,7,.98)" : color;
  context.globalAlpha = style.mazeFillMode === "half" ? 0.42 : 1;
  objectPath(context, style.mazeShape, width, height);
  context.fill();
  context.globalAlpha = 1;
  context.shadowBlur = glowStrength * (5 + strokeWidth * 1.5);
  context.strokeStyle = color;
  context.lineWidth = strokeWidth;
  objectPath(context, style.mazeShape, width, height);
  context.stroke();

  if (style.mazeFillMode !== "outline") {
    const inner = context.createLinearGradient(0, -height / 2, 0, height / 2);
    inner.addColorStop(0, "rgba(255,255,255,.46)");
    inner.addColorStop(0.34, "rgba(255,255,255,.08)");
    inner.addColorStop(1, "rgba(0,0,0,.24)");
    context.fillStyle = inner;
    context.globalAlpha = style.mazeFillMode === "solid" ? 0.46 : 0.7;
    objectPath(context, style.mazeShape, Math.max(8, width - strokeWidth * 3), Math.max(8, height - strokeWidth * 3));
    context.fill();
    context.globalAlpha = 1;
  }
  context.fillStyle = "rgba(255,255,255,.9)";
  context.beginPath();
  context.arc(-width * 0.2, -height * 0.22, Math.max(2, objectSize * 0.055), 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawHud(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  duration: number,
  currentIndex: number,
  total: number,
  showSceneText: boolean,
) {
  if (showSceneText) {
    const shade = context.createLinearGradient(0, 0, 0, 160);
    shade.addColorStop(0, "rgba(2,4,8,.84)");
    shade.addColorStop(1, "rgba(2,4,8,0)");
    context.fillStyle = shade;
    context.fillRect(0, 0, width, 170);
    context.fillStyle = "rgba(255,255,255,.98)";
    context.font = "700 17px ui-sans-serif, -apple-system, sans-serif";
    context.textAlign = "left";
    context.fillText("ORBITONE · SQUARE MAZE", 28, 43);
    context.fillStyle = "rgba(255,255,255,.72)";
    context.font = "600 12px ui-monospace, monospace";
    context.fillText(`${String(currentIndex + 1).padStart(3, "0")} / ${String(total).padStart(3, "0")}  ·  MIDI WALL MAP`, 28, 67);
    context.textAlign = "right";
    context.fillStyle = "rgba(255,255,255,.95)";
    context.font = "600 11px ui-sans-serif, -apple-system, sans-serif";
    context.fillText("致敬 quasar098/midi-playground", width - 28, 43);
    context.fillStyle = "rgba(255,255,255,.68)";
    context.font = "500 10px ui-sans-serif, -apple-system, sans-serif";
    context.fillText("独立改制 · 方块弹墙节奏地图", width - 28, 64);
  }

  const progress = clamp(time / Math.max(0.1, duration), 0, 1);
  context.fillStyle = "rgba(255,255,255,.14)";
  roundedRect(context, 28, height - 36, width - 56, 4, 2);
  context.fill();
  const bar = context.createLinearGradient(28, 0, width - 28, 0);
  bar.addColorStop(0, "#65eaff");
  bar.addColorStop(0.5, "#b078ff");
  bar.addColorStop(1, "#ff536e");
  context.fillStyle = bar;
  roundedRect(context, 28, height - 36, (width - 56) * progress, 4, 2);
  context.fill();
}

function visualHitstopTime(notes: MelodyNote[], time: number, enabled: boolean) {
  if (!enabled || !notes.length) return time;
  let low = 0;
  let high = notes.length - 1;
  let latest = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (notes[middle].time <= time) {
      latest = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  if (latest < 0) return time;
  const age = time - notes[latest].time;
  return age >= 0 && age < 0.05 ? notes[latest].time + 0.001 : time;
}

function impactShake(
  notes: MelodyNote[],
  segment: Segment,
  time: number,
  enabled: boolean,
  intensity: number,
) {
  if (!enabled) return { x: 0, y: 0 };
  const index = time >= notes[segment.index].time ? segment.index : -1;
  if (index < 0) return { x: 0, y: 0 };
  const age = time - notes[index].time;
  if (age < 0 || age > 0.34) return { x: 0, y: 0 };
  const fade = Math.exp(-age * 9);
  const amount = 8 * clamp(intensity / 100, 0.5, 1.8) * fade;
  return {
    x: (hash(index * 17 + Math.floor(age * 120) * 2.3) - 0.5) * amount,
    y: (hash(index * 23 + Math.floor(age * 120) * 4.7) - 0.5) * amount,
  };
}

function drawVfxBackgroundGrid(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  notes: MelodyNote[],
  nodes: MazeNode[],
  segment: Segment,
  cameraX: number,
  cameraY: number,
  style: SquareMazeStyle,
) {
  if (!style.mazeBackgroundGrid) return;
  const spacing = 34;
  const waveEnabled = ["vfx-nova", "vfx-star", "vfx-ripple", "vfx-combo"].includes(style.mazeImpactEffect);
  const power = clamp(style.mazeEffectIntensity / 100, 0.5, 1.8);
  const recentStart = Math.max(0, segment.index - 3);

  context.save();
  context.globalCompositeOperation = "lighter";
  for (let y = -spacing; y < height + spacing; y += spacing) {
    for (let x = -spacing; x < width + spacing; x += spacing) {
      let pointX = x;
      let pointY = y;
      let glow = 0;
      if (waveEnabled) {
        for (let index = recentStart; index <= segment.index; index += 1) {
          const age = time - notes[index].time;
          if (age < 0 || age > 0.95) continue;
          const nodeX = nodes[index].x - cameraX;
          const nodeY = nodes[index].y - cameraY;
          const progress = age / 0.95;
          const radius = 10 + 230 * power * (1 - Math.pow(1 - progress, 3));
          const dx = x - nodeX;
          const dy = y - nodeY;
          const distance = Math.hypot(dx, dy) || 1;
          const influence = Math.max(0, 1 - Math.abs(distance - radius) / 48);
          if (influence > 0) {
            const push = influence * 28 * (1 - progress);
            pointX += dx / distance * push;
            pointY += dy / distance * push;
            glow = Math.max(glow, influence * (1 - progress));
          }
        }
      }
      sourceDot(context, pointX, pointY, 1.1 + glow * 2.4, glow > 0.03 ? "#8ff3ff" : "#243050", 0.5 + glow * 0.5);
    }
  }
  context.restore();
}

export function renderSquareMazeMusicBox(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  notes: MelodyNote[],
  duration: number,
  style: SquareMazeStyle,
) {
  const safeNotes = notes.length
    ? notes
    : [{ time: 0, duration: 1, pitch: 60, confidence: 1, velocity: 1 }];
  const visualTime = visualHitstopTime(safeNotes, time, style.mazeHitstop);
  const { nodes } = createGeometry(safeNotes, width, height);
  const square = positionAt(safeNotes, nodes, visualTime);
  const shake = impactShake(safeNotes, square.segment, visualTime, style.mazeShake, style.mazeEffectIntensity);
  const cameraX = square.x - width * 0.5 - shake.x;
  const cameraY = square.y - height * CAMERA_FOCUS_Y - shake.y;
  const impact = impactAge(safeNotes, square.segment, visualTime);
  const activeNode = nodes[Math.max(0, impact.index >= 0 ? impact.index : square.segment.index)];
  const activePitch = safeNotes[Math.max(0, square.segment.index)]?.pitch ?? 60;
  const color = squareColor(style, visualTime, activePitch);

  context.clearRect(0, 0, width, height);
  drawBackground(context, width, height, visualTime, style);
  drawVfxBackgroundGrid(context, width, height, visualTime, safeNotes, nodes, square.segment, cameraX, cameraY, style);
  drawMaze(context, nodes, square.segment.index, cameraX, cameraY, width, height, style.mazeSkin);
  drawPegs(context, safeNotes, nodes, square.segment.index, visualTime, cameraX, cameraY, style);
  if (style.mazeBloom) {
    context.save();
    context.filter = "blur(11px)";
    context.globalAlpha = 0.5;
    drawImpactParticles(context, safeNotes, nodes, square.segment, visualTime, cameraX, cameraY, style);
    drawTrail(context, safeNotes, nodes, visualTime, cameraX, cameraY, style, activePitch);
    context.restore();
  }
  drawImpactParticles(context, safeNotes, nodes, square.segment, visualTime, cameraX, cameraY, style);
  drawTrail(context, safeNotes, nodes, visualTime, cameraX, cameraY, style, activePitch);
  drawSquare(context, square.x - cameraX, square.y - cameraY, activeNode, impact.age, color, style);
  drawHud(context, width, height, visualTime, duration, square.segment.index, safeNotes.length, style.showSceneText);
}
