export type AnalysisProfile = "balanced" | "piano" | "rhythm";

export type AnalysisOptions = {
  profile: AnalysisProfile;
  sensitivity: number;
};

export type NoteSource = "spectral" | "model" | "manual" | "score" | "detected";

export type ModelCandidateStatus = "matched" | "added" | "nearby" | "sustain" | "weak";

export type AnalysisCandidate = {
  time: number;
  pitch: number;
  confidence: number;
  status: ModelCandidateStatus;
};

export type AnalysisDiagnostics = {
  profile: AnalysisProfile | "score";
  sensitivity: number;
  spectralCount: number;
  modelCandidates: AnalysisCandidate[];
};

export type MelodyNote = {
  time: number;
  duration: number;
  pitch: number;
  confidence: number;
  velocity: number;
  source?: NoteSource;
  modelConfidence?: number;
};

export type AnalysisResult = {
  notes: MelodyNote[];
  duration: number;
  keyLabel: string;
  tempo: number;
  quality: "high" | "medium" | "exploratory";
  diagnostics?: AnalysisDiagnostics;
};

type AnalysisFrame = {
  time: number;
  offset: number;
  rms: number;
  novelty: number;
  broadFlux: number;
  pianoFlux: number;
  rhythmFlux: number;
  score: number;
};

const TARGET_RATE = 12_000;
const FFT_SIZE = 512;
const PITCH_WINDOW = 1_024;
const ANALYSIS_HOP = 128;
const MAX_SECONDS = 240;
const MAX_NOTES = 1_600;
const DEFAULT_OPTIONS: AnalysisOptions = { profile: "piano", sensitivity: 0.68 };

const yieldToBrowser = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function mixAndResample(buffer: AudioBuffer): Float32Array {
  const seconds = Math.min(buffer.duration, MAX_SECONDS);
  const outputLength = Math.max(1, Math.floor(seconds * TARGET_RATE));
  const output = new Float32Array(outputLength);
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) =>
    buffer.getChannelData(index),
  );
  const ratio = buffer.sampleRate / TARGET_RATE;

  for (let index = 0; index < outputLength; index += 1) {
    const sourcePosition = index * ratio;
    const left = Math.floor(sourcePosition);
    const right = Math.min(left + 1, channels[0].length - 1);
    const fraction = sourcePosition - left;
    let sample = 0;
    for (const channel of channels) {
      sample += channel[left] * (1 - fraction) + channel[right] * fraction;
    }
    output[index] = sample / channels.length;
  }
  return output;
}

function frameRms(samples: Float32Array, offset: number): number {
  let sum = 0;
  const length = Math.min(FFT_SIZE, samples.length - offset);
  for (let index = 0; index < length; index += 1) {
    const value = samples[offset + index];
    sum += value * value;
  }
  return Math.sqrt(sum / Math.max(1, length));
}

function fillSpectrum(
  samples: Float32Array,
  offset: number,
  real: Float64Array,
  imaginary: Float64Array,
  magnitudes: Float64Array,
) {
  for (let index = 0; index < FFT_SIZE; index += 1) {
    const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (FFT_SIZE - 1));
    real[index] = (samples[offset + index] ?? 0) * window;
    imaginary[index] = 0;
  }

  for (let index = 1, reversed = 0; index < FFT_SIZE; index += 1) {
    let bit = FFT_SIZE >> 1;
    for (; reversed & bit; bit >>= 1) reversed ^= bit;
    reversed ^= bit;
    if (index < reversed) {
      [real[index], real[reversed]] = [real[reversed], real[index]];
      [imaginary[index], imaginary[reversed]] = [imaginary[reversed], imaginary[index]];
    }
  }

  for (let length = 2; length <= FFT_SIZE; length <<= 1) {
    const angle = (-2 * Math.PI) / length;
    const baseReal = Math.cos(angle);
    const baseImaginary = Math.sin(angle);
    for (let start = 0; start < FFT_SIZE; start += length) {
      let twiddleReal = 1;
      let twiddleImaginary = 0;
      for (let index = 0; index < length / 2; index += 1) {
        const even = start + index;
        const odd = even + length / 2;
        const oddReal = real[odd] * twiddleReal - imaginary[odd] * twiddleImaginary;
        const oddImaginary = real[odd] * twiddleImaginary + imaginary[odd] * twiddleReal;
        real[odd] = real[even] - oddReal;
        imaginary[odd] = imaginary[even] - oddImaginary;
        real[even] += oddReal;
        imaginary[even] += oddImaginary;
        const nextReal = twiddleReal * baseReal - twiddleImaginary * baseImaginary;
        twiddleImaginary = twiddleReal * baseImaginary + twiddleImaginary * baseReal;
        twiddleReal = nextReal;
      }
    }
  }

  for (let index = 0; index < magnitudes.length; index += 1) {
    magnitudes[index] = Math.hypot(real[index], imaginary[index]);
  }
}

async function buildAnalysisFrames(
  samples: Float32Array,
  onProgress?: (progress: number, stage: string) => void,
): Promise<AnalysisFrame[]> {
  const frameCount = Math.max(1, Math.floor((samples.length - FFT_SIZE) / ANALYSIS_HOP) + 1);
  const real = new Float64Array(FFT_SIZE);
  const imaginary = new Float64Array(FFT_SIZE);
  const magnitudes = new Float64Array(FFT_SIZE / 2);
  const previousLogSpectrum = new Float64Array(FFT_SIZE / 2);
  const laggedLogSpectra = [new Float64Array(FFT_SIZE / 2), new Float64Array(FFT_SIZE / 2)];
  const currentLogSpectrum = new Float64Array(FFT_SIZE / 2);
  const rmsValues = new Float32Array(frameCount);
  const rawFrames: Omit<AnalysisFrame, "novelty" | "score">[] = [];

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const offset = frameIndex * ANALYSIS_HOP;
    const rms = frameRms(samples, offset);
    rmsValues[frameIndex] = rms;
    fillSpectrum(samples, offset, real, imaginary, magnitudes);

    let totalMagnitude = 0;
    let broadFlux = 0;
    let pianoFlux = 0;
    let rhythmFlux = 0;
    const laggedSpectrum = laggedLogSpectra[frameIndex % laggedLogSpectra.length];
    for (let bin = 0; bin < magnitudes.length; bin += 1) {
      currentLogSpectrum[bin] = Math.log1p(magnitudes[bin] * 3.5);
    }
    for (let bin = 3; bin < magnitudes.length; bin += 1) {
      const frequency = (bin * TARGET_RATE) / FFT_SIZE;
      const magnitude = currentLogSpectrum[bin];
      const delta = frameIndex === 0 ? 0 : Math.max(0, magnitude - previousLogSpectrum[bin]);
      totalMagnitude += magnitude;
      if (frequency >= 120 && frequency <= 3_800) broadFlux += delta;
      if (frequency >= 90 && frequency <= 5_400) {
        let laggedMaximum = laggedSpectrum[bin];
        for (let neighbor = Math.max(2, bin - 2); neighbor <= Math.min(magnitudes.length - 1, bin + 2); neighbor += 1) {
          laggedMaximum = Math.max(laggedMaximum, laggedSpectrum[neighbor]);
        }
        const superFlux = frameIndex < laggedLogSpectra.length ? 0 : Math.max(0, magnitude - laggedMaximum);
        const pianoWeight =
          frequency < 180 ? 0.48 : frequency < 650 ? 1.18 : frequency < 2_600 ? 1.62 : 1.12;
        pianoFlux += superFlux * pianoWeight;
      }
      if (frequency >= 45 && frequency <= 1_200) {
        const rhythmWeight = frequency < 260 ? 1.5 : frequency < 700 ? 0.9 : 0.45;
        rhythmFlux += delta * rhythmWeight;
      }
    }
    previousLogSpectrum.set(currentLogSpectrum);
    laggedSpectrum.set(currentLogSpectrum);
    // Log-magnitude flux keeps a quiet new piano key visible even when the
    // sustain pedal leaves a large amount of energy ringing underneath it.
    const normalizer = Math.max(1, Math.sqrt(totalMagnitude));
    rawFrames.push({
      time: (offset + FFT_SIZE / 2) / TARGET_RATE,
      offset,
      rms,
      broadFlux: broadFlux / normalizer,
      pianoFlux: pianoFlux / normalizer,
      rhythmFlux: rhythmFlux / normalizer,
    });

    if (frameIndex % 360 === 0) {
      onProgress?.(0.1 + (frameIndex / frameCount) * 0.38, "正在扫描钢琴触键与频谱变化");
      await yieldToBrowser();
    }
  }

  return rawFrames.map((frame, index) => {
    let baseline = 0;
    let count = 0;
    for (let previous = Math.max(0, index - 8); previous < index; previous += 1) {
      baseline += rmsValues[previous];
      count += 1;
    }
    baseline /= Math.max(1, count);
    return { ...frame, novelty: Math.max(0, frame.rms - baseline), score: 0 };
  });
}

function percentile(values: number[], amount: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * clamp(amount, 0, 1)))];
}

function localMedian(values: number[], index: number, radius: number): number {
  const start = Math.max(0, index - radius);
  const end = Math.min(values.length, index + radius + 1);
  return percentile(values.slice(start, end), 0.5);
}

function profileFlux(frame: AnalysisFrame, profile: AnalysisProfile) {
  if (profile === "piano") return frame.pianoFlux;
  if (profile === "rhythm") return frame.rhythmFlux;
  return frame.broadFlux;
}

function mergeNearbyFrames(frames: AnalysisFrame[], minGap: number): AnalysisFrame[] {
  const merged: AnalysisFrame[] = [];
  for (const frame of [...frames].sort((a, b) => a.time - b.time)) {
    const previous = merged.at(-1);
    if (previous && frame.time - previous.time < minGap) {
      if (frame.score > previous.score) merged[merged.length - 1] = frame;
    } else {
      merged.push(frame);
    }
  }
  return merged;
}

function thinByStrength(frames: AnalysisFrame[]): AnalysisFrame[] {
  if (frames.length <= MAX_NOTES) return frames;
  const duration = frames.at(-1)?.time ?? 1;
  const bucketSize = duration / MAX_NOTES;
  const buckets = new Map<number, AnalysisFrame>();
  for (const frame of frames) {
    const bucket = Math.min(MAX_NOTES - 1, Math.floor(frame.time / Math.max(0.001, bucketSize)));
    const previous = buckets.get(bucket);
    if (!previous || frame.score > previous.score) buckets.set(bucket, frame);
  }
  return [...buckets.values()].sort((a, b) => a.time - b.time);
}

function selectPulseFrames(frames: AnalysisFrame[], options: AnalysisOptions): AnalysisFrame[] {
  const sensitivity = clamp(options.sensitivity, 0.05, 1);
  const rmsValues = frames.map((frame) => frame.rms);
  const noveltyValues = frames.map((frame) => frame.novelty);
  const fluxValues = frames.map((frame) => profileFlux(frame, options.profile));
  const noiseFloor = percentile(rmsValues, 0.16);
  const peakRms = Math.max(0.001, ...rmsValues);
  const peakNovelty = Math.max(1e-6, ...noveltyValues);
  const positiveNovelty = noveltyValues.filter((value) => value > 0);
  const noveltyFloor = Math.max(1e-8, percentile(positiveNovelty, 0.36));
  const globalFluxFloor = Math.max(1e-7, percentile(fluxValues, 0.3));
  const activeThreshold = Math.max(noiseFloor * 1.32, peakRms * 0.006);
  const minimumGapBase = options.profile === "piano" ? 0.075 : options.profile === "rhythm" ? 0.12 : 0.09;
  const minimumGap = Math.max(0.07, minimumGapBase + (1 - sensitivity) * 0.055);
  const localRadius = Math.max(10, Math.round((TARGET_RATE / ANALYSIS_HOP) * 0.24));
  const adaptiveFlux = fluxValues.map((flux, index) => {
    const baseline = Math.max(globalFluxFloor, localMedian(fluxValues, index, localRadius));
    return Math.max(0, flux - baseline * (1.04 + (1 - sensitivity) * 0.24));
  });
  const positiveFlux = adaptiveFlux.filter((value) => value > 0);
  const adaptiveFloor = Math.max(1e-8, percentile(positiveFlux, 0.7 - sensitivity * 0.38));

  const scored = frames.map((frame, index) => {
    const normalizedFlux = clamp(adaptiveFlux[index] / Math.max(adaptiveFloor * 5, 1e-8), 0, 1);
    const normalizedNovelty = frame.novelty / peakNovelty;
    const normalizedRms = frame.rms / peakRms;
    const weights =
      options.profile === "piano"
        ? [0.84, 0.11, 0.05]
        : options.profile === "rhythm"
          ? [0.62, 0.25, 0.13]
          : [0.65, 0.24, 0.11];
    return {
      ...frame,
      score: normalizedFlux * weights[0] + normalizedNovelty * weights[1] + normalizedRms * weights[2],
    };
  });
  const scoreFloor = percentile(scored.map((frame) => frame.score), 0.6 - sensitivity * 0.28);
  const candidates: AnalysisFrame[] = [];

  for (let index = 3; index < scored.length - 3; index += 1) {
    const frame = scored[index];
    if (frame.rms < activeThreshold) continue;
    const fluxPeak =
      adaptiveFlux[index] >= adaptiveFloor &&
      frame.novelty >= noveltyFloor * (0.62 + (1 - sensitivity) * 0.75) &&
      frame.score >= scoreFloor &&
      frame.score >= scored[index - 1].score &&
      frame.score >= scored[index - 2].score &&
      frame.score > scored[index + 1].score &&
      frame.score >= scored[index + 2].score;
    const energyPeak =
      options.profile !== "piano" &&
      frame.novelty > noveltyValues[index - 1] &&
      frame.novelty >= noveltyValues[index + 1] &&
      frame.novelty > peakNovelty * (0.025 + (1 - sensitivity) * 0.025);
    if (fluxPeak || energyPeak) candidates.push(frame);
  }

  const trackDuration = Math.max(1, frames.at(-1)?.time ?? 1);
  const strongPianoDensity = candidates.length / trackDuration;
  // Fast solo-piano passages can contain a genuine new key every 80–150ms.
  // Their attacks are visible in piano-band flux even when the sustain pedal
  // keeps RMS novelty low. Only enable this relaxed second pass after the
  // conservative pass has already established a dense piano texture; this
  // avoids turning flute, vocal, and orchestral mixtures into extra landings.
  const densePianoMode = options.profile === "piano" && strongPianoDensity >= 3.2;
  if (densePianoMode) {
    const relaxedFluxFloor = adaptiveFloor * (0.54 + (1 - sensitivity) * 0.3);
    const relaxedScoreFloor = scoreFloor * (0.7 + (1 - sensitivity) * 0.12);
    for (let index = 2; index < scored.length - 2; index += 1) {
      const frame = scored[index];
      if (frame.rms < activeThreshold) continue;
      const rapidPianoPeak =
        adaptiveFlux[index] >= relaxedFluxFloor &&
        frame.score >= relaxedScoreFloor &&
        adaptiveFlux[index] > adaptiveFlux[index - 1] &&
        adaptiveFlux[index] >= adaptiveFlux[index + 1] &&
        adaptiveFlux[index] >= adaptiveFlux[index - 2] &&
        adaptiveFlux[index] >= adaptiveFlux[index + 2];
      if (rapidPianoPeak) candidates.push(frame);
    }
  }

  return thinByStrength(mergeNearbyFrames(candidates, densePianoMode ? 0.052 : minimumGap));
}

function detectPitch(samples: Float32Array, offset: number): { midi: number; confidence: number } | null {
  const safeOffset = Math.max(0, Math.min(offset, samples.length - PITCH_WINDOW));
  const usable = Math.min(PITCH_WINDOW, samples.length - safeOffset);
  if (usable < PITCH_WINDOW * 0.75) return null;
  const minLag = Math.floor(TARGET_RATE / 1_100);
  const maxLag = Math.floor(TARGET_RATE / 130);
  let mean = 0;
  for (let index = 0; index < usable; index += 1) mean += samples[safeOffset + index];
  mean /= usable;

  const correlations = new Float32Array(maxLag + 1);
  let bestLag = 0;
  let bestScore = -1;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let cross = 0;
    let energyA = 0;
    let energyB = 0;
    const count = usable - lag;
    for (let index = 0; index < count; index += 1) {
      const a = samples[safeOffset + index] - mean;
      const b = samples[safeOffset + index + lag] - mean;
      cross += a * b;
      energyA += a * a;
      energyB += b * b;
    }
    const score = cross / Math.sqrt(Math.max(1e-12, energyA * energyB));
    correlations[lag] = score;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  const strongEnough = Math.max(0.46, bestScore * 0.88);
  for (let lag = minLag + 1; lag < bestLag; lag += 1) {
    if (
      correlations[lag] >= strongEnough &&
      correlations[lag] > correlations[lag - 1] &&
      correlations[lag] >= correlations[lag + 1]
    ) {
      bestLag = lag;
      bestScore = correlations[lag];
      break;
    }
  }
  if (bestLag <= 0 || bestScore < 0.3) return null;
  const frequency = TARGET_RATE / bestLag;
  const midi = 69 + 12 * Math.log2(frequency / 440);
  if (!Number.isFinite(midi) || midi < 47 || midi > 86) return null;
  return { midi, confidence: clamp(bestScore, 0, 1) };
}

function detectStablePitch(
  samples: Float32Array,
  offset: number,
  profile: AnalysisProfile,
  previousPitch: number,
) {
  const delays = profile === "piano" ? [0.022, 0.045, 0.072] : profile === "balanced" ? [0.03, 0.065] : [0.04];
  const candidates = delays
    .map((delay) => detectPitch(samples, offset + Math.round(delay * TARGET_RATE)))
    .filter((candidate): candidate is { midi: number; confidence: number } => Boolean(candidate));
  if (!candidates.length) return null;
  const best = [...candidates].sort((a, b) => b.confidence - a.confidence)[0];
  let midi = Math.round(best.midi);
  if (profile === "piano" && best.confidence < 0.62) {
    while (midi - previousPitch > 7) midi -= 12;
    while (previousPitch - midi > 7) midi += 12;
  }
  return { midi: clamp(midi, 47, 86), confidence: best.confidence };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function estimateTempo(notes: MelodyNote[]): number {
  if (notes.length < 4) return 100;
  const intervals = notes
    .slice(1)
    .map((note, index) => note.time - notes[index].time)
    .filter((interval) => interval >= 0.16 && interval <= 1.5);
  if (!intervals.length) return 100;
  let bpm = 60 / median(intervals);
  while (bpm < 76) bpm *= 2;
  while (bpm > 168) bpm /= 2;
  return Math.round(bpm);
}

function estimateKey(notes: MelodyNote[]): string {
  if (!notes.length) return "待识别";
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const weights = new Array(12).fill(0) as number[];
  for (const note of notes) weights[note.pitch % 12] += note.duration * note.confidence;
  const root = weights.indexOf(Math.max(...weights));
  return `${names[root]} 调感`;
}

function fallbackPulseFrames(frames: AnalysisFrame[]): AnalysisFrame[] {
  const interval = Math.max(1, Math.round((TARGET_RATE / ANALYSIS_HOP) * 0.62));
  return frames.filter((frame, index) => index % interval === 0).slice(0, MAX_NOTES);
}

export async function analyzeMelody(
  buffer: AudioBuffer,
  onProgress?: (progress: number, stage: string) => void,
  requestedOptions: Partial<AnalysisOptions> = {},
): Promise<AnalysisResult> {
  const options: AnalysisOptions = { ...DEFAULT_OPTIONS, ...requestedOptions };
  onProgress?.(0.03, "正在解码完整音频");
  const samples = mixAndResample(buffer);
  await yieldToBrowser();

  const frames = await buildAnalysisFrames(samples, onProgress);
  onProgress?.(0.5, options.profile === "piano" ? "正在锁定钢琴重音" : "正在筛选同步落点");
  let pulses = selectPulseFrames(frames, options);
  if (pulses.length < 3) pulses = fallbackPulseFrames(frames);
  const peakScore = Math.max(0.001, ...pulses.map((frame) => frame.score || frame.rms));

  const notes: MelodyNote[] = [];
  let lastPitch = 60;
  for (let index = 0; index < pulses.length; index += 1) {
    const pulse = pulses[index];
    const detected = detectStablePitch(samples, pulse.offset, options.profile, lastPitch);
    if (detected) lastPitch = detected.midi;
    const nextTime = pulses[index + 1]?.time ?? pulse.time + 0.45;
    notes.push({
      time: Math.max(0, pulse.time - 0.022),
      duration: clamp((nextTime - pulse.time) * 0.72, 0.16, 0.8),
      pitch: lastPitch,
      confidence: detected?.confidence ?? 0.22,
      velocity: clamp((pulse.score || pulse.rms) / peakScore, 0.26, 1),
      source: "spectral",
    });
    if (index % 10 === 0) {
      onProgress?.(0.55 + (index / Math.max(1, pulses.length)) * 0.4, "正在校准触键时间与音高");
      await yieldToBrowser();
    }
  }

  const averageConfidence =
    notes.reduce((total, note) => total + note.confidence, 0) / Math.max(1, notes.length);
  const detectedCoverage = notes.filter((note) => note.confidence > 0.22).length / Math.max(1, notes.length);
  const quality =
    detectedCoverage >= 0.7 && averageConfidence >= 0.55
      ? "high"
      : detectedCoverage >= 0.34
        ? "medium"
        : "exploratory";
  onProgress?.(1, "全曲弹跳轨迹已生成");

  return {
    notes,
    duration: Math.min(buffer.duration, MAX_SECONDS),
    keyLabel: estimateKey(notes),
    tempo: estimateTempo(notes),
    quality,
    diagnostics: {
      profile: options.profile,
      sensitivity: options.sensitivity,
      spectralCount: notes.length,
      modelCandidates: [],
    },
  };
}
