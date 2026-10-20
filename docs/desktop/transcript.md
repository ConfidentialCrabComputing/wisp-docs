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

Transcripts work when Wisp runs on this computer. With Wisp
[connected to a server](./connect-to-a-server.md), switch back to **This computer** to record.

## Recording a call

1. **Open Transcripts**, on the right of the window.
2. **Download the model** the first time: the app asks before it downloads the 574 MB
   speech model and shows its progress. If the download fails, retry it from the same place.
3. **Press Record** to capture the call you are on. A **Recording** pill shows while it runs;
   **Pause** and **Resume** stop and continue it without starting a new note.
4. **Press Stop** when the call ends. The transcript appears once it is ready, and a
   notification says **Transcript ready**.

**Meeting detection** does step 3 for you. When an app such as Zoom, Discord or a browser
starts using the microphone, a small Wisp window says **Meeting detected** and offers to
record. It only offers: nothing records until you press **Record**. When the call seems
over and the recording still runs, it reminds you to stop. Turn detection off with **Turn
off meeting detection** in that window, or with **Detect meetings** in Settings →
Recording.

## Working with notes

Each recording becomes a note with a **Summary** and the full **Transcript**.

- **Search transcripts** finds notes by their text.
- **Rename** a note (new ones are called **New note**), or **delete** it.
- **Copy** the summary or the transcript, or **Download** the note as Markdown.
- **Start a chat about this note** opens a chat that mentions it. In any chat, type `#` to
  mention a recording, and the agent reads it when it needs it.
- If a summary fails, **Retry summary**. If a recording fails to transcribe, its **Retry**
  tries again.

## The life of the audio

Raw audio is deliberately short-lived:

1. **Capture.** The app records two tracks: the microphone (you) and the system audio
   (everyone else). The two tracks are what tell you apart from the others in the
   transcript.
2. **Transcribe.** Speech recognition runs on your device, as the meeting goes on.
3. **Delete.** Once the transcript is saved and every track is transcribed, the audio is
   deleted. If a track fails to transcribe, its audio stays on your device so that **Retry**
   can try again, until a retry succeeds or you delete the recording. Audio is never
   uploaded or kept after that.
4. **Keep the text only.** What remains is the transcript: timestamped segments in an
   encrypted database on your device, alongside your chats, summaries, memory and the audit
   log.
