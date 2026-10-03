import { ArrayBufferTarget, Muxer } from "mp4-muxer";
import { renderMusicBox, type VisualStyle } from "./renderMusicBox";
import { seekMazeVideoFrame, setMazeVideoExternalSync } from "./renderSquareMazeMusicBox";
import type { MelodyNote } from "./melodyAnalyzer";
import { scheduleSynthPianoNote } from "./synthPiano";

/**
 * Frame-accurate offline video export.
 *
 * Real-time MediaRecorder capture races the audio clock: when rendering plus
 * encoding saturates the CPU, frames are dropped and the ball visibly falls
 * behind the beat. This exporter instead renders every frame at an exact
 * timestamp (the scene is a pure function of time) and hands it to the
 * hardware-backed WebCodecs encoder, so the result can never stutter or drift
 * — no matter how heavy the resolution or how slow the machine is.
 */

export type OfflineExportOptions = {
  width: number;
  height: number;
  bitrate: number;
  notes: MelodyNote[];
  duration: number;
  style: VisualStyle;
  audioBytes: ArrayBuffer;
  pianoEnabled: boolean;
  pianoVolume: number;
  onProgress?: (ratio: number) => void;
};

const FPS = 30;
const AUDIO_SAMPLE_RATE = 48_000;
const AUDIO_BITRATE = 192_000;
const AUDIO_FRAME_SAMPLES = 1024;

export function isOfflineExportSupported() {
  return (
    typeof VideoEncoder !== "undefined" &&
    typeof AudioEncoder !== "undefined" &&
    typeof VideoFrame !== "undefined" &&
    typeof AudioData !== "undefined"
  );
}

async function renderMixedAudio(options: OfflineExportOptions) {
  const frameCount = Math.max(1, Math.ceil(options.duration * AUDIO_SAMPLE_RATE));
  const context = new OfflineAudioContext(2, frameCount, AUDIO_SAMPLE_RATE);
  const decoded = await context.decodeAudioData(options.audioBytes.slice(0));
  const source = context.createBufferSource();
  source.buffer = decoded;
  source.connect(context.destination);
  source.start(0);
  if (options.pianoEnabled) {
    const pianoGain = context.createGain();
    pianoGain.gain.value = clamp(options.pianoVolume, 0, 100) / 100;
    pianoGain.connect(context.destination);
    const sorted = [...options.notes].sort((a, b) => a.time - b.time);
    sorted.forEach((note) => {
      scheduleSynthPianoNote(context as unknown as AudioContext, pianoGain, note.pitch, note.velocity, note.time);
    });
  }
  return context.startRendering();
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const waitForDequeue = (encoder: VideoEncoder | AudioEncoder) =>
  new Promise<void>((resolve) => encoder.addEventListener("dequeue", () => resolve(), { once: true }));

export async function exportOfflineVideo(options: OfflineExportOptions): Promise<Blob> {
  const { width, height, bitrate } = options;

  const videoConfig: VideoEncoderConfig = {
    codec: height > 1280 ? "avc1.640033" : "avc1.640028",
    width,
    height,
    bitrate,
    framerate: FPS,
    hardwareAcceleration: "prefer-hardware",
    avc: { format: "avc" },
  };
  const audioConfig: AudioEncoderConfig = {
    codec: "mp4a.40.2",
    sampleRate: AUDIO_SAMPLE_RATE,
    numberOfChannels: 2,
    bitrate: AUDIO_BITRATE,
  };
  const [videoSupport, audioSupport] = await Promise.all([
    VideoEncoder.isConfigSupported(videoConfig),
    AudioEncoder.isConfigSupported(audioConfig),
  ]);
  if (!videoSupport.supported) throw new Error("H.264 video encoding is not supported in this browser");
  if (!audioSupport.supported) throw new Error("AAC audio encoding is not supported in this browser");

  options.onProgress?.(0.02);
  const mixedAudio = await renderMixedAudio(options);
  options.onProgress?.(0.08);

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width, height, frameRate: FPS },
    audio: { codec: "aac", sampleRate: AUDIO_SAMPLE_RATE, numberOfChannels: 2 },
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });

  let encoderError: Error | null = null;
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (error) => {
      encoderError = error;
    },
  });
  videoEncoder.configure(videoConfig);
  const audioEncoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (error) => {
      encoderError = error;
    },
  });
  audioEncoder.configure(audioConfig);

  // Encode the rendered audio in AAC-frame-sized chunks.
  const totalSamples = mixedAudio.length;
  const left = mixedAudio.getChannelData(0);
  const right = mixedAudio.numberOfChannels > 1 ? mixedAudio.getChannelData(1) : left;
  for (let offset = 0; offset < totalSamples; offset += AUDIO_FRAME_SAMPLES) {
    if (encoderError) throw encoderError;
    const length = Math.min(AUDIO_FRAME_SAMPLES, totalSamples - offset);
    const planar = new Float32Array(length * 2);
    planar.set(left.subarray(offset, offset + length), 0);
    planar.set(right.subarray(offset, offset + length), length);
    const audioFrame = new AudioData({
      format: "f32-planar",
      sampleRate: AUDIO_SAMPLE_RATE,
      numberOfChannels: 2,
      numberOfFrames: length,
      timestamp: (offset / AUDIO_SAMPLE_RATE) * 1e6,
      data: planar.buffer,
    });
    audioEncoder.encode(audioFrame);
    audioFrame.close();
    if (audioEncoder.encodeQueueSize > 12) await waitForDequeue(audioEncoder);
  }
  await audioEncoder.flush();
  audioEncoder.close();
  options.onProgress?.(0.12);

  // Render every frame at its exact timestamp and encode it.
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  const backingScale = width / 540;
  context.setTransform(backingScale, 0, 0, backingScale, 0, 0);
  context.imageSmoothingEnabled = true;

  const totalFrames = Math.max(1, Math.round(options.duration * FPS));
  // With an MV-style video background, drive its playhead frame-by-frame and
  // wait for each seek to decode, so the background is as frame-accurate as
  // the ball. External sync keeps the live preview from fighting the exporter
  // over the shared video element.
  const backgroundVideoUrl = options.style.layoutTemplate === "square-maze"
    ? options.style.mazeCustomVideoUrl
    : "";
  if (backgroundVideoUrl) setMazeVideoExternalSync(backgroundVideoUrl, true);
  try {
    for (let index = 0; index < totalFrames; index += 1) {
      if (encoderError) throw encoderError;
      const frameTime = index / FPS;
      if (backgroundVideoUrl) await seekMazeVideoFrame(backgroundVideoUrl, frameTime);
      renderMusicBox(context, 540, 960, frameTime, options.notes, options.duration, options.style);
      const frame = new VideoFrame(canvas, {
        timestamp: Math.round((index * 1e6) / FPS),
        duration: Math.round(1e6 / FPS),
      });
      videoEncoder.encode(frame, { keyFrame: index % (FPS * 2) === 0 });
      frame.close();
      if (videoEncoder.encodeQueueSize > 4) await waitForDequeue(videoEncoder);
      if (index % 6 === 0) {
        options.onProgress?.(0.12 + (index / totalFrames) * 0.86);
        // Yield so the progress bar and page stay responsive during long exports.
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  } finally {
    if (backgroundVideoUrl) setMazeVideoExternalSync(backgroundVideoUrl, false);
  }
  await videoEncoder.flush();
  videoEncoder.close();
  if (encoderError) throw encoderError;

  muxer.finalize();
  options.onProgress?.(1);
  return new Blob([muxer.target.buffer], { type: "video/mp4" });
}
