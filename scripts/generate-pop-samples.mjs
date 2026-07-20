import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sampleIds = [
  "summer-hook",
  "city-heartbeat",
  "rain-confession",
  "rapid-star-keys",
  "immortal-echo",
];
const sampleRate = 44_100;

function midiFrequency(pitch) {
  return 440 * 2 ** ((pitch - 69) / 12);
}

function addPianoTone(output, startSeconds, durationSeconds, pitch, amplitude) {
  const start = Math.floor(startSeconds * sampleRate);
  const length = Math.min(output.length - start, Math.floor(Math.max(0.4, durationSeconds + 1.25) * sampleRate));
  const frequency = midiFrequency(pitch);
  for (let index = 0; index < length; index += 1) {
    const time = index / sampleRate;
    const attack = Math.min(1, time / 0.006);
    const decay = Math.exp(-time * (1.75 + Math.max(0, pitch - 60) * 0.014));
    const release = time <= durationSeconds ? 1 : Math.exp(-(time - durationSeconds) * 7.5);
    const body = Math.sin(2 * Math.PI * frequency * time) * 0.72;
    const overtone2 = Math.sin(2 * Math.PI * frequency * 2.006 * time + 0.13) * 0.2;
    const overtone3 = Math.sin(2 * Math.PI * frequency * 3.01 * time + 0.31) * 0.08;
    const hammer = Math.sin(2 * Math.PI * (2_800 + pitch * 7) * time) * Math.exp(-time * 55) * 0.09;
    output[start + index] += (body + overtone2 + overtone3 + hammer) * attack * decay * release * amplitude;
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
    const value = Math.max(-0.97, Math.min(0.97, samples[index]));
    buffer.writeInt16LE(Math.round(value * 32767), 44 + index * 2);
  }
  return buffer;
}

for (const id of sampleIds) {
  const jsonPath = resolve(root, "public", "samples", `${id}.json`);
  const score = JSON.parse(readFileSync(jsonPath, "utf8"));
  const secondsPerBeat = 60 / score.bpm;
  const finalBeat = Math.max(...score.notes.map((note) => note.beat + note.duration));
  const duration = score.lead_in_seconds + finalBeat * secondsPerBeat + 0.9;
  const output = new Float64Array(Math.ceil(duration * sampleRate));

  score.notes.forEach((note, index) => {
    const start = score.lead_in_seconds + note.beat * secondsPerBeat;
    const noteDuration = note.duration * secondsPerBeat;
    const accent = index % 4 === 0 ? 0.29 : 0.24;
    addPianoTone(output, start, noteDuration, note.pitch, accent);
    if (Math.abs(note.beat % 4) < 0.001) {
      addPianoTone(output, start, Math.min(1.8, noteDuration + 0.8), note.pitch - 24, 0.095);
      addPianoTone(output, start, Math.min(1.8, noteDuration + 0.8), note.pitch - 12, 0.07);
    }
  });

  let peak = 0;
  for (const sample of output) peak = Math.max(peak, Math.abs(sample));
  const gain = peak > 0 ? 0.82 / peak : 1;
  const normalized = Float64Array.from(output, (sample, index) => {
    const fadeIn = Math.min(1, index / (sampleRate * 0.08));
    const fadeOut = Math.min(1, (output.length - index) / (sampleRate * 0.45));
    return sample * gain * fadeIn * fadeOut;
  });

  const wavPath = resolve(root, "public", "samples", `${id}.wav`);
  const mp3Path = resolve(root, "public", "samples", `${id}.mp3`);
  writeFileSync(wavPath, wavBuffer(normalized));
  const conversion = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", wavPath, "-codec:a", "libmp3lame", "-q:a", "2", mp3Path], { stdio: "inherit" });
  unlinkSync(wavPath);
  if (conversion.status !== 0) throw new Error(`ffmpeg failed for ${id}`);
  process.stdout.write(`${id}: ${duration.toFixed(2)}s\n`);
}
