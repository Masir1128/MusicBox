# Third-party notices

## Spotify Basic Pitch

ORBITONE uses [`@spotify/basic-pitch`](https://github.com/spotify/basic-pitch-ts) `1.0.1` for browser-side automatic music transcription and redistributes its model files at:

- `public/models/basic-pitch/model.json`
- `public/models/basic-pitch/group1-shard1of1.bin`

Basic Pitch is Copyright 2022 Spotify AB and is licensed under the Apache License, Version 2.0. A copy of that license is included at [`licenses/Apache-2.0.txt`](licenses/Apache-2.0.txt).

The model files in this repository are byte-identical to the files distributed with `@spotify/basic-pitch` `1.0.1`.

## mp4-muxer

ORBITONE uses [`mp4-muxer`](https://github.com/Vanilagy/mp4-muxer) for browser-side MP4 container generation. The package is distributed under the MIT License and is installed through npm rather than vendored into this repository.

## Visual acknowledgement

The square-bounce, note-collision, and MIDI-visualization direction acknowledges GitHub developer [`quasar098`](https://github.com/quasar098) and the open-source project [`quasar098/midi-playground`](https://github.com/quasar098/midi-playground), which is licensed under GPL-3.0. ORBITONE does not redistribute that project's songs, MIDI files, or bundled media. The renderer and procedural demo music published here are maintained as ORBITONE source and original generated assets.
