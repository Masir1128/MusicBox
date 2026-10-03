const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/**
 * Schedule a compact, sample-free piano-like tone. Keeping this synthesized
 * means a hand-authored score can be previewed and exported without loading an
 * additional sound library or sending the user's music anywhere.
 */
export function scheduleSynthPianoNote(
  context: AudioContext,
  destination: AudioNode,
  pitch: number,
  velocity = 1,
  when = context.currentTime,
) {
  const start = Math.max(context.currentTime, when);
  const frequency = 440 * 2 ** ((clamp(pitch, 21, 108) - 69) / 12);
  const strength = clamp(velocity, 0.15, 1);
  const envelope = context.createGain();
  const filter = context.createBiquadFilter();

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(Math.min(8_200, frequency * 14), start);
  filter.Q.setValueAtTime(0.72, start);
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(0.2 * strength, start + 0.006);
  envelope.gain.exponentialRampToValueAtTime(0.055 * strength, start + 0.16);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + 1.05);
  filter.connect(envelope);
  envelope.connect(destination);

  ([
    [1, 0.72, "triangle"],
    [2, 0.2, "sine"],
    [3, 0.08, "sine"],
    [4.01, 0.035, "sine"],
  ] as const).forEach(([multiple, level, wave]) => {
    const oscillator = context.createOscillator();
    const partialGain = context.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency * multiple, start);
    oscillator.detune.setValueAtTime((multiple - 1) * 0.8, start);
    partialGain.gain.setValueAtTime(level, start);
    oscillator.connect(partialGain);
    partialGain.connect(filter);
    oscillator.start(start);
    oscillator.stop(start + 1.08);
  });
}
