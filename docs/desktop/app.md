---
title: The desktop app
sidebar_label: The desktop app
description: A thin, secret-free shell around the local encrypted agent.
---

# The desktop app

The Wisp desktop app is a thin, secret-free shell around a local encrypted agent. It is
built with Tauri 2.0: a Rust backend and a WebView frontend. Tauri keeps the app native and
small (next to Electron's bundled Chromium), and its fonts are self-hosted, so no Google
Fonts requests leak your usage.

To talk to the [Wisp agent](../how-it-works/agent.md), the app spawns the Node.js agent
sidecar as a child process. Results stream to the app in real time over Server-Sent Events
(SSE), so you see tool calls executing live, not just final answers.

When the agent wants to write a file or run a command (`fs_write`, `fs_edit`, `bash_run`),
the app shows a confirmation card right in the chat, not a modal dialog, and the agent
waits until you answer it: **Allow once**, **Always allow in this project**, **Always allow
everywhere** or **Deny**. A card left unanswered is denied after 2 hours.

## Features

- [Transcript](./transcript.md): record calls and turn them into searchable transcripts,
  on your device.
