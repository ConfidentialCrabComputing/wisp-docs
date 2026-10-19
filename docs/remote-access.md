---
description: Reach the Runtime from Wisp Desktop over SSH or from anything else over TLS, give each device its own token, and keep the encryption key on a server.
---

# Remote access

The Runtime listens on `127.0.0.1` and keeps its keys in the OS keyring. This page is for
running it on a server: reaching it from elsewhere, a token per device, and the key file a
Linux server needs.

## Reaching it from another machine

The Runtime speaks plain HTTP, and one token authorises everything it does, `bash` included.

:::warning
**The token must never cross a network in clear.** From Wisp Desktop, reach it over SSH. For
anything else, put a reverse proxy that terminates TLS in front of the Runtime and give
callers its `https://` address.
:::

### From Wisp Desktop, over SSH

Wisp Desktop opens the SSH tunnel to the server itself, with the system `ssh`, your keys,
your agent and `~/.ssh/config`. This opens no port on the server and needs no domain.

1. Make a token over SSH from the laptop:
   `ssh you@server wisp tokens create --name laptop --capability full`. In an SSH session
   it prints a `wisp+ssh://…` connection string (see [A token per device](#a-token-per-device)).
2. Paste it into Wisp Desktop, Settings → Runtime. A **Server** field shows `user@host[:port]`
   from the string. Correct it if the laptop reaches the server by another name: an address
   behind NAT, or an alias from `~/.ssh/config`, which `ssh` reads.
3. Add it. The desktop starts the tunnel on a free local port, checks the Runtime through
   it, and saves the server with the token in the keychain.

From then on the desktop opens the tunnel at launch and keeps it up. After a drop, a sleep or
a network change, `ssh` notices within about 45 seconds and the desktop starts it again,
after 1 second at first and backing off to 30. Under the remote, Settings → Runtime says
**Connecting to the server…**, **Connected**, **Reconnecting** with the last error, or the
error with a **Retry** button. Picking **This computer** or quitting closes the tunnel.

The desktop needs:

- **Key access without a prompt.** It never asks for a passphrase or a password. A key
  with a passphrase must be in your agent: `ssh-add`, on macOS
  `ssh-add --apple-use-keychain`.
- **On Windows, the OpenSSH Client**, which Windows 10 1809 and later and Windows 11
  ship: Settings → Apps → Optional features → OpenSSH Client.

What the status line says, and what to do:

| It says | Cause | Fix |
| --- | --- | --- |
| The server refused your key | No key the server takes, or a key with a passphrase and no agent | `ssh-add`, then **Retry** |
| The server's host key changed | The server's key differs from the one in `~/.ssh/known_hosts` | Check with whoever runs it, remove the old key, then **Retry** |
| Host not found | The Server does not resolve | Correct the Server |
| The server is unreachable | Timeout, refused, no route, or the connection dropped | Check the Server and your network; it retries on its own |
| The tunnel is open but no Runtime answers | Nothing listens behind the tunnel | `systemctl --user start wisp` (or `wisp serve`) on the server |
| OpenSSH client not found | No `ssh` on `PATH` or in Windows' OpenSSH folder | Install the OpenSSH Client |
| Another program holds the tunnel's port | A program took the saved local port | Nothing: the desktop picks a new port and reloads the window |

Each one shows the line `ssh` printed under it, and a message the desktop does not know is
shown as that line alone. A refused key, a changed host key and a missing `ssh` stop the
retries until you press **Retry** or change the connection.

:::warning[The first connection trusts the server's key]
The desktop accepts the host key of a server not yet in `~/.ssh/known_hosts` and records it
(`StrictHostKeyChecking=accept-new`); a changed key is refused. On that very first
connection, a machine impersonating the server would get the token through the tunnel. In
the usual flow the server is already known, since you just reached it over SSH to make the
token. If you edit the Server to a name `ssh` has not seen, connect to it once by hand and
check its fingerprint first.
:::

### Everything else, through a TLS proxy

`wisp telegram setup`, `wisp slack`, scripts and other machines do not open a tunnel
themselves. Give them an `https://` address, or [a tunnel you open by hand](#a-token-per-device).

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
   # Connection string: wisp+ssh://you@203.0.113.7/127.0.0.1:3008#Q2xhdWRlIHdyb3RlIHRoaXMgZXhhbXBsZSB0b2tlbg
   #
   # Shown once. Paste the connection string into Wisp Desktop (Settings → Runtime),
   # which opens the SSH tunnel itself; use the token as WISP_TOKEN for `wisp slack` or a script.
   # For `wisp telegram setup` or a script on another machine, open the tunnel yourself
   # (ssh -N -L 3008:127.0.0.1:3008 you@203.0.113.7) and use wisp+http://127.0.0.1:3008#<token>.
   ```

   With `--public-url`, or one host in `allowedHosts`, the string is `wisp+https://…` and
   the hint says to paste it into Wisp Desktop or `wisp telegram setup`. Run on the host
   itself, outside SSH, the string names `127.0.0.1` and works on that host only, and the
   command says so: run it over SSH instead, open a tunnel, or make the token again with
   `--public-url`. `--json` prints the token and the connection string with no hint.

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
- else, in an SSH session, `ssh://<user>@<server>[:<ssh port>]/127.0.0.1:<port>`: your user
  (`USER`), the server address and port this session came in on (`SSH_CONNECTION`, port 22
  left out), and the Runtime's loopback address behind them. Only Wisp Desktop takes this
  form. A user or server that `ssh` could read as an option falls through to the next;
- else the address `wisp` reaches the Runtime at on its host, `http://127.0.0.1:3008` by
  default.

For anything but the desktop, reach a loopback Runtime through a tunnel you open on the same
port, so the `http` string works unchanged: `ssh -N -L 3008:127.0.0.1:3008 you@server`, then
`wisp+http://127.0.0.1:3008#<token>`. `wisp telegram setup` refuses a `wisp+ssh://` string
before it sends anything, and prints that tunnel command and string for it.

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
