---
description: Reach the Runtime from another machine over TLS, give each device its own token, and keep the encryption key on a server.
---

# Remote access

The Runtime listens on `127.0.0.1` and keeps its keys in the OS keyring. This page is for
running it on a server: reaching it from elsewhere, a token per device, and the key file a
Linux server needs.

## Reaching it from another machine

The Runtime speaks plain HTTP, and one token authorises everything it does, `bash` included.

:::warning
**The token must never cross a network in clear.** Put a reverse proxy that terminates TLS
in front of the Runtime, and give callers its `https://` address.
:::

The proxy forwards the name the caller used (`wisp.example.com`) as the `Host` header. The
Runtime refuses any `Host` that is not loopback or listed in `allowedHosts`, which keeps a
web page from reaching it through DNS rebinding. With the proxy on the same machine:

1. List the name in `allowedHosts` in `runtime.json`, and restart the Runtime. It stays on
   loopback:

   ```json
   { "agentToken": "…", "allowedHosts": ["wisp.example.com"] }
   ```

2. Put a [Caddy](https://caddyserver.com) site in front of it. Caddy gets and renews the
   certificate itself and streams the Event stream without buffering:

   ```text
   wisp.example.com {
       reverse_proxy 127.0.0.1:3008
   }
   ```

3. Check it from anywhere: `wisp status --url https://wisp.example.com --token …`.

With the proxy on another machine, also set `host` to the address the proxy connects to,
a private network address rather than `0.0.0.0`, and list that address in `allowedHosts`
as well: `wisp` on the Runtime's own machine finds it there. A non-loopback `host` with an empty
`allowedHosts` stops `wisp serve` with exit **78**. Opening the listener does not open the
Runtime to browsers: its CORS allowlist still names only local origins.

Wisp Desktop ignores `host`. It always listens on loopback and logs that it ignored the
setting.

## A token per device

Rather than copy the one token to every machine you work from, give each its own named
token, so that losing one laptop costs you that laptop's token alone.

1. Run the command on the Runtime's host, over SSH from the device the token is for, so the
   token is printed where it will be used and never travels on its own:

   ```sh
   ssh you@server wisp tokens create --name laptop --capability full
   # Token:             Q2xhdWRlIHdyb3RlIHRoaXMgZXhhbXBsZSB0b2tlbg
   # Connection string: wisp+https://wisp.example.com#Q2xhdWRlIHdyb3RlIHRoaXMgZXhhbXBsZSB0b2tlbg
   #
   # Shown once. Paste the connection string into Wisp Desktop (Settings → Runtime)
   # or `wisp telegram setup`; use the token as WISP_TOKEN for `wisp slack` or a script.
   ```

   When the connection string names `127.0.0.1` (no `--public-url`, and `allowedHosts` does
   not name exactly one host), it works on the Runtime's host only, and the command says so:
   reach it from the device through an SSH tunnel on the same port, or make the token again
   with `--public-url`. `--json` prints the token and the connection string with no hint.

2. Give the device the connection string: Wisp Desktop's field, or `WISP_URL` and
   `WISP_TOKEN` for a script.
3. List and revoke tokens on the host:

   ```sh
   wisp tokens list
   # laptop  full  -  2026-10-13T09:12:44.120Z
   wisp tokens revoke laptop
   # revoked laptop
   ```

A `full` token reaches everything the one token does except the tokens themselves: only the
one token creates, lists and revokes them (a named token gets `403`), so no token can mint one
that outlives its own revocation. A `run` token is for a Channel adapter: it starts Runs only
in Desk Sessions and answers only its own Prompts, but it can read every Session and Run and
cancel any Session's Run; with `--channel` it delivers to that Channel alone (see [Tokens for an adapter](./adapter-contract.md#tokens-for-an-adapter)). The third
column of `wisp tokens list` is that Channel, `-` for none. A revoked token is
refused with `401` from its next request on; the one token and every other named token keep
working. The Runtime keeps only a hash of each token in `global.db`.

The connection string, `wisp+<url>#<token>`, is the one line a device takes, Wisp Desktop's
field among them; the bare token is for a script or an adapter's config. The token sits in the
fragment, so a string pasted into a browser by mistake sends it to no server. The URL is:

- `--url` when you give it (with `--token`, the one token): the address this device reached;
- else `https://` and the host, when `allowedHosts` names exactly one;
- else the address `wisp` reaches the Runtime at on its host, `http://127.0.0.1:3008` by
  default. Reach it from the device through an SSH tunnel on the same port, so the string
  works unchanged: `ssh -N -L 3008:127.0.0.1:3008 you@server`.

## The encryption key on a server

A Linux keyring does not survive a reboot on a server, so `wisp serve` on Linux never uses
one: it takes its root key from a file, 32 random bytes as one base64 line.

**With the installer's service you have nothing to do.** It writes the key to
`~/.config/wisp/master.key` once, never replaces it, and sets `WISP_MASTER_KEY_FILE` in
`wisp.service`. It refuses to install over a data directory whose key file is gone, rather
than make a new key over your data.

Without the service:

1. Make the key yourself before the first `wisp serve`:

   ```bash
   mkdir -p ~/.config/wisp
   (umask 077; openssl rand -base64 32 > ~/.config/wisp/master.key)
   ```

2. Pass it with `WISP_MASTER_KEY_FILE=/home/you/.config/wisp/master.key`, an absolute path:
   a systemd `Environment=` line does not expand `~`.

The file must belong to the user running `wisp serve`, be readable by nobody else
(`chmod 600`), and live outside the data directory. Everything the Runtime would otherwise
keep in the keyring, the login among it, is stored encrypted under this key in
`WISP_HOME/keys/`.

The key file works on macOS and Windows too, for a server with no keychain session. A data
directory made with a key file stays bound to it: started without `WISP_MASTER_KEY_FILE`, or
a keyring directory started with one, the Runtime stops with exit 78 rather than mix keys.

`WISP_MASTER_KEY` takes the same line directly. Prefer the file: an environment variable
can be read from `/proc/<pid>/environ` and shows up in a service manager's output
(`systemctl show`, a unit file).

:::warning[Back the key file up]
Without it the data directory cannot be opened: the Runtime refuses to start (exit 78)
rather than make new keys over your data. It makes them only in an empty data directory.
:::
