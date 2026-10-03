export type UniversalImpactEffect = "firework" | "neon" | "explosion" | "shatter" | "lightning" | "prismatic";

type ImpactOptions = {
  x: number;
  y: number;
  age: number;
  lifetime: number;
  seed: number;
  primary: string;
  secondary: string;
  intensity: number;
  scale?: number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const hash = (value: number) => {
  const x = Math.sin(value * 91.733 + 17.13) * 43758.5453;
  return x - Math.floor(x);
};

function starPath(context: CanvasRenderingContext2D, x: number, y: number, outer: number, inner: number, rotation: number) {
  context.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const angle = rotation - Math.PI / 2 + point * Math.PI / 5;
    const radius = point % 2 === 0 ? outer : inner;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (point === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  }
  context.closePath();
}

export function impactLifetime(effect: UniversalImpactEffect) {
  if (effect === "prismatic") return 0.76;
  if (effect === "firework") return 0.96;
  if (effect === "shatter") return 0.86;
  if (effect === "neon") return 0.78;
  if (effect === "lightning") return 0.58;
  return 0.68;
}

export function drawUniversalImpactEffect(
  context: CanvasRenderingContext2D,
  effect: UniversalImpactEffect,
  options: ImpactOptions,
) {
  const { x, y, age, lifetime, seed, primary, secondary } = options;
  if (age < 0 || age > lifetime) return;
  const progress = clamp(age / Math.max(0.01, lifetime), 0, 1);
  const fade = Math.pow(1 - progress, 1.35);
  const intensity = clamp(options.intensity / 100, 0.2, 1);
  const scale = (options.scale ?? 1) * (0.72 + intensity * 0.48);
  const colors = [primary, secondary, "#fff36a", "#5df6ff", "#ff63c6", "#9d7bff", "#79ff9c"];

  context.save();
  context.globalCompositeOperation = "lighter";

  if (effect === "prismatic") {
    const spread = 1 - Math.pow(1 - progress, 2.1);
    const burstRadius = (42 + spread * 72) * scale;
    const prismaticColors = ["#57f3ff", "#ff4fcf", "#ffe05a", "#78ff91", "#9d73ff", "#ff6b77"];

    // Compact segmented rings frame the collision without covering the maze ball.
    for (let ring = 0; ring < 3; ring += 1) {
      const radius = (28 + ring * 15 + spread * (22 + ring * 7)) * scale;
      const color = prismaticColors[(ring + 1) % prismaticColors.length];
      for (let segment = 0; segment < 4; segment += 1) {
        const start = age * (0.8 + ring * 0.1) + segment * Math.PI * 0.5 + ring * 0.24;
        context.globalAlpha = fade * (0.88 - ring * 0.12);
        context.strokeStyle = color;
        context.shadowColor = color;
        context.shadowBlur = 12;
        context.lineWidth = (4.2 - ring * 0.6) * scale;
        context.beginPath();
        context.arc(x, y, radius, start, start + Math.PI * (0.2 + intensity * 0.08));
        context.stroke();
      }
    }

    // Short colored light blades reproduce the reference's bars and star sparks.
    const rayCount = Math.round(12 + intensity * 8);
    for (let ray = 0; ray < rayCount; ray += 1) {
      const angle = ray / rayCount * Math.PI * 2 + (hash(seed * 31 + ray * 5.17) - 0.5) * 0.12;
      const inner = (22 + spread * 10) * scale;
      const outer = (48 + spread * (28 + hash(ray * 7.3) * 40)) * scale;
      const halfWidth = (1.1 + hash(ray * 2.7) * 2.4) * scale * fade;
      const color = ray % 5 === 0 ? "#ffffff" : prismaticColors[ray % prismaticColors.length];
      context.save();
      context.translate(x, y);
      context.rotate(angle);
      context.globalAlpha = fade * (0.58 + hash(ray * 3.1) * 0.42);
      context.fillStyle = color;
      context.shadowColor = color;
      context.shadowBlur = 11;
      context.beginPath();
      context.moveTo(inner, -halfWidth * 0.35);
      context.lineTo(outer, -halfWidth);
      context.lineTo(outer + 8 * scale, 0);
      context.lineTo(outer, halfWidth);
      context.lineTo(inner, halfWidth * 0.35);
      context.closePath();
      context.fill();
      context.restore();
    }

    const confettiCount = Math.round(14 + intensity * 10);
    for (let particle = 0; particle < confettiCount; particle += 1) {
      const angle = hash(seed * 43 + particle * 8.91) * Math.PI * 2;
      const distance = (38 + spread * (32 + hash(particle * 4.2) * 54)) * scale;
      const px = x + Math.cos(angle) * distance;
      const py = y + Math.sin(angle) * distance;
      const size = (2 + hash(particle * 6.4) * 4.2) * scale;
      const color = prismaticColors[particle % prismaticColors.length];
      context.save();
      context.translate(px, py);
      context.rotate(angle + age * (3 + particle % 5));
      context.globalAlpha = fade * 0.9;
      context.fillStyle = color;
      context.strokeStyle = color;
      context.shadowColor = color;
      context.shadowBlur = 8;
      if (particle % 6 === 0) {
        context.lineWidth = Math.max(1.5, size * 0.38);
        context.beginPath();
        context.moveTo(-size * 2.4, -size);
        context.quadraticCurveTo(0, size * 2.8, size * 2.4, -size);
        context.stroke();
      } else if (particle % 4 === 0) {
        starPath(context, 0, 0, size * 1.4, size * 0.58, age * 4 + particle);
        context.fill();
      } else {
        context.fillRect(-size * 0.72, -size * 0.38, size * 1.44, size * 0.76);
      }
      context.restore();
    }

    const core = context.createRadialGradient(x, y, 0, x, y, burstRadius * 0.56);
    core.addColorStop(0, `rgba(255,255,255,${Math.min(0.92, fade * 1.25)})`);
    core.addColorStop(0.15, `rgba(217,255,255,${fade * 0.78})`);
    core.addColorStop(0.34, `rgba(82,239,255,${fade * 0.48})`);
    core.addColorStop(0.58, `rgba(255,74,207,${fade * 0.22})`);
    core.addColorStop(1, "rgba(116,71,255,0)");
    context.globalAlpha = 1;
    context.fillStyle = core;
    context.fillRect(x - burstRadius, y - burstRadius, burstRadius * 2, burstRadius * 2);
  } else if (effect === "neon") {
    for (let ring = 0; ring < 4; ring += 1) {
      const radius = (18 + progress * (72 + ring * 25)) * scale;
      context.globalAlpha = fade * (0.92 - ring * 0.13);
      context.strokeStyle = colors[ring % colors.length];
      context.shadowColor = colors[ring % colors.length];
      context.shadowBlur = 20 + ring * 4;
      context.lineWidth = (5.5 - ring * 0.8) * scale;
      context.beginPath();
      context.arc(x, y, radius, ring * 0.42 + age * 5, Math.PI * (1.25 + ring * 0.18) + age * 5);
      context.stroke();
    }
    for (let dot = 0; dot < Math.round(10 + intensity * 16); dot += 1) {
      const angle = dot / (10 + intensity * 16) * Math.PI * 2 + age * (2 + dot % 3);
      const radius = (26 + progress * 82 + (dot % 3) * 9) * scale;
      const color = colors[dot % colors.length];
      context.globalAlpha = fade;
      context.fillStyle = color;
      context.shadowColor = color;
      context.shadowBlur = 16;
      context.beginPath();
      context.arc(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius * 0.72, (2.5 + dot % 3) * scale, 0, Math.PI * 2);
      context.fill();
    }
  } else if (effect === "firework") {
    const particleCount = Math.round(30 + intensity * 34);
    for (let particle = 0; particle < particleCount; particle += 1) {
      const angle = hash(seed * 31 + particle * 7.17) * Math.PI * 2;
      const speed = (95 + hash(particle * 4.31 + seed) * 245) * scale;
      const distance = speed * age;
      const color = colors[particle % colors.length];
      const px = x + Math.cos(angle) * distance;
      const py = y + Math.sin(angle) * distance + age * age * 96 * scale;
      const tail = (12 + hash(particle * 9.4) * 25) * fade * scale;
      context.globalAlpha = fade;
      context.strokeStyle = color;
      context.shadowColor = color;
      context.shadowBlur = 12;
      context.lineWidth = (1.5 + hash(particle * 2.8) * 3.1) * scale;
      context.beginPath();
      context.moveTo(px - Math.cos(angle) * tail, py - Math.sin(angle) * tail);
      context.lineTo(px, py);
      context.stroke();
      if (particle % 7 === 0) {
        context.fillStyle = "#ffffff";
        starPath(context, px, py, 5 * scale, 2.1 * scale, age * 5 + particle);
        context.fill();
      }
    }
  } else if (effect === "explosion") {
    const blastRadius = (34 + progress * 126) * scale;
    const flash = context.createRadialGradient(x, y, 0, x, y, blastRadius);
    flash.addColorStop(0, `rgba(255,255,255,${fade})`);
    flash.addColorStop(0.16, `rgba(255,245,92,${fade * 0.98})`);
    flash.addColorStop(0.42, `rgba(255,93,30,${fade * 0.82})`);
    flash.addColorStop(1, "rgba(255,20,70,0)");
    context.globalAlpha = 1;
    context.fillStyle = flash;
    context.fillRect(x - blastRadius, y - blastRadius, blastRadius * 2, blastRadius * 2);
    for (let ray = 0; ray < Math.round(16 + intensity * 16); ray += 1) {
      const angle = ray / (16 + intensity * 16) * Math.PI * 2 + hash(seed + ray) * 0.16;
      const inner = (18 + progress * 24) * scale;
      const outer = (48 + progress * (115 + hash(ray * 3.9) * 78)) * scale;
      const color = ray % 3 === 0 ? "#ffffff" : ray % 2 ? "#ffe55d" : "#ff4c56";
      context.globalAlpha = fade;
      context.strokeStyle = color;
      context.shadowColor = color;
      context.shadowBlur = 18;
      context.lineWidth = (2 + hash(ray * 7.1) * 5) * scale * fade;
      context.beginPath();
      context.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner);
      context.lineTo(x + Math.cos(angle) * outer, y + Math.sin(angle) * outer);
      context.stroke();
    }
    for (let puff = 0; puff < 9; puff += 1) {
      const angle = hash(seed * 13 + puff * 5.9) * Math.PI * 2;
      const distance = (24 + progress * 96) * scale;
      context.globalAlpha = fade * 0.42;
      context.fillStyle = puff % 2 ? "#ff7c45" : "#b74bff";
      context.beginPath();
      context.arc(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, (11 + progress * 22) * scale, 0, Math.PI * 2);
      context.fill();
    }
  } else if (effect === "shatter") {
    const shardCount = Math.round(18 + intensity * 24);
    for (let shard = 0; shard < shardCount; shard += 1) {
      const angle = hash(seed * 17 + shard * 4.73) * Math.PI * 2;
      const speed = (68 + hash(shard * 8.1) * 210) * scale;
      const distance = speed * age;
      const px = x + Math.cos(angle) * distance;
      const py = y + Math.sin(angle) * distance + age * age * 68 * scale;
      const size = (7 + hash(shard * 3.2) * 16) * scale * (0.5 + fade * 0.7);
      const color = colors[shard % colors.length];
      context.save();
      context.translate(px, py);
      context.rotate(angle + age * (5 + hash(shard) * 9));
      context.globalAlpha = fade * 0.94;
      context.fillStyle = color;
      context.strokeStyle = shard % 4 === 0 ? "#ffffff" : color;
      context.shadowColor = color;
      context.shadowBlur = 12;
      context.lineWidth = 1.2 * scale;
      context.beginPath();
      context.moveTo(size, 0);
      context.lineTo(-size * 0.66, size * 0.34);
      context.lineTo(-size * 0.24, -size * 0.78);
      context.closePath();
      context.fill();
      context.stroke();
      context.restore();
    }
  } else {
    const boltCount = Math.round(7 + intensity * 7);
    const reach = (86 + progress * 92) * scale;
    context.globalAlpha = fade * 0.9;
    const flash = context.createRadialGradient(x, y, 0, x, y, 90 * scale);
    flash.addColorStop(0, `rgba(255,255,255,${fade * 0.92})`);
    flash.addColorStop(0.35, `rgba(78,234,255,${fade * 0.44})`);
    flash.addColorStop(1, "rgba(101,92,255,0)");
    context.fillStyle = flash;
    context.fillRect(x - 100 * scale, y - 100 * scale, 200 * scale, 200 * scale);
    for (let bolt = 0; bolt < boltCount; bolt += 1) {
      const baseAngle = bolt / boltCount * Math.PI * 2 + hash(seed + bolt) * 0.38;
      const color = bolt % 3 === 0 ? "#ffffff" : bolt % 2 ? "#58efff" : "#a579ff";
      context.strokeStyle = color;
      context.shadowColor = color;
      context.shadowBlur = 22;
      context.lineWidth = (2.2 + fade * 3.5) * scale;
      context.beginPath();
      context.moveTo(x, y);
      for (let step = 1; step <= 6; step += 1) {
        const stepDistance = reach * step / 6;
        const jitter = (hash(seed * 29 + bolt * 11 + step * 7.9) - 0.5) * 26 * scale;
        context.lineTo(
          x + Math.cos(baseAngle) * stepDistance + Math.cos(baseAngle + Math.PI / 2) * jitter,
          y + Math.sin(baseAngle) * stepDistance + Math.sin(baseAngle + Math.PI / 2) * jitter,
        );
      }
      context.stroke();
    }
  }

  context.restore();
}
