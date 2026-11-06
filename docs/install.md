# Installing Pulse

The one-line commands are in the [README](../README.md#install). This page says
what they do and how to change it.

## What the installer does

It installs for your user only, with no admin rights and no system packages.

On Windows:

```text
%USERPROFILE%\.local\bin\pulse.cmd       the command
%LOCALAPPDATA%\open-project-pulse\app    the app, replaced on each update
%LOCALAPPDATA%\open-project-pulse\node   its own Node.js, only without Node 20+
%LOCALAPPDATA%\open-project-pulse\data   your data, never touched by updates
```

On macOS and Linux:

```text
~/.local/bin/pulse                       the command
~/.local/share/open-project-pulse/app    the app, replaced on each update
~/.local/share/open-project-pulse/node   its own Node.js, only without Node 20+
~/.local/share/open-project-pulse/data   your data, never touched by updates
```

If the folder holding the command isn't on your `PATH`, it adds it: to your user
`PATH` on Windows, or elsewhere with one line in your login shell's profile, and
in the profile of the shell you ran the installer from if that's a different
one: `~/.zshrc`, `~/.bashrc` (and `~/.bash_profile` on macOS), a file in fish's
`conf.d` folder, or `~/.profile`. A terminal that's already open can't see that
change, so on macOS and Linux the installer ends by printing the command's full
path to use there. `pulse uninstall` leaves the line in place: it does no harm,
and you can delete it.

If the data folder is empty, as on a first install, the installer adds
[the sample project](../README.md#try-the-sample-project).

It downloads the latest release from this repository and, if needed, Node.js from
nodejs.org, and checks the SHA-256 checksum of each.

On macOS and Linux, if no release has been published yet, it builds from the
`main` branch instead, which takes a few minutes. The Windows installer needs a
published release.

## Read the script first

<!-- markdownlint-disable MD013 -->

On Windows:

```powershell
irm https://raw.githubusercontent.com/antonysallas/open-project-pulse/main/install.ps1 -OutFile install.ps1
notepad install.ps1
powershell -ExecutionPolicy ByPass -File install.ps1
```

On macOS and Linux:

```bash
curl -LsSf -o install.sh https://raw.githubusercontent.com/antonysallas/open-project-pulse/main/install.sh
less install.sh
sh install.sh
```

<!-- markdownlint-enable MD013 -->

## On a company laptop

The Windows installer needs no admin rights, but some company policies stop
scripts or programs from running in your user folder. If it says that Node.js
won't run on your computer, install Node.js 20 or later the way your IT team
allows, then run the command again. Pulse then uses that one.

Behind a company proxy, the downloads use your system's proxy settings. If the
install command fails with a 407 error, the proxy wants your Windows sign-in, so
use this command instead:

<!-- markdownlint-disable MD013 -->

```powershell
powershell -ExecutionPolicy ByPass -c "[Net.ServicePointManager]::SecurityProtocol = 'Tls12'; [Net.WebRequest]::DefaultWebProxy.Credentials = [Net.CredentialCache]::DefaultNetworkCredentials; irm https://raw.githubusercontent.com/antonysallas/open-project-pulse/main/install.ps1 | iex"
```

<!-- markdownlint-enable MD013 -->

## Settings

Set these as environment variables before you run the installer. On Windows, for
example, `$env:PULSE_VERSION = 'v0.1.0'` in PowerShell, and on macOS or Linux,
`curl ... | PULSE_VERSION=v0.1.0 sh`.

| Variable                 | What it does                                     |
|:-------------------------|:-------------------------------------------------|
| `PULSE_VERSION`          | Install this release tag (default: the latest)   |
| `PULSE_HOME`             | Where the app and your data live                 |
| `PULSE_BIN_DIR`          | Where the `pulse` command goes                   |
| `PULSE_NO_MODIFY_PATH=1` | Leave your `PATH` alone                          |
| `PULSE_DOWNLOAD_URL`     | A folder holding the release files, for a mirror |
| `PULSE_INSTALL_URL`      | The script `pulse update` runs, for a mirror     |
| `PULSE_NODE_MIRROR`      | A mirror of `https://nodejs.org/dist`            |

On macOS and Linux only:

| Variable              | What it does                                 |
|:----------------------|:---------------------------------------------|
| `PULSE_FROM_SOURCE=1` | Build from the `main` branch, not a release  |
| `PULSE_SOURCE_URL`    | A source archive to build from, for a mirror |
