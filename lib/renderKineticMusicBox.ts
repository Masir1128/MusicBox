import type { MelodyNote } from "./melodyAnalyzer";
import { drawUniversalImpactEffect, impactLifetime, type UniversalImpactEffect } from "./drawUniversalImpactEffect";

type KineticStyle = {
  theme: "nebula" | "aurora" | "solar";
  meteorIntensity: number;
  impactEffect: "cartoon" | "firework" | "neon" | "explosion" | "shatter" | "lightning" | "prismatic";
  impactIntensity: number;
  ballSize: number;
  showSceneText: boolean;
};

type Segment = { index: number; progress: number };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const smoothstep = (value: number) => value * value * (3 - 2 * value);
const hash = (value: number) => {
  const x = Math.sin(value * 91.733 + 17.13) * 43758.5453;
  return x - Math.floor(x);
};

const THEME_GLOW = {
  nebula: ["#8df7ff", "#ff86d0", "#b19aff", "#ffe48a", "#72ffc0"],
  aurora: ["#8dffdf", "#7ce6ff", "#afff95", "#d6b6ff", "#fff49c"],
  solar: ["#ffcc7a", "#ff8f78", "#ffdca2", "#ff74bd", "#7efcff"],
} as const;

let backgroundImage: HTMLImageElement | null = null;
const geometryCache = new WeakMap<MelodyNote[], { width: number; xs: number[] }>();

const TRACK_VERTICAL_GAP = 126;
const TRACK_FOCUS_Y = 0.68;
const MIN_ROLL_PHASE = 0.3;
const PLATFORM_RELEASE_TILT = 0.18;
const BACKGROUND_PARALLAX = 0.32;
const BALL_CONTACT_OFFSET = 58;
const BALL_RADIUS = 36;

function ensureBackground() {
  if (backgroundImage || typeof Image === "undefined") return backgroundImage;
  backgroundImage = new Image();
  backgroundImage.decoding = "async";
  backgroundImage.src = "/kinetic-studio-bg.png";
  return backgroundImage;
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

function localGap(notes: MelodyNote[], index: number) {
  const previous = index > 0 ? notes[index].time - notes[index - 1].time : Number.POSITIVE_INFINITY;
  const next = index < notes.length - 1 ? notes[index + 1].time - notes[index].time : Number.POSITIVE_INFINITY;
  const gap = Math.min(previous, next);
  return Number.isFinite(gap) ? Math.max(0.05, gap) : 0.38;
}

function forwardGap(notes: MelodyNote[], index: number) {
  if (index >= notes.length - 1) return localGap(notes, index);
  return Math.max(0.05, notes[index + 1].time - notes[index].time);
}

function platformWidthFor(notes: MelodyNote[], index: number) {
  const gap = forwardGap(notes, index);
  return clamp(112 + gap * 92 + notes[index].duration * 6, 118, 258);
}

function rollPhaseForGap(gap: number) {
  return clamp(MIN_ROLL_PHASE + gap * 0.18, MIN_ROLL_PHASE, 0.58);
}

function obstacleCountForGap(gap: number) {
  if (gap >= 1.35) return 2;
  if (gap >= 0.72) return 1;
  return 0;
}

function obstacleLiftAt(gap: number, rollProgress: number) {
  const count = obstacleCountForGap(gap);
  const phases = count === 2 ? [0.34, 0.66] : count === 1 ? [0.5] : [];
  return phases.reduce((lift, phase) => {
    const distance = Math.abs(rollProgress - phase);
    if (distance >= 0.16) return lift;
    return lift + Math.sin((1 - distance / 0.16) * Math.PI / 2) * 18;
  }, 0);
}

function releaseTiltForGap(gap: number) {
  return PLATFORM_RELEASE_TILT + clamp((gap - 0.5) * 0.055, 0, 0.07);
}

function geometry(notes: MelodyNote[], width: number) {
  const cached = geometryCache.get(notes);
  if (cached?.width === width) return cached;
  const xs: number[] = [];
  const left = width * 0.22;
  const right = width * 0.78;
  let x = left;
  let direction = 1;
  for (let index = 0; index < notes.length; index += 1) {
    xs.push(x);
    if (index >= notes.length - 1) continue;
    const gap = forwardGap(notes, index);
    const step = clamp(width * (0.11 + gap * 0.09), width * 0.12, width * 0.27);
    if (x + direction * step > right || x + direction * step < left) direction *= -1;
    x = clamp(x + direction * step, left, right);
  }
  const next = { width, xs };
  geometryCache.set(notes, next);
  return next;
}

function drawStudioBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  style: KineticStyle,
  cameraPosition: number,
) {
  const image = ensureBackground();
  if (image?.complete && image.naturalWidth > 0) {
    // Keep the studio wall moving with the camera at a slower parallax speed.
    // Alternating mirrored tiles meet at identical edges, so a long song can
    // scroll forever without the old one-platform jump or a visible hard cut.
    const travel = Math.max(0, cameraPosition) * TRACK_VERTICAL_GAP * BACKGROUND_PARALLAX;
    const baseTile = Math.floor(travel / height);
    const offset = travel - baseTile * height;
    for (let slot = -1; slot <= 1; slot += 1) {
      const worldTile = baseTile + slot;
      const y = slot * height - offset;
      if (Math.abs(worldTile) % 2 === 0) {
        context.drawImage(image, 0, y, width, height);
      } else {
        context.save();
        context.translate(0, y + height);
        context.scale(1, -1);
        context.drawImage(image, 0, 0, width, height);
        context.restore();
      }
    }
  } else {
    const fallback = context.createLinearGradient(0, 0, width, height);
    fallback.addColorStop(0, "#071a25");
    fallback.addColorStop(0.48, "#101424");
    fallback.addColorStop(1, "#19091a");
    context.fillStyle = fallback;
    context.fillRect(0, 0, width, height);
  }

  const glowColors = THEME_GLOW[style.theme];
  const pulse = 0.12 + Math.sin(time * 0.48) * 0.025;
  const ambient = context.createRadialGradient(width * 0.52, height * 0.58, 0, width * 0.52, height * 0.58, width * 0.62);
  ambient.addColorStop(0, `${glowColors[2]}${Math.round(pulse * 255).toString(16).padStart(2, "0")}`);
  ambient.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = ambient;
  context.fillRect(0, 0, width, height);

  const vignette = context.createRadialGradient(width / 2, height * 0.5, width * 0.12, width / 2, height * 0.5, width * 0.78);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,.62)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);

  const dustCount = Math.round(8 + style.meteorIntensity / 8);
  for (let index = 0; index < dustCount; index += 1) {
    const x = hash(index * 3.2) * width;
    const y = (hash(index * 8.1) * height + time * (2 + hash(index) * 5)) % height;
    context.fillStyle = `rgba(220,245,255,${0.08 + hash(index * 4.2) * 0.16})`;
    context.beginPath();
    context.arc(x, y, 0.5 + hash(index * 2.9) * 1.2, 0, Math.PI * 2);
    context.fill();
  }
}

function drawArm(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  scale: number,
  tilt: number,
  glow: string,
  isLit: boolean,
) {
  const anchorX = x + Math.sin(tilt) * width * 0.28;
  const anchorY = y + 60 * scale;
  context.save();
  context.strokeStyle = "rgba(3,6,12,.94)";
  context.shadowColor = "rgba(0,0,0,.9)";
  context.shadowBlur = 12;
  context.lineWidth = 12 * scale;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(anchorX, anchorY);
  context.lineTo(x, y + 8 * scale);
  context.stroke();
  context.shadowBlur = 0;
  context.fillStyle = "#070b13";
  context.beginPath();
  context.arc(anchorX, anchorY, 15 * scale, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = isLit ? `${glow}aa` : "rgba(83,96,116,.38)";
  context.lineWidth = 2 * scale;
  context.stroke();
  context.fillStyle = "rgba(255,255,255,.24)";
  context.beginPath();
  context.arc(anchorX - 4 * scale, anchorY - 5 * scale, 3.5 * scale, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawPlatform(
  context: CanvasRenderingContext2D,
  notes: MelodyNote[],
  index: number,
  x: number,
  baseY: number,
  scale: number,
  time: number,
  style: KineticStyle,
  exitDirection: number,
) {
  const note = notes[index];
  const gap = localGap(notes, index);
  const travelGap = forwardGap(notes, index);
  const rollPhase = rollPhaseForGap(travelGap);
  const timeToImpact = note.time - time;
  const anticipationWindow = clamp(gap * 0.92, 0.15, 0.62);
  const anticipation = timeToImpact > 0 && timeToImpact < anticipationWindow
    ? smoothstep(1 - timeToImpact / anticipationWindow)
    : 0;
  const impactAge = time - note.time;
  const recoil = impactAge >= 0 && impactAge < 0.42
    ? Math.sin(impactAge * 25) * Math.exp(-impactAge * 8)
    : 0;
  const idle = Math.sin(time * 1.25 + index * 1.73);
  const lift = idle * 3.2 + anticipation * 30 - recoil * 9;
  const nextImpactTime = index < notes.length - 1 ? notes[index + 1].time : note.time;
  const traversalDuration = Math.max(0.05, nextImpactTime - note.time);
  const traversalProgress = clamp((time - note.time) / traversalDuration, 0, 1);
  const settleAge = time - nextImpactTime;
  const releaseAmount = impactAge < 0 || index >= notes.length - 1
    ? 0
    : time < nextImpactTime
      ? smoothstep(clamp(traversalProgress / rollPhase, 0, 1))
      : settleAge < 0.34
        ? 1 - smoothstep(clamp(settleAge / 0.34, 0, 1))
        : 0;
  // Positive canvas rotation lowers the right edge; negative lowers the left.
  const tilt = exitDirection * releaseTiltForGap(travelGap) * releaseAmount + idle * 0.012 + recoil * 0.05;
  const y = baseY - lift;
  const colors = THEME_GLOW[style.theme];
  const glow = colors[index % colors.length];
  const plateWidth = platformWidthFor(notes, index) * scale;
  const plateHeight = 48 * scale;
  const sideDepth = 14 * scale;
  const hasBeenHit = impactAge >= 0;
  const isActive = impactAge >= 0 && impactAge < clamp(gap * 1.25, 0.16, 0.4);

  drawArm(context, x, y, plateWidth, scale, tilt, glow, hasBeenHit);

  context.save();
  context.translate(x, y);
  context.rotate(tilt);
  context.shadowColor = isActive ? glow : hasBeenHit ? `${glow}88` : "rgba(0,0,0,.76)";
  context.shadowBlur = isActive ? 38 : hasBeenHit ? 20 : 7;
  context.shadowOffsetY = 12 * scale;

  const side = context.createLinearGradient(0, plateHeight * 0.1, 0, plateHeight / 2 + sideDepth);
  side.addColorStop(0, hasBeenHit ? `${glow}9a` : "rgba(56,64,78,.78)");
  side.addColorStop(1, "rgba(4,7,13,.96)");
  context.fillStyle = side;
  roundedRect(context, -plateWidth / 2, -plateHeight / 2 + sideDepth, plateWidth, plateHeight, 13 * scale);
  context.fill();

  const top = context.createLinearGradient(-plateWidth / 2, -plateHeight / 2, plateWidth / 2, plateHeight / 2);
  top.addColorStop(0, isActive ? "#ffffff" : hasBeenHit ? `${glow}ef` : "rgba(104,113,130,.84)");
  top.addColorStop(0.36, isActive ? `${glow}` : hasBeenHit ? "rgba(232,238,246,.9)" : "rgba(61,69,83,.86)");
  top.addColorStop(1, isActive ? "#fff4ce" : hasBeenHit ? `${glow}a6` : "rgba(25,31,42,.94)");
  context.fillStyle = top;
  roundedRect(context, -plateWidth / 2, -plateHeight / 2, plateWidth, plateHeight, 13 * scale);
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = hasBeenHit ? "rgba(255,255,255,.58)" : "rgba(185,198,218,.18)";
  context.lineWidth = 1.5 * scale;
  context.stroke();

  context.fillStyle = "rgba(4,7,14,.72)";
  roundedRect(context, -13 * scale, -3.2 * scale, 26 * scale, 6.4 * scale, 3.2 * scale);
  context.fill();

  const obstacleCount = obstacleCountForGap(travelGap);
  for (let obstacle = 0; obstacle < obstacleCount; obstacle += 1) {
    const fraction = obstacleCount === 1 ? 0.2 : 0.13 + obstacle * 0.16;
    const obstacleX = exitDirection * plateWidth * fraction;
    context.shadowColor = hasBeenHit ? glow : "rgba(0,0,0,.8)";
    context.shadowBlur = hasBeenHit ? 13 : 4;
    context.fillStyle = hasBeenHit ? `${glow}d8` : "rgba(34,42,55,.96)";
    roundedRect(context, obstacleX - 12 * scale, -plateHeight / 2 - 10 * scale, 24 * scale, 13 * scale, 6 * scale);
    context.fill();
    context.strokeStyle = hasBeenHit ? "rgba(255,255,255,.64)" : "rgba(180,194,214,.2)";
    context.lineWidth = 1.2 * scale;
    context.stroke();
  }
  context.restore();

}

function ballPosition(notes: MelodyNote[], xs: number[], time: number, height: number) {
  const firstImpactTime = notes[0].time;
  if (firstImpactTime > 0.04 && time < firstImpactTime) {
    const initialFall = clamp(time / firstImpactTime, 0, 1);
    return {
      x: xs[0],
      y: height * TRACK_FOCUS_Y - BALL_CONTACT_OFFSET - (1 - initialFall * initialFall) * TRACK_VERTICAL_GAP,
      segment: { index: 0, progress: initialFall },
      cameraPosition: 0,
      trailProgress: initialFall,
      rotation: 0,
    };
  }
  const segment = segmentAt(notes, time);
  const nextIndex = Math.min(notes.length - 1, segment.index + 1);
  if (nextIndex === segment.index) {
    return {
      x: xs[segment.index],
      y: height * TRACK_FOCUS_Y - BALL_CONTACT_OFFSET,
      segment,
      cameraPosition: segment.index,
      trailProgress: 0,
      rotation: (xs[segment.index] - xs[0]) / BALL_RADIUS,
    };
  }

  const deltaX = xs[nextIndex] - xs[segment.index];
  const direction = Math.sign(deltaX) || (segment.index % 2 === 0 ? 1 : -1);
  const travelGap = forwardGap(notes, segment.index);
  const plateWidth = platformWidthFor(notes, segment.index);
  const departureDistance = clamp(
    plateWidth * 0.38,
    48,
    Math.min(96, Math.abs(deltaX) * 0.78),
  );
  const departureX = xs[segment.index] + direction * departureDistance;
  const rollPhase = rollPhaseForGap(travelGap);
  const rollProgress = clamp(segment.progress / rollPhase, 0, 1);
  const airProgress = clamp((segment.progress - rollPhase) / (1 - rollPhase), 0, 1);
  const rolledX = xs[segment.index] + direction * departureDistance * smoothstep(rollProgress);
  const x = segment.progress < rollPhase
    ? rolledX
    : departureX + (xs[nextIndex] - departureX) * airProgress;

  // The ball first rolls across the lit platform. Only after crossing its edge
  // does it enter a gravity-driven fall toward the next platform below.
  const edgeDrop = departureDistance * Math.sin(releaseTiltForGap(travelGap));
  const rollDrop = edgeDrop * Math.pow(smoothstep(rollProgress), 2);
  const obstacleLift = obstacleLiftAt(travelGap, rollProgress);
  const fallDistance = segment.progress < rollPhase
    ? rollDrop - obstacleLift
    : edgeDrop + (TRACK_VERTICAL_GAP - edgeDrop) * airProgress * airProgress;
  const fallProgress = fallDistance / TRACK_VERTICAL_GAP;
  // Follow the same gravity curve continuously instead of holding the camera
  // for most of a segment and snapping upward near the next impact. Obstacles
  // are deliberately excluded so their small upward arc remains visible.
  const edgeProgress = edgeDrop / TRACK_VERTICAL_GAP;
  const cameraProgress = segment.progress < rollPhase
    ? edgeProgress * Math.pow(smoothstep(rollProgress), 2)
    : edgeProgress + (1 - edgeProgress) * airProgress * airProgress;
  return {
    x,
    y: height * TRACK_FOCUS_Y - BALL_CONTACT_OFFSET + (fallProgress - cameraProgress) * TRACK_VERTICAL_GAP,
    segment,
    cameraPosition: segment.index + cameraProgress,
    trailProgress: airProgress,
    rotation: (x - xs[0]) / BALL_RADIUS,
  };
}

function drawGravityTrail(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  progress: number,
  color: string,
) {
  const strength = Math.sin(progress * Math.PI);
  if (strength <= 0.04) return;
  const trail = context.createLinearGradient(0, y - 86, 0, y - 20);
  trail.addColorStop(0, "rgba(255,255,255,0)");
  trail.addColorStop(0.55, `${color}32`);
  trail.addColorStop(1, `${color}${Math.round(strength * 150).toString(16).padStart(2, "0")}`);
  context.save();
  context.globalCompositeOperation = "lighter";
  context.strokeStyle = trail;
  context.lineCap = "round";
  context.shadowColor = color;
  context.shadowBlur = 15;
  for (let streak = -1; streak <= 1; streak += 1) {
    context.globalAlpha = streak === 0 ? strength : strength * 0.45;
    context.lineWidth = streak === 0 ? 6 : 2;
    context.beginPath();
    context.moveTo(x + streak * 13, y - 82 + Math.abs(streak) * 18);
    context.lineTo(x + streak * 6, y - 27);
    context.stroke();
  }
  context.restore();
}

function drawGlassBall(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  segment: Segment,
  time: number,
  color: string,
  rotation: number,
  ballSize: number,
) {
  const ballScale = clamp(ballSize / 100, 0.6, 1.6);
  const contactDistance = Math.min(segment.progress, 1 - segment.progress);
  const contact = 1 - smoothstep(clamp(contactDistance / 0.12, 0, 1));
  const radiusX = (34 + contact * 4) * ballScale;
  const radiusY = (36 - contact * 7) * ballScale;

  context.save();
  context.globalCompositeOperation = "lighter";
  context.shadowColor = color;
  context.shadowBlur = 42 * ballScale;
  const outer = context.createRadialGradient(
    x - 12 * ballScale,
    y - 15 * ballScale,
    3 * ballScale,
    x,
    y,
    39 * ballScale,
  );
  outer.addColorStop(0, "rgba(255,255,255,.98)");
  outer.addColorStop(0.18, "rgba(222,252,255,.82)");
  outer.addColorStop(0.5, `${color}98`);
  outer.addColorStop(0.78, "rgba(28,18,55,.64)");
  outer.addColorStop(1, `${color}e8`);
  context.fillStyle = outer;
  context.beginPath();
  context.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = "rgba(255,255,255,.78)";
  context.lineWidth = 2.2 * ballScale;
  context.stroke();

  context.strokeStyle = "rgba(255,255,255,.34)";
  context.lineWidth = 5 * ballScale;
  context.beginPath();
  context.arc(x + 2 * ballScale, y + ballScale, 23 * ballScale, -1.15 + rotation + Math.sin(time) * 0.04, 1.6 + rotation + Math.sin(time) * 0.04);
  context.stroke();
  context.strokeStyle = `${color}bb`;
  context.lineWidth = 7 * ballScale;
  context.beginPath();
  context.arc(x, y, 18 * ballScale, 1.3 + rotation, 4.8 + rotation);
  context.stroke();
  context.strokeStyle = "rgba(255,255,255,.58)";
  context.lineWidth = 2.2 * ballScale;
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x + Math.cos(rotation) * 18 * ballScale, y + Math.sin(rotation) * 18 * ballScale);
  context.stroke();
  context.restore();
}

function drawImpact(
  context: CanvasRenderingContext2D,
  note: MelodyNote,
  index: number,
  x: number,
  y: number,
  time: number,
  color: string,
  style: KineticStyle,
) {
  const age = time - note.time;
  const impactEffect = style.impactEffect;
  const lifetime = impactEffect === "cartoon"
    ? 0.34
    : impactLifetime(impactEffect as UniversalImpactEffect);
  if (age < 0 || age > lifetime) return;
  if (impactEffect !== "cartoon") {
    drawUniversalImpactEffect(context, impactEffect, {
      x,
      y,
      age,
      lifetime,
      seed: index + 101,
      primary: color,
      secondary: index % 2 ? "#ff62c6" : "#68efff",
      intensity: style.impactIntensity,
      scale: 0.82,
    });
    return;
  }
  const progress = age / lifetime;
  const fade = Math.pow(1 - progress, 1.6);
  const count = Math.round(5 + style.impactIntensity / 12);
  context.save();
  context.globalCompositeOperation = "lighter";
  context.strokeStyle = `${color}${Math.round(fade * 220).toString(16).padStart(2, "0")}`;
  context.lineWidth = 3 * fade;
  context.shadowColor = color;
  context.shadowBlur = 20;
  context.beginPath();
  context.ellipse(x, y, 28 + progress * 58, 14 + progress * 31, 0, 0, Math.PI * 2);
  context.stroke();
  for (let particle = 0; particle < count; particle += 1) {
    const angle = hash(index * 17 + particle * 7.3) * Math.PI * 2;
    const distance = (18 + hash(particle * 4.7) * 62) * Math.sin(progress * Math.PI);
    const px = x + Math.cos(angle) * distance;
    const py = y + Math.sin(angle) * distance - Math.sin(progress * Math.PI) * 18;
    context.fillStyle = particle % 2 ? color : "#fff7bd";
    const size = 1.5 + hash(particle) * 2.8;
    context.save();
    context.translate(px, py);
    context.rotate(angle + progress * 4);
    context.fillRect(-size * 1.8, -size * 0.55, size * 3.6, size * 1.1);
    context.restore();
  }
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
    const shade = context.createLinearGradient(0, 0, 0, 150);
    shade.addColorStop(0, "rgba(2,5,10,.76)");
    shade.addColorStop(1, "rgba(2,5,10,0)");
    context.fillStyle = shade;
    context.fillRect(0, 0, width, 155);
    context.fillStyle = "rgba(255,255,255,.97)";
    context.font = "700 17px ui-sans-serif, -apple-system, sans-serif";
    context.textAlign = "left";
    context.fillText("ORBITONE · KINETIC STUDIO", 28, 43);
    context.fillStyle = "rgba(255,255,255,.7)";
    context.font = "600 12px ui-monospace, monospace";
    context.fillText(`${String(currentIndex + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}  ·  GRAVITY DROP`, 28, 67);
  }

  const progress = clamp(time / Math.max(0.1, duration), 0, 1);
  context.fillStyle = "rgba(255,255,255,.12)";
  roundedRect(context, 28, height - 36, width - 56, 4, 2);
  context.fill();
  const bar = context.createLinearGradient(28, 0, width - 28, 0);
  bar.addColorStop(0, "#72ffc0");
  bar.addColorStop(0.5, "#7efcff");
  bar.addColorStop(1, "#ff7bc8");
  context.fillStyle = bar;
  roundedRect(context, 28, height - 36, (width - 56) * progress, 4, 2);
  context.fill();
}

export function renderKineticMusicBox(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  notes: MelodyNote[],
  duration: number,
  style: KineticStyle,
) {
  const safeNotes = notes.length
    ? notes
    : [{ time: 0, duration: 1, pitch: 60, confidence: 1, velocity: 1 }];
  const { xs } = geometry(safeNotes, width);
  const ball = ballPosition(safeNotes, xs, time, height);
  const colors = THEME_GLOW[style.theme];
  context.clearRect(0, 0, width, height);
  drawStudioBackground(context, width, height, time, style, ball.cameraPosition);

  const start = Math.max(0, ball.segment.index - 7);
  const end = Math.min(safeNotes.length - 1, ball.segment.index + 4);
  const focusY = height * TRACK_FOCUS_Y;

  for (let index = start; index <= end; index += 1) {
    const relative = index - ball.cameraPosition;
    // Larger indices are later in the song and lower in the world. The plus
    // sign is intentional: upcoming platforms must enter from below, never
    // from above as they did in the old bottom-to-top layout.
    const y = focusY + relative * TRACK_VERTICAL_GAP;
    if (y < -100 || y > height + 110) continue;
    const scale = clamp(1 + relative * 0.035, 0.64, 1.16);
    const nextIndex = Math.min(safeNotes.length - 1, index + 1);
    const exitDirection = nextIndex === index
      ? 0
      : Math.sign(xs[nextIndex] - xs[index]);
    drawPlatform(context, safeNotes, index, xs[index], y, scale, time, style, exitDirection);
  }

  const currentPlatformY = focusY + (ball.segment.index - ball.cameraPosition) * TRACK_VERTICAL_GAP;
  drawImpact(
    context,
    safeNotes[ball.segment.index],
    ball.segment.index,
    xs[ball.segment.index],
    currentPlatformY,
    time,
    colors[ball.segment.index % colors.length],
    style,
  );
  drawGravityTrail(context, ball.x, ball.y, ball.trailProgress, colors[ball.segment.index % colors.length]);
  drawGlassBall(
    context,
    ball.x,
    ball.y,
    ball.segment,
    time,
    colors[ball.segment.index % colors.length],
    ball.rotation,
    style.ballSize,
  );
  drawHud(context, width, height, time, duration, ball.segment.index, safeNotes.length, style.showSceneText);
}
