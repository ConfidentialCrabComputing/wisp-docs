---
description: Send the agent voice messages, images and documents, and get back the files it writes — the speech model, the limits, and the artifacts route.
---

# Voice and files

A message to the agent can carry more than words: images, PDFs and text files, and voice.
The [Telegram bot](./telegram-bot.md#files-and-voice-messages) and the
[Slack app](./slack-app.md#files) do this for you. Your own adapter sends the same as content
blocks in a Run's `input`; see [A message is a Run](./adapter-contract.md#a-message-is-a-run).

The Runtime turns all of it into what the agent reads on its own machine, before the turn: a
PDF into its text, a voice message into its words. No transcription or parsing service is
called.

## Voice messages

Voice needs a speech model on the Runtime's host. It is not installed with Wisp: it is a
one-time 643 MB download, made only when you ask for it.

```sh
wisp speech            # whether it is installed, downloading or failed
wisp speech install    # download it, printing progress, and wait until it is ready
```

`wisp speech install` exits `0` once the model is ready, at once if it already is, and `1`
with the error if the download fails; run it again to retry. Each file is pinned by revision
and sha256, so a changed file is refused.

Until it is installed, a message with voice fails its Run as `speech_not_installed`. No Run
downloads the model on its own. The Telegram bot instead offers its owner a card to install
it and shows the progress.

What it hears:

- **Formats:** OGG/Opus, MP3 and WAV. Any other type, M4A included, fails the Run as
  `transcription_failed`.
- **Length:** up to 5 minutes a clip. A longer one fails as `transcription_failed`, as does
  one with no speech in it.
- **Languages:** detected on its own among 25 European ones: Bulgarian, Croatian, Czech,
  Danish, Dutch, English, Estonian, Finnish, French, German, Greek, Hungarian, Italian,
  Latvian, Lithuanian, Maltese, Polish, Portuguese, Romanian, Slovak, Slovenian, Spanish,
  Swedish, Russian and Ukrainian.

:::warning
Speech in any other language does not fail: it comes back as made-up text. The agent then
answers words nobody said.
:::

The transcript takes the voice message's place before the agent reads it, and keeps its
author mark. A Run's Event stream shows it as `audio.transcribed`, so an adapter can show the
user what was heard.

For an adapter: an `audio` block is `{ "type": "audio", "mediaType": "audio/ogg", "data":
"<base64>" }`. `GET /v1/speech` and `POST /v1/speech/download` are the model's readiness and
install; a `run` token may call both, so an adapter can offer the install to its owner. See
[Speech](./reference.md#speech).

## Images

An image goes in as a `data:` URI; the Runtime fetches no URL on the sender's behalf. It may
be up to `maxImageSizeBytes`, 10 MiB by default; a larger one fails the Run. The image is kept
with the Session, so later messages can refer back to it.

```json
{ "type": "image_url", "image_url": { "url": "data:image/png;base64,…" } }
```

## Documents

A `document` block carries a file's bytes, and the Runtime turns it into text before the agent
reads it, so an adapter needs no parser:

- **PDF** (`application/pdf`) is read as its text. A PDF with no text to extract, such as a
  scan without a text layer or one with a password, does not fail the Run: the agent is told
  no text could be extracted.
- **Text**: any `text/*` type, `application/json`, `application/xml` and
  `application/yaml`, read as UTF-8.
- **Anything else**, or a text file that turns out to be binary, fails the Run as
  `unsupported_document`.

The text of all the documents in one message is capped at `fsMaxFileSize` characters
(10485760 by default); past that it is cut, with a note saying so.

```json
{ "type": "document", "filename": "report.pdf", "mediaType": "application/pdf", "data": "<base64>" }
```

A whole request body is at most 150 MB, so everything in one message, base64 included, must
fit in that.

## Files the agent writes

Each Run lists the files it wrote as `artifacts`: paths relative to the Session's folder, its
Project or its Desk. The bot and the app send them back after the answer, as documents in
Telegram and uploads into the thread in Slack.

```json
{ "runId": "…", "status": "completed", "output": { "text": "…" }, "artifacts": ["notes/4711.md"] }
```

`GET /v1/runs/{runId}/artifacts/{index}` answers the `index`-th one's bytes, with its media
type and its filename as `Content-Disposition`, to send on as a file. It serves only the files
that list names, never another file in the folder. It is `404` when the Run is unknown or has
not ended, when the index is past the list, or when the file is gone.

Only what the file tools write is listed: `fs_write` and `fs_edit`. A file a `bash_run`
command writes is not an artifact; ask the agent to write its result with the file tools when
you want it sent back.
