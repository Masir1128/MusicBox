import type { MelodyNote } from "./melodyAnalyzer";

export type LabelMode = "solfege" | "note" | "symbol";
export type SceneTheme = "nebula" | "aurora" | "solar";
export type ImpactEffect = "firework" | "cartoon" | "neon";

export type VisualStyle = {
  labelMode: LabelMode;
  theme: SceneTheme;
  meteorIntensity: number;
  impactEffect: ImpactEffect;
  impactIntensity: number;
};

type Point = { x: number; y: number; pitch: number; index: number };

const pointCache = new WeakMap<MelodyNote[], { width: number; points: Point[] }>();

const PALETTES = {
  nebula: {
    top: "#050817",
    bottom: "#190626",
    nebulaA: "rgba(91, 64, 255, .28)",
    nebulaB: "rgba(255, 55, 178, .20)",
    rail: "#63e9ff",
    ballA: "#fff8d0",
    ballB: "#ff7a2d",
  },
  aurora: {
    top: "#021418",
    bottom: "#07102b",
    nebulaA: "rgba(0, 255, 190, .25)",
    nebulaB: "rgba(55, 129, 255, .24)",
    rail: "#7fffd4",
    ballA: "#efffff",
    ballB: "#52ffc8",
  },
  solar: {
    top: "#160807",
    bottom: "#280817",
    nebulaA: "rgba(255, 98, 0, .28)",
    nebulaB: "rgba(255, 34, 103, .20)",
    rail: "#ffbb55",
    ballA: "#fff8c6",
    ballB: "#ff4d27",
  },
} as const;

const PAD_COLORS = ["#6be7ff", "#9778ff", "#ff74bd", "#ffc15c", "#66f0b0"];
const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const SOLFEGE = ["DO", "DI", "RE", "RI", "MI", "FA", "FI", "SOL", "SI", "LA", "LI", "TI"];
const SYMBOLS = ["●", "◆", "✦", "▲", "■", "✧", "◇", "★", "✣", "▲", "●", "✹"];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const smoothstep = (value: number) => value * value * (3 - 2 * value);
const hash = (value: number) => {
  const x = Math.sin(value * 91.733 + 17.13) * 43758.5453;
  return x - Math.floor(x);
};

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

function labelForPitch(pitch: number, mode: LabelMode): string {
  const pitchClass = ((Math.round(pitch) % 12) + 12) % 12;
  if (mode === "symbol") return SYMBOLS[pitchClass];
  if (mode === "solfege") return SOLFEGE[pitchClass];
  return `${NOTE_NAMES[pitchClass]}${Math.floor(pitch / 12) - 1}`;
}

function createPoints(notes: MelodyNote[], width: number): Point[] {
  if (!notes.length) return [{ x: width / 2, y: 0, pitch: 60, index: 0 }];
  const cached = pointCache.get(notes);
  if (cached?.width === width) return cached.points;
  const averagePitch = notes.reduce((sum, note) => sum + note.pitch, 0) / notes.length;
  const points = notes.map((note, index) => ({
    x: clamp(
      width / 2 + Math.sin(index * 1.47) * width * 0.16 + (note.pitch - averagePitch) * 7.6,
      width * 0.20,
      width * 0.80,
    ),
    y: index * 132,
    pitch: note.pitch,
    index,
  }));
  pointCache.set(notes, { width, points });
  return points;
}

function segmentAt(notes: MelodyNote[], time: number): { index: number; progress: number } {
  if (notes.length <= 1) return { index: 0, progress: 0 };
  if (time <= notes[0].time) return { index: 0, progress: 0 };
  if (time >= notes.at(-1)!.time) return { index: notes.length - 1, progress: 0 };

  // Long tracks previously scanned every note for the ball and each trail dot
  // on every frame. Binary search keeps dense full-speed playback stable.
  let low = 0;
  let high = notes.length - 1;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (notes[middle].time <= time) low = middle;
    else high = middle;
  }
  const start = notes[low].time;
  const end = notes[low + 1].time;
  return { index: low, progress: clamp((time - start) / Math.max(0.05, end - start), 0, 1) };
}

function localNoteGap(notes: MelodyNote[], index: number) {
  const previousGap = index > 0 ? notes[index].time - notes[index - 1].time : Number.POSITIVE_INFINITY;
  const nextGap = index < notes.length - 1 ? notes[index + 1].time - notes[index].time : Number.POSITIVE_INFINITY;
  const gap = Math.min(previousGap, nextGap);
  return Number.isFinite(gap) ? Math.max(0.05, gap) : 0.34;
}

function pointValue(point: Point, axis: "x" | "y") {
  return axis === "x" ? point.x : point.y;
}

function trackTangent(notes: MelodyNote[], points: Point[], index: number, axis: "x" | "y") {
  if (points.length <= 1) return 0;
  const currentValue = pointValue(points[index], axis);
  if (index === 0) {
    return (pointValue(points[1], axis) - currentValue) /
      Math.max(0.05, notes[1].time - notes[0].time);
  }
  if (index >= points.length - 1) {
    return (currentValue - pointValue(points[index - 1], axis)) /
      Math.max(0.05, notes[index].time - notes[index - 1].time);
  }

  const leftDuration = Math.max(0.05, notes[index].time - notes[index - 1].time);
  const rightDuration = Math.max(0.05, notes[index + 1].time - notes[index].time);
  const leftSlope = (currentValue - pointValue(points[index - 1], axis)) / leftDuration;
  const rightSlope = (pointValue(points[index + 1], axis) - currentValue) / rightDuration;
  // A shape-preserving harmonic tangent keeps velocity continuous without
  // overshooting the track when adjacent notes reverse direction.
  if (leftSlope === 0 || rightSlope === 0 || leftSlope * rightSlope <= 0) return 0;
  const weightLeft = 2 * rightDuration + leftDuration;
  const weightRight = rightDuration + 2 * leftDuration;
  return (weightLeft + weightRight) /
    (weightLeft / leftSlope + weightRight / rightSlope);
}

function inertialTrackValue(
  notes: MelodyNote[],
  points: Point[],
  segmentIndex: number,
  progress: number,
  axis: "x" | "y",
) {
  const nextIndex = Math.min(points.length - 1, segmentIndex + 1);
  if (nextIndex === segmentIndex) return pointValue(points[segmentIndex], axis);
  const start = pointValue(points[segmentIndex], axis);
  const end = pointValue(points[nextIndex], axis);
  const duration = Math.max(0.05, notes[nextIndex].time - notes[segmentIndex].time);
  const startTangent = trackTangent(notes, points, segmentIndex, axis) * duration;
  const endTangent = trackTangent(notes, points, nextIndex, axis) * duration;
  const t = clamp(progress, 0, 1);
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * start +
    (t3 - 2 * t2 + t) * startTangent +
    (-2 * t3 + 3 * t2) * end +
    (t3 - t2) * endTangent;
}

function ballAt(notes: MelodyNote[], points: Point[], time: number, height: number) {
  const segment = segmentAt(notes, time);
  const current = points[segment.index];
  const next = points[Math.min(points.length - 1, segment.index + 1)];
  const nextNoteIndex = Math.min(notes.length - 1, segment.index + 1);
  const segmentDuration = Math.max(0.05, notes[nextNoteIndex].time - notes[segment.index].time);
  const worldY = inertialTrackValue(notes, points, segment.index, segment.progress, "y");
  const cameraY = worldY;
  const speedScale = clamp(segmentDuration / 0.34, 0.58, 1.06);
  const jumpHeight = Math.min(190, (112 + (next.y - current.y) * 0.32) * speedScale);
  const jump = Math.pow(Math.sin(Math.PI * segment.progress), 0.92) * jumpHeight;
  return {
    x: inertialTrackValue(notes, points, segment.index, segment.progress, "x"),
    y: height * 0.69 - jump,
    cameraY,
    segment,
  };
}

function drawBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  style: VisualStyle,
) {
  const palette = PALETTES[style.theme];
  const background = context.createLinearGradient(0, 0, 0, height);
  background.addColorStop(0, palette.top);
  background.addColorStop(1, palette.bottom);
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  const nebulaX = width * (0.36 + Math.sin(time * 0.08) * 0.09);
  const nebulaA = context.createRadialGradient(nebulaX, height * 0.28, 0, nebulaX, height * 0.28, width * 0.72);
  nebulaA.addColorStop(0, palette.nebulaA);
  nebulaA.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = nebulaA;
  context.fillRect(0, 0, width, height);
  const nebulaB = context.createRadialGradient(width * 0.72, height * 0.72, 0, width * 0.72, height * 0.72, width * 0.62);
  nebulaB.addColorStop(0, palette.nebulaB);
  nebulaB.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = nebulaB;
  context.fillRect(0, 0, width, height);

  for (let index = 0; index < 92; index += 1) {
    const x = hash(index * 2.31) * width;
    const y = (hash(index * 7.19) * height + time * (3 + hash(index) * 7)) % height;
    const radius = 0.45 + hash(index * 5.7) * 1.35;
    const twinkle = 0.28 + Math.sin(time * (0.9 + hash(index) * 1.8) + index) * 0.18;
    context.fillStyle = `rgba(210,235,255,${twinkle})`;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  const meteorCount = Math.round(2 + style.meteorIntensity / 14);
  context.lineCap = "round";
  for (let index = 0; index < meteorCount; index += 1) {
    const cycle = 2.4 + hash(index * 4.1) * 3.4;
    const phase = ((time + hash(index * 8.7) * cycle) % cycle) / cycle;
    if (phase > 0.45) continue;
    const travel = phase / 0.45;
    const startX = hash(index * 3.11) * width * 1.25 - width * 0.12;
    const startY = -height * 0.14 + hash(index * 9.2) * height * 0.38;
    const x = startX - travel * width * 0.62;
    const y = startY + travel * height * 0.54;
    const length = 46 + hash(index * 1.7) * 110;
    const gradient = context.createLinearGradient(x, y, x + length * 0.72, y - length);
    gradient.addColorStop(0, "rgba(111,232,255,0)");
    gradient.addColorStop(0.7, `rgba(130,238,255,${0.48 * (1 - travel)})`);
    gradient.addColorStop(1, `rgba(255,255,255,${0.95 * (1 - travel)})`);
    context.strokeStyle = gradient;
    context.lineWidth = 2.2;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + length * 0.72, y - length);
    context.stroke();
  }
}

function projectedY(point: Point, cameraY: number, height: number) {
  return height * 0.69 - (point.y - cameraY);
}

function drawRail(
  context: CanvasRenderingContext2D,
  points: Point[],
  cameraY: number,
  width: number,
  height: number,
  currentIndex: number,
  color: string,
) {
  const start = Math.max(0, currentIndex - 4);
  const end = Math.min(points.length - 1, currentIndex + 11);
  if (end <= start) return;
  context.save();
  context.shadowColor = color;
  context.shadowBlur = 18;
  context.strokeStyle = color;
  context.lineWidth = 5;
  context.globalAlpha = 0.84;
  context.beginPath();
  for (let index = start; index <= end; index += 1) {
    const point = points[index];
    const y = projectedY(point, cameraY, height);
    if (index === start) context.moveTo(point.x, y);
    else {
      const previous = points[index - 1];
      const previousY = projectedY(previous, cameraY, height);
      const midY = (previousY + y) / 2;
      context.bezierCurveTo(previous.x, midY, point.x, midY, point.x, y);
    }
  }
  context.stroke();
  context.restore();

  const horizon = context.createLinearGradient(0, height * 0.08, 0, height * 0.52);
  horizon.addColorStop(0, "rgba(0,0,0,.8)");
  horizon.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = horizon;
  context.fillRect(0, 0, width, height * 0.54);
}

function drawPads(
  context: CanvasRenderingContext2D,
  notes: MelodyNote[],
  points: Point[],
  time: number,
  cameraY: number,
  width: number,
  height: number,
  currentIndex: number,
  style: VisualStyle,
) {
  const start = Math.max(0, currentIndex - 4);
  const end = Math.min(points.length - 1, currentIndex + 11);
  for (let index = end; index >= start; index -= 1) {
    const point = points[index];
    const relative = point.y - cameraY;
    const y = projectedY(point, cameraY, height);
    if (y < -100 || y > height + 110) continue;
    const scale = clamp(1 - relative / 1_600, 0.5, 1.16);
    const padWidth = (174 + Math.min(58, notes[index].duration * 24)) * scale;
    const padHeight = 57 * scale;
    const x = point.x - padWidth / 2;
    const top = y - padHeight / 2;
    const impactAge = time - notes[index].time;
    const activeLifetime = clamp(localNoteGap(notes, index) * 1.4, 0.16, 0.42);
    const active = impactAge >= -0.018 && impactAge < activeLifetime;
    const color = PAD_COLORS[index % PAD_COLORS.length];

    context.save();
    if (active) {
      context.shadowColor = color;
      context.shadowBlur = 42;
    } else {
      context.shadowColor = "rgba(0,0,0,.75)";
      context.shadowBlur = 18;
    }
    context.shadowOffsetY = 12 * scale;
    const gradient = context.createLinearGradient(x, top, x + padWidth, top + padHeight);
    gradient.addColorStop(0, active ? "#ffffff" : color);
    gradient.addColorStop(0.38, active ? color : `${color}e8`);
    gradient.addColorStop(1, active ? "#fff7cb" : `${color}a8`);
    context.fillStyle = gradient;
    roundedRect(context, x, top, padWidth, padHeight, 15 * scale);
    context.fill();
    context.shadowColor = "transparent";
    context.strokeStyle = "rgba(255,255,255,.32)";
    context.lineWidth = 1.3;
    context.stroke();
    if (active) {
      context.globalCompositeOperation = "lighter";
      const lampGlow = context.createRadialGradient(point.x, y, 1, point.x, y, padHeight * 0.68);
      lampGlow.addColorStop(0, "rgba(255,255,255,.98)");
      lampGlow.addColorStop(0.24, "rgba(255,242,157,.92)");
      lampGlow.addColorStop(0.58, `${color}b8`);
      lampGlow.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = lampGlow;
      context.beginPath();
      context.ellipse(point.x, y, padHeight * 0.72, padHeight * 0.48, 0, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = "rgba(255,249,210,.9)";
      context.lineWidth = 2.2 * scale;
      context.beginPath();
      context.moveTo(point.x - padHeight * 0.2, y - padHeight * 0.38);
      context.lineTo(point.x + padHeight * 0.2, y - padHeight * 0.38);
      context.moveTo(point.x - padHeight * 0.24, y + padHeight * 0.38);
      context.lineTo(point.x + padHeight * 0.24, y + padHeight * 0.38);
      context.stroke();
    } else {
      context.fillStyle = "rgba(4,8,25,.90)";
      const fontSize = style.labelMode === "symbol" ? 29 : 23;
      context.font = `800 ${fontSize * scale}px ui-sans-serif, -apple-system, BlinkMacSystemFont, sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(labelForPitch(point.pitch, style.labelMode), point.x, y + 1);
    }
    context.restore();

    if (active) {
      const ringProgress = clamp((impactAge + 0.018) / activeLifetime, 0, 1);
      context.save();
      context.shadowColor = color;
      context.shadowBlur = 28;
      for (let ring = 0; ring < 3; ring += 1) {
        context.strokeStyle = `rgba(255,255,255,${(1 - ringProgress) * (0.92 - ring * 0.18)})`;
        context.lineWidth = (4 - ring * 0.75) * (1 - ringProgress * 0.45);
        context.beginPath();
        context.ellipse(
          point.x,
          y,
          padWidth * (0.29 + ringProgress * (0.27 + ring * 0.12)),
          padHeight * (0.42 + ringProgress * (0.72 + ring * 0.28)),
          0,
          0,
          Math.PI * 2,
        );
        context.stroke();
      }
      context.restore();
    }
  }
}

function starPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  outerRadius: number,
  innerRadius: number,
  rotation: number,
) {
  context.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const angle = rotation - Math.PI / 2 + (point * Math.PI) / 5;
    const radius = point % 2 === 0 ? outerRadius : innerRadius;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (point === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  }
  context.closePath();
}

function drawImpactEffects(
  context: CanvasRenderingContext2D,
  notes: MelodyNote[],
  points: Point[],
  time: number,
  cameraY: number,
  height: number,
  currentIndex: number,
  style: VisualStyle,
) {
  const intensity = clamp(style.impactIntensity / 100, 0, 1);
  const start = Math.max(0, currentIndex - 2);
  const end = Math.min(points.length - 1, currentIndex);

  for (let noteIndex = start; noteIndex <= end; noteIndex += 1) {
    const age = time - notes[noteIndex].time;
    const noteGap = localNoteGap(notes, noteIndex);
    const effectLifetime = clamp(noteGap * 1.65, 0.22, 0.72);
    if (age < 0 || age > effectLifetime) continue;
    const progress = age / effectLifetime;
    const densityScale = 0.45 + clamp((noteGap - 0.1) / 0.25, 0, 1) * 0.55;
    const particleCount = Math.round((8 + intensity * 22) * densityScale);
    const point = points[noteIndex];
    const x = point.x;
    const y = projectedY(point, cameraY, height);
    const color = PAD_COLORS[noteIndex % PAD_COLORS.length];
    const energy = 0.62 + notes[noteIndex].velocity * 0.7;
    const fade = Math.pow(1 - progress, 1.5);

    context.save();
    context.globalCompositeOperation = "lighter";
    const flash = context.createRadialGradient(x, y, 0, x, y, 110 * energy * (0.45 + progress));
    flash.addColorStop(0, `rgba(255,255,255,${fade * 0.9})`);
    flash.addColorStop(0.18, `${color}${Math.round(fade * 210).toString(16).padStart(2, "0")}`);
    flash.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = flash;
    context.fillRect(x - 130, y - 130, 260, 260);

    // Every landing gets a pure animation cue: expanding neon rings and a
    // small star burst. No words or emoji are painted over the music block.
    context.strokeStyle = color;
    context.shadowColor = color;
    context.shadowBlur = 24;
    context.lineWidth = Math.max(1, 4 * fade);
    for (let ring = 0; ring < 2; ring += 1) {
      context.beginPath();
      context.ellipse(x, y, 24 + progress * (64 + ring * 42), 13 + progress * (38 + ring * 29), 0, 0, Math.PI * 2);
      context.stroke();
    }
    const starCount = Math.round(5 + intensity * 8);
    for (let star = 0; star < starCount; star += 1) {
      const angle = hash(noteIndex * 41 + star * 8.3) * Math.PI * 2;
      const distance = (24 + hash(star * 5.9) * 98) * Math.sin(progress * Math.PI * 0.88) * energy;
      const starX = x + Math.cos(angle) * distance;
      const starY = y + Math.sin(angle) * distance;
      context.fillStyle = star % 3 === 0 ? "#fff7a6" : star % 3 === 1 ? "#7efcff" : "#ff8bd0";
      starPath(context, starX, starY, 5 + intensity * 4.5, 2.2 + intensity * 1.8, age * 5 + star);
      context.fill();
    }

    if (style.impactEffect === "neon") {
      context.strokeStyle = color;
      context.shadowColor = color;
      context.shadowBlur = 20;
      context.lineWidth = 3.5 * fade;
      for (let ring = 0; ring < 3; ring += 1) {
        context.beginPath();
        context.arc(x, y, 20 + progress * (70 + ring * 36), 0, Math.PI * 2);
        context.stroke();
      }
      for (let particle = 0; particle < particleCount; particle += 1) {
        const angle = hash(noteIndex * 31 + particle * 7.3) * Math.PI * 2;
        const distance = (24 + hash(particle * 4.1) * 92) * progress * energy;
        context.lineWidth = 1 + hash(particle) * 3;
        context.beginPath();
        context.moveTo(x + Math.cos(angle) * distance * 0.55, y + Math.sin(angle) * distance * 0.55);
        context.lineTo(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance);
        context.stroke();
      }
    } else if (style.impactEffect === "firework") {
      const colors = [color, "#fff176", "#ff79c6", "#7efcff", "#a98bff"];
      for (let particle = 0; particle < particleCount; particle += 1) {
        const angle = hash(noteIndex * 19 + particle * 5.17) * Math.PI * 2;
        const speed = 65 + hash(particle * 3.8) * 135;
        const distance = speed * age * energy;
        const px = x + Math.cos(angle) * distance;
        const py = y + Math.sin(angle) * distance + age * age * 72;
        const previousX = x + Math.cos(angle) * Math.max(0, distance - 18);
        const previousY = y + Math.sin(angle) * Math.max(0, distance - 18) + age * age * 62;
        context.strokeStyle = `${colors[particle % colors.length]}${Math.round(fade * 255).toString(16).padStart(2, "0")}`;
        context.lineWidth = 1.5 + hash(particle * 2.4) * 2.5;
        context.beginPath();
        context.moveTo(previousX, previousY);
        context.lineTo(px, py);
        context.stroke();
        context.fillStyle = colors[particle % colors.length];
        context.beginPath();
        context.arc(px, py, 1.5 + intensity * 2.3, 0, Math.PI * 2);
        context.fill();
      }
    } else {
      const colors = ["#fff176", "#ff79c6", "#7efcff", "#a98bff", "#ff9f43"];
      for (let particle = 0; particle < Math.round(particleCount * 0.72); particle += 1) {
        const angle = hash(noteIndex * 23 + particle * 9.1) * Math.PI * 2;
        const distance = (38 + hash(particle * 6.7) * 105) * Math.sin(progress * Math.PI * 0.82) * energy;
        const px = x + Math.cos(angle) * distance;
        const py = y + Math.sin(angle) * distance - Math.sin(progress * Math.PI) * 28;
        context.fillStyle = colors[particle % colors.length];
        if (particle % 3 === 0) {
          starPath(context, px, py, 7 + intensity * 5, 3 + intensity * 2, age * 5 + particle);
          context.fill();
        } else {
          context.save();
          context.translate(px, py);
          context.rotate(angle + age * 4);
          context.fillRect(-4, -2, 8 + intensity * 5, 4);
          context.restore();
        }
      }
    }
    context.restore();
  }
}

function drawBall(
  context: CanvasRenderingContext2D,
  notes: MelodyNote[],
  points: Point[],
  time: number,
  width: number,
  height: number,
  style: VisualStyle,
) {
  const palette = PALETTES[style.theme];
  const currentSegment = segmentAt(notes, time);
  const currentGap = localNoteGap(notes, currentSegment.index);
  const trailCount = currentGap < 0.18 ? 4 : 7;
  const trailStep = currentGap < 0.18 ? 0.022 : 0.035;
  for (let trail = trailCount; trail >= 1; trail -= 1) {
    const past = ballAt(notes, points, Math.max(0, time - trail * trailStep), height);
    const alpha = (1 - trail / (trailCount + 1)) * 0.18;
    context.fillStyle = `rgba(255,178,89,${alpha})`;
    context.beginPath();
    context.arc(past.x, past.y, 25 - trail * 1.7, 0, Math.PI * 2);
    context.fill();
  }
  const ball = ballAt(notes, points, time, height);
  const landingDistance = Math.min(ball.segment.progress, 1 - ball.segment.progress);
  const landing = 1 - smoothstep(clamp(landingDistance / 0.13, 0, 1));
  const radiusX = 27 + landing * 4;
  const radiusY = 29 - landing * 6;
  context.save();
  context.shadowColor = palette.ballB;
  context.shadowBlur = 44;
  const gradient = context.createRadialGradient(ball.x - 9, ball.y - 12, 3, ball.x, ball.y, 36);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.26, palette.ballA);
  gradient.addColorStop(1, palette.ballB);
  context.fillStyle = gradient;
  context.beginPath();
  context.ellipse(ball.x, ball.y, radiusX, radiusY, 0, 0, Math.PI * 2);
  context.fill();
  context.shadowBlur = 0;
  context.fillStyle = "rgba(255,255,255,.7)";
  context.beginPath();
  context.ellipse(ball.x - 9, ball.y - 9, 5, 8, -0.7, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawHud(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  duration: number,
  notes: MelodyNote[],
  currentIndex: number,
) {
  context.save();
  const topShade = context.createLinearGradient(0, 0, 0, 170);
  topShade.addColorStop(0, "rgba(2,4,14,.82)");
  topShade.addColorStop(1, "rgba(2,4,14,0)");
  context.fillStyle = topShade;
  context.fillRect(0, 0, width, 180);
  context.fillStyle = "rgba(255,255,255,.76)";
  context.font = "600 18px ui-sans-serif, -apple-system, sans-serif";
  context.textAlign = "left";
  context.fillText("ORBITONE  ·  MELODY 01", 30, 46);
  context.fillStyle = "rgba(255,255,255,.38)";
  context.font = "500 14px ui-monospace, monospace";
  context.fillText(`${String(currentIndex + 1).padStart(2, "0")} / ${String(notes.length).padStart(2, "0")}`, 30, 72);
  context.textAlign = "right";
  context.fillStyle = "rgba(255,255,255,.7)";
  context.font = "600 15px ui-sans-serif, -apple-system, sans-serif";
  context.fillText("开发者：科学羊", width - 30, 46);
  context.fillStyle = "rgba(255,255,255,.34)";
  context.font = "500 11px ui-sans-serif, -apple-system, sans-serif";
  context.fillText("来源：科学羊原创实验项目", width - 30, 68);

  const progress = clamp(time / Math.max(0.1, duration), 0, 1);
  context.fillStyle = "rgba(255,255,255,.15)";
  roundedRect(context, 30, height - 38, width - 60, 4, 2);
  context.fill();
  const progressGradient = context.createLinearGradient(30, 0, width - 30, 0);
  progressGradient.addColorStop(0, "#64eaff");
  progressGradient.addColorStop(1, "#ff74bd");
  context.fillStyle = progressGradient;
  roundedRect(context, 30, height - 38, (width - 60) * progress, 4, 2);
  context.fill();
  context.restore();
}

export function renderMusicBox(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  notes: MelodyNote[],
  duration: number,
  style: VisualStyle,
) {
  const safeNotes = notes.length
    ? notes
    : [{ time: 0, duration: 1, pitch: 60, confidence: 1, velocity: 1 }];
  const points = createPoints(safeNotes, width);
  const ball = ballAt(safeNotes, points, time, height);
  const palette = PALETTES[style.theme];
  context.clearRect(0, 0, width, height);
  drawBackground(context, width, height, time, style);
  drawRail(context, points, ball.cameraY, width, height, ball.segment.index, palette.rail);
  drawPads(context, safeNotes, points, time, ball.cameraY, width, height, ball.segment.index, style);
  drawImpactEffects(context, safeNotes, points, time, ball.cameraY, height, ball.segment.index, style);
  drawBall(context, safeNotes, points, time, width, height, style);
  drawHud(context, width, height, time, duration, safeNotes, ball.segment.index);
}
