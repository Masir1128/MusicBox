import type {
  AnalysisCandidate,
  AnalysisResult,
  MelodyNote,
  ModelCandidateStatus,
} from "./melodyAnalyzer";

type ProgressCallback = (progress: number, stage: string) => void;

const MODEL_SAMPLE_RATE = 22_050;
const FFT_HOP = 256;
const ANNOTATION_FRAMES_PER_WINDOW = 172;
const WINDOW_OFFSET = 0.010326;
const MIDI_OFFSET = 21;
const MAX_SECONDS = 240;
const MIN_MIDI = 36;
const MAX_MIDI = 96;

type ModelOnset = {
  time: number;
  pitch: number;
  score: number;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function resampleMono(buffer: AudioBuffer) {
  const seconds = Math.min(buffer.duration, MAX_SECONDS);
  const output = new Float32Array(Math.max(1, Math.floor(seconds * MODEL_SAMPLE_RATE)));
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
  const ratio = buffer.sampleRate / MODEL_SAMPLE_RATE;
  for (let index = 0; index < output.length; index += 1) {
    const position = index * ratio;
    const left = Math.floor(position);
    const right = Math.min(left + 1, channels[0].length - 1);
    const amount = position - left;
    let sample = 0;
    for (const channel of channels) sample += channel[left] * (1 - amount) + channel[right] * amount;
    output[index] = sample / channels.length;
  }
  return output;
}

function frameTime(index: number) {
  return Math.max(
    0,
    (index * FFT_HOP) / MODEL_SAMPLE_RATE -
      WINDOW_OFFSET * Math.floor(index / ANNOTATION_FRAMES_PER_WINDOW),
  );
}

function strongestPianoKey(row: number[]) {
  let pitch = 60;
  let score = 0;
  for (let midi = MIN_MIDI; midi <= MAX_MIDI; midi += 1) {
    const value = row[midi - MIDI_OFFSET] ?? 0;
    if (value > score) {
      score = value;
      pitch = midi;
    }
  }
  return { pitch, score };
}

function pickModelOnsets(onsets: number[][], sensitivity: number) {
  const amount = clamp(sensitivity, 0.2, 0.92);
  const strengths = onsets.map((row) => strongestPianoKey(row));
  const threshold = 0.58 - amount * 0.18;
  const peaks: ModelOnset[] = [];

  for (let index = 2; index < strengths.length - 2; index += 1) {
    const current = strengths[index];
    if (current.score < threshold) continue;
    if (
      current.score < strengths[index - 2].score ||
      current.score < strengths[index - 1].score ||
      current.score <= strengths[index + 1].score ||
      current.score < strengths[index + 2].score
    ) continue;
    const candidate = { time: frameTime(index), pitch: current.pitch, score: current.score };
    const previous = peaks.at(-1);
    if (previous && candidate.time - previous.time < 0.065) {
      if (candidate.score > previous.score) peaks[peaks.length - 1] = candidate;
    } else {
      peaks.push(candidate);
    }
  }
  return peaks;
}

function fuseOnsets(base: AnalysisResult, modelOnsets: ModelOnset[], sensitivity: number): AnalysisResult {
  const amount = clamp(sensitivity, 0.2, 0.92);
  const addThreshold = 0.72 - amount * 0.12;
  const candidateStatus = new Map<ModelOnset, ModelCandidateStatus>();
  const notes = base.notes.map((note) => {
    const match = modelOnsets.reduce<ModelOnset | undefined>((best, candidate) => {
      const distance = Math.abs(candidate.time - note.time);
      if (distance > 0.075) return best;
      if (!best || distance < Math.abs(best.time - note.time)) return candidate;
      return best;
    }, undefined);
    if (!match) return note;
    candidateStatus.set(match, "matched");
    return {
      ...note,
      pitch: match.pitch,
      confidence: Math.max(note.confidence, match.score),
      modelConfidence: match.score,
    };
  });

  for (const onset of modelOnsets) {
    if (candidateStatus.has(onset)) continue;
    if (onset.score < addThreshold) {
      candidateStatus.set(onset, "weak");
      continue;
    }
    const nearest = notes.reduce((distance, note) => Math.min(distance, Math.abs(note.time - onset.time)), Infinity);
    if (nearest <= 0.085) {
      candidateStatus.set(onset, "nearby");
      continue;
    }
    const previousBase = [...notes].reverse().find((note) => note.time < onset.time);
    // The model can emit several high-confidence "onsets" while one piano
    // key is still ringing. The spectral detector already catches genuine
    // repeated strikes, so never insert another model-only hit of the same
    // pitch inside that base segment.
    if (previousBase && Math.abs(previousBase.pitch - onset.pitch) % 12 === 0) {
      candidateStatus.set(onset, "sustain");
      continue;
    }
    candidateStatus.set(onset, "added");
    notes.push({
      time: onset.time,
      duration: 0.3,
      pitch: onset.pitch,
      confidence: onset.score,
      velocity: clamp(onset.score, 0.38, 1),
      source: "model",
      modelConfidence: onset.score,
    });
  }

  notes.sort((a, b) => a.time - b.time);
  const separated: MelodyNote[] = [];
  const baseDensity = base.notes.length / Math.max(1, base.duration);
  const separationGap = baseDensity >= 3.2 ? 0.052 : 0.07;
  for (const note of notes) {
    const previous = separated.at(-1);
    if (previous && note.time - previous.time < separationGap) {
      if (note.confidence > previous.confidence) separated[separated.length - 1] = note;
    } else {
      separated.push(note);
    }
  }
  for (let index = 0; index < separated.length; index += 1) {
    const gap = (separated[index + 1]?.time ?? separated[index].time + 0.45) - separated[index].time;
    separated[index] = { ...separated[index], duration: clamp(gap * 0.72, 0.14, 0.8) };
  }

  const modelCandidates: AnalysisCandidate[] = modelOnsets.map((onset) => ({
    time: onset.time,
    pitch: onset.pitch,
    confidence: onset.score,
    status: candidateStatus.get(onset) ?? "weak",
  }));

  return {
    ...base,
    notes: separated,
    quality: "high",
    diagnostics: {
      profile: "piano",
      sensitivity,
      spectralCount: base.diagnostics?.spectralCount ?? base.notes.length,
      modelCandidates,
    },
  };
}

export async function refinePianoOnsets(
  buffer: AudioBuffer,
  base: AnalysisResult,
  sensitivity: number,
  onProgress?: ProgressCallback,
): Promise<AnalysisResult> {
  onProgress?.(0.64, "正在用钢琴起音模型复核漏拍");
  const { BasicPitch } = await import("@spotify/basic-pitch");
  const model = new BasicPitch("/models/basic-pitch/model.json");
  const onsets: number[][] = [];
  await model.evaluateModel(
    resampleMono(buffer),
    (_frames, nextOnsets) => onsets.push(...nextOnsets),
    (progress) => onProgress?.(0.64 + progress * 0.32, "正在逐帧复核钢琴触键"),
  );
  const modelOnsets = pickModelOnsets(onsets, sensitivity);
  onProgress?.(0.98, "正在合并真实起音并去除延音误触");
  return fuseOnsets(base, modelOnsets, sensitivity);
}
