---
title: Transcript
sidebar_label: Transcript
description: Record calls and turn them into searchable transcripts without sending raw audio off your machine.
---

# Transcript

Wisp's Transcript feature records your calls locally and turns them into structured,
searchable transcripts without sending raw audio to any outside server.

Unlike many AI transcription tools, Wisp doesn't join your call as a bot: the app
recognizes when you join a call and asks for permission to record.

Transcripts are powered by Whisper, a local speech-to-text (ASR) engine built into the Wisp
app. Only its model (574 MB) is downloaded separately, when you click to download it. All
recording and transcription happens on your device: the audio
(microphone and system streams) is captured by the Wisp app, processed, then deleted. No
audio leaves the machine by default. Transcripts are written to encrypted local storage and
stay there.

When you ask Wisp to summarize, search or otherwise work with meeting notes, the encrypted
transcript is sent for processing and is decrypted only inside the same Trusted Execution
Environment (Intel TDX enclave) that handles all of Wisp's model calls. See
[Trusted Execution Environments](../how-it-works/tee.md).

## How the work is split

All local work happens inside the Tauri desktop process, split into two components with a
strict separation of concerns:

- **The Rust host** owns audio capture (microphone and system loopback) and on-device
  speech recognition. It is the only component that touches call audio.
- **The desktop UI** (React) talks to the Rust host over Tauri IPC, not over the network.
  It reaches the local agent sidecar over HTTP on the loopback interface only, authenticated
  with a per-launch token.

From there, transcript text flows to the local agent sidecar, where the agent loop
(LangGraph) and its tools run. All I/O in the sidecar passes through the
[Kernel](../how-it-works/kernel.md), which validates paths, checks permissions and enforces
timeouts before writes are allowed.

## The life of the audio

Raw audio is deliberately short-lived:

1. **Capture.** The Rust host records two tracks: the microphone (you) and the system
   loopback (everyone else). The two tracks are what attribute speech to speakers; there is
   no separate diarization step.
2. **Buffer.** Each track is written to its own `.wav` file, both in one directory.
3. **Transcribe.** Speech recognition runs on-device in chunks, live, as the meeting
   proceeds.
4. **Delete.** Once the transcript is saved and every track is transcribed, the directory
   with both `.wav` files is deleted. If a track fails to transcribe, its audio stays on
   your device so that **Retry** can try again, until a retry succeeds or you delete the
   recording. Audio is never uploaded or kept after that.
5. **Keep the text only.** What remains is the transcript: timestamped segments stored in a
   ChaCha20-Poly1305 encrypted SQLite database, alongside chats, summaries, memory and the
   audit log.
