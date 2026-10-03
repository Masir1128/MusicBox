import { writeFileSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sampleRate = 44_100;

const tracks = [
  {
    id: "prism-rush",
    bpm: 148,
    lead: 0.55,
    bars: 12,
    pattern: [0, 0.5, 1.25, 1.75, 2.5, 2.75, 3.25, 3.75],
    pitches: [64, 71, 67, 76, 69, 74, 66, 72, 79, 74, 69, 67],
    synth: "bright",
  },
  {
    id: "switchback-groove",
    bpm: 124,
    lead: 0.65,
    bars: 12,
    pattern: [0, 0.75, 1.5, 2, 2.5, 3.25],
    pitches: [57, 64, 69, 62, 67, 71, 59, 66, 74, 71, 67, 64],
    synth: "round",
  },
  {
    id: "glass-triplets",
    bpm: 108,
    lead: 0.7,
    bars: 10,
    pattern: [0, 1 / 3, 2 / 3, 1.5, 2, 2 + 1 / 3, 3, 3 + 2 / 3],
    pitches: [60, 67, 72, 76, 71, 79, 74, 69, 77, 72],
    synth: "glass",
  },
];

const midiFrequency = (pitch) => 440 * 2 ** ((pitch - 69) / 12);

function addTone(output, startSeconds, durationSeconds, pitch, amplitude, synth) {
  const start = Math.floor(startSeconds * sampleRate);
  const length = Math.min(output.length - start, Math.floor((durationSeconds + 1.15) * sampleRate));
  const frequency = midiFrequency(pitch);
  for (let index = 0; index < length; index += 1) {
    const time = index / sampleRate;
    const attack = Math.min(1, time / (synth === "round" ? 0.014 : 0.004));
    const decayRate = synth === "glass" ? 3.4 : synth === "bright" ? 2.15 : 1.65;
    const envelope = attack * Math.exp(-time * decayRate) * (time < durationSeconds ? 1 : Math.exp(-(time - durationSeconds) * 7));
    let sample = Math.sin(2 * Math.PI * frequency * time) * 0.68;
    sample += Math.sin(2 * Math.PI * frequency * 2.006 * time + 0.1) * (synth === "round" ? 0.12 : 0.22);
    sample += Math.sin(2 * Math.PI * frequency * 3.012 * time + 0.34) * (synth === "glass" ? 0.18 : 0.07);
    if (synth === "bright") sample += Math.sin(2 * Math.PI * frequency * 4.02 * time) * 0.08;
    if (synth === "glass") sample += Math.sin(2 * Math.PI * frequency * 5.01 * time) * 0.09;
    const click = Math.sin(2 * Math.PI * (2_200 + pitch * 11) * time) * Math.exp(-time * 62) * 0.1;
    output[start + index] += (sample + click) * envelope * amplitude;
  }
}

function addKick(output, startSeconds, amplitude = 0.22) {
  const start = Math.floor(startSeconds * sampleRate);
  const length = Math.min(output.length - start, Math.floor(sampleRate * 0.24));
  for (let index = 0; index < length; index += 1) {
    const time = index / sampleRate;
    const phase = 2 * Math.PI * (78 * time - 43 * time * time);
    output[start + index] += Math.sin(phase) * Math.exp(-time * 18) * amplitude;
  }
}

function addShimmer(output, startSeconds, seed, amplitude = 0.035) {
  const start = Math.floor(startSeconds * sampleRate);
  const length = Math.min(output.length - start, Math.floor(sampleRate * 0.075));
  for (let index = 0; index < length; index += 1) {
    const time = index / sampleRate;
    const noise = Math.sin((index + seed * 97) * 12.9898) * 43758.5453;
    output[start + index] += ((noise - Math.floor(noise)) * 2 - 1) * Math.exp(-time * 44) * amplitude;
  }
}

function wavBuffer(samples) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < samples.length; index += 1) {
    const value = Math.max(-0.98, Math.min(0.98, samples[index]));
    buffer.writeInt16LE(Math.round(value * 32767), 44 + index * 2);
  }
  return buffer;
}

for (const track of tracks) {
  const secondsPerBeat = 60 / track.bpm;
  const notes = [];
  for (let bar = 0; bar < track.bars; bar += 1) {
    track.pattern.forEach((offset, step) => {
      const base = track.pitches[(bar + step * 2) % track.pitches.length];
      const octaveLift = (bar + step) % 7 === 0 ? 12 : 0;
      notes.push({ pitch: base + octaveLift, beat: bar * 4 + offset, duration: step % 3 === 0 ? 0.48 : 0.28 });
    });
  }
  const lastBeat = Math.max(...notes.map((note) => note.beat + note.duration));
  const duration = track.lead + lastBeat * secondsPerBeat + 1.1;
  const output = new Float64Array(Math.ceil(duration * sampleRate));

  notes.forEach((note, index) => {
    const start = track.lead + note.beat * secondsPerBeat;
    addTone(output, start, note.duration * secondsPerBeat, note.pitch, index % 4 === 0 ? 0.3 : 0.24, track.synth);
    if (Math.abs(note.beat % 4) < 0.001) {
      addTone(output, start, 0.75, note.pitch - 24, 0.085, "round");
      addKick(output, start);
    }
    addShimmer(output, start, index, track.synth === "glass" ? 0.045 : 0.026);
  });

  let peak = 0;
  for (const sample of output) peak = Math.max(peak, Math.abs(sample));
  const gain = peak ? 0.86 / peak : 1;
  for (let index = 0; index < output.length; index += 1) {
    const fadeIn = Math.min(1, index / (sampleRate * 0.07));
    const fadeOut = Math.min(1, (output.length - index) / (sampleRate * 0.5));
    output[index] *= gain * fadeIn * fadeOut;
  }

  const score = {
    bpm: track.bpm,
    lead_in_seconds: track.lead,
    license: "Original procedural test music generated locally for ORBITONE",
    author: "科学羊 / ORBITONE",
    notes,
  };
  const jsonPath = resolve(root, "public", "samples", `${track.id}.json`);
  const wavPath = resolve(root, "public", "samples", `${track.id}.wav`);
  const mp3Path = resolve(root, "public", "samples", `${track.id}.mp3`);
  writeFileSync(jsonPath, `${JSON.stringify(score, null, 2)}\n`);
  writeFileSync(wavPath, wavBuffer(output));
  const conversion = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", wavPath, "-codec:a", "libmp3lame", "-q:a", "2", mp3Path], { stdio: "inherit" });
  unlinkSync(wavPath);
  if (conversion.status !== 0) throw new Error(`ffmpeg failed for ${track.id}`);
  process.stdout.write(`${track.id}: ${notes.length} notes, ${duration.toFixed(2)}s\n`);
}
