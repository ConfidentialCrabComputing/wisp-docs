---
title: The desktop app
sidebar_label: The desktop app
description: Wisp Desktop, the app for chatting with your agent, recording calls, and running Wisp on this computer or on your own server.
---

# The desktop app

Wisp Desktop is the app for working with the [Wisp agent](../how-it-works/agent.md). It
runs a Wisp Runtime on this computer, so it needs nothing else installed. It can also use
the Runtime on a server of yours instead: see [Connect to a server](./connect-to-a-server.md).

The app streams the agent's work as it happens, so you see each tool call run, not just the
final answer. Its fonts ship with the app, so it makes no font requests that would reveal
your usage.

## Signing in

On first launch the welcome screen asks you to sign in. **Continue with sign-in** opens the
browser; if it does not open, **Copy auth link** copies the address to paste into a browser
where you are signed in. The app stays on the welcome screen until you sign in.

## Chatting

- **New Chat** (<kbd>⌘</kbd> <kbd>N</kbd>) starts a conversation. **Recents** in the sidebar
  lists past ones.
- **Projects.** Open a folder (<kbd>⌘</kbd> <kbd>O</kbd>, or the project button by the
  message box) and the chat works in it: the agent can read and change its files, and the
  **Files** panel on the right shows them. See [Sessions and Projects](../sessions-and-projects.md).
- **In the message box**, type `@` to mention a file of the chat's folder, `#` to mention a
  recording, and `/` to use a [skill](../skills.md). Drop files, images or PDFs onto the
  window to attach them.
- **The model picker** chooses the model and turns extended thinking on or off. The meter
  next to it shows how much of the model's context the chat has used.
- **Artifacts** in the sidebar collects every file the agent made, across all chats.
- **Find** (<kbd>⌘</kbd> <kbd>F</kbd>) searches the open chat. **Copy Last Response**
  (<kbd>⌘</kbd> <kbd>⇧</kbd> <kbd>C</kbd>) copies the agent's last answer.

On Windows and Linux, <kbd>Ctrl</kbd> takes the place of <kbd>⌘</kbd>.

## Approving actions

When the agent wants to write a file or run a command (`fs_write`, `fs_edit`, `bash_run`),
the app shows a confirmation card right in the chat, not a modal dialog, and the agent
waits until you answer it: **Allow once**, **Always allow in this project**, **Always allow
everywhere** or **Deny**. A card left unanswered is denied after 2 hours. See
[Permissions](../permissions.md).

## Schedules, connectors and transcripts

- **Schedules** in the sidebar runs prompts on a timetable, with a calendar and an activity
  feed of past runs. On this computer, jobs run only while the app is open; one due while it
  was closed runs once when you open it again. See [Schedules](../schedules.md).
- **Connectors** on the right gives the agent access to other services, such as Gmail,
  Google Drive, Notion or Linear, or to your own MCP server. See [Connectors](../connectors.md).
- **Transcripts** on the right records your calls and turns them into searchable notes, on
  your device. See [Transcript](./transcript.md).

## Privacy and verification

The button in the top right corner says **Private** once the app has verified the enclave
the model runs in, and **Not private** when that check failed. Click it to open the
Verification Center, which shows the checks and how your data flows. When verification
fails, sending messages is locked until a retry passes. See
[Trusted Execution Environments](../how-it-works/tee.md).

## Settings

Open Settings with <kbd>⌘</kbd> <kbd>,</kbd> or the gear next to your name at the bottom of
the sidebar.

| Section | What it holds |
| --- | --- |
| Permissions | which tools run without asking, for all chats or for the open Project |
| Recording | **Detect meetings**: offer to record when a call starts |
| Billing, Usage | your plan, payments, and how much of it you have used |
| Sandbox | **Sandbox terminal commands** and **Allow network in the sandbox**. See [Sandbox](../sandbox.md) |
| Runtime | whether Wisp runs on this computer or on your server. See [Connect to a server](./connect-to-a-server.md) |
| Keyboard | change the menu shortcuts |
| General | **Start at login** (on by default) and the light or dark theme |

**Keyboard Shortcuts** (<kbd>⌘</kbd> <kbd>/</kbd>) lists every shortcut.

## Help and updates

- **Report a problem**, the button in the corner of the window, sends the Wisp team a
  description of what went wrong, with screenshots or files you attach and, only if you
  opt in, the agent's diagnostics log.
- When a new version is ready, an **Update** button appears in the top bar.

## Features

- [Connect to a server](./connect-to-a-server.md): use the Runtime on your own server, over
  an SSH tunnel the app opens itself.
- [Transcript](./transcript.md): record calls and turn them into searchable transcripts,
  on your device.
