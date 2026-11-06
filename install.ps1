# Open Project Pulse installer for Windows.
#
#   powershell -ExecutionPolicy ByPass -c "[Net.ServicePointManager]::SecurityProtocol = 'Tls12'; irm https://raw.githubusercontent.com/antonysallas/open-project-pulse/main/install.ps1 | iex"
#
# Installs for this user only; it needs no admin rights and installs no system
# packages. Run it again to update.
#
#   %USERPROFILE%\.local\bin\pulse.cmd       the command
#   %LOCALAPPDATA%\open-project-pulse\app    the app (replaced on update)
#   %LOCALAPPDATA%\open-project-pulse\node   its own Node.js, only if you have no Node 20+
#   %LOCALAPPDATA%\open-project-pulse\data   your projects and reports
#
# A first install, into an empty data folder, adds a made-up sample project to
# look at (`pulse sample --remove` takes it away). After that, this script never
# touches your data.
#
# Optional settings, as environment variables:
#   PULSE_VERSION         a release tag such as v0.1.0 (default: the latest release)
#   PULSE_HOME            where the app and your data live
#   PULSE_BIN_DIR         where pulse.cmd goes (default: %USERPROFILE%\.local\bin)
#   PULSE_NO_MODIFY_PATH  set to 1 to leave your PATH alone
#   PULSE_DOWNLOAD_URL    a folder (https:// or file://) holding the release files, for a mirror
#   PULSE_NODE_MIRROR     a mirror of https://nodejs.org/dist
#
# Everything is inside one script block, run as a whole, so a download cut off
# halfway runs nothing at all. Keep this file ASCII: Windows PowerShell 5.1 reads
# anything else wrongly. It avoids .NET calls where it can, so that where PowerShell
# is locked down (Constrained Language mode) it still installs, and only asks you to
# add the command to your PATH yourself.
& {
  $ErrorActionPreference = 'Stop'
  $ProgressPreference = 'SilentlyContinue' # the progress bar slows downloads badly
  Set-StrictMode -Version 2.0

  # For older setups, and a proxy that wants your Windows sign-in. Locked-down
  # PowerShell refuses these, which matters only if a download then fails.
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072 # TLS 1.2
    [Net.WebRequest]::DefaultWebProxy.Credentials = [Net.CredentialCache]::DefaultNetworkCredentials
  } catch {
    Write-Verbose 'left as they are'
  }

  $Repo = 'antonysallas/open-project-pulse'
  $NodeVersion = '24.22.2' # used only when this computer has no suitable Node.js
  $NodeMinMajor = 20
  $Archive = 'open-project-pulse.tar.gz'

  function Say([string]$Text = '') { Write-Host $Text }

  function Get-Download([string]$Url, [string]$File) {
    if ($Url -like 'file:*') {
      Copy-Item -LiteralPath ([uri]$Url).LocalPath -Destination $File
    } else {
      Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $File
    }
  }

  function Assert-Sha256([string]$File, [string]$Expected) {
    $actual = (Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash
    if (-not $Expected -or $actual -ine $Expected) {
      throw "checksum mismatch on $(Split-Path -Leaf $File): expected $Expected, got $actual. Nothing was installed."
    }
  }

  function Test-Node([string]$Exe) {
    # A warning on stderr must not count as failing: under Stop, 5.1 throws on it.
    $ErrorActionPreference = 'Continue'
    try {
      $major = & $Exe -p "process.versions.node.split('.')[0]" 2>$null
      return ($LASTEXITCODE -eq 0) -and ([int]$major -ge $NodeMinMajor)
    } catch {
      return $false
    }
  }

  # Antivirus often holds a file it has just seen, usually only for a moment.
  function Move-Retrying([string]$From, [string]$To) {
    foreach ($try in 1..5) {
      try {
        Move-Item -LiteralPath $From -Destination $To -Force
        return
      } catch {
        if ($try -eq 5) { throw }
        Start-Sleep -Seconds 1
      }
    }
  }

  # Returns the Node.js that can run Pulse, downloading one if needed. Its own is
  # in a folder named for its version: a running node.exe can't be replaced, and
  # `pulse update` runs from it.
  function Get-Node([string]$PulseHome, [string]$Tmp) {
    $nodeRoot = Join-Path $PulseHome 'node'
    $system = Get-Command node -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($system -and (Test-Node $system.Path)) {
      # Replaced by a good system Node: the old private copy is no longer needed.
      Remove-Item -LiteralPath $nodeRoot -Recurse -Force -ErrorAction SilentlyContinue
      Say "Using Node.js $(& $system.Path -v) from $($system.Path)"
      return $system.Path
    }
    $own = Join-Path $nodeRoot "v$NodeVersion\node.exe"
    if ((Test-Path -LiteralPath $own) -and (Test-Node $own)) {
      Say "Using Pulse's own Node.js v$NodeVersion"
      return $own
    }

    $cpu = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
    switch ($cpu) {
      'AMD64' { $arch = 'x64' }
      'ARM64' { $arch = 'arm64' }
      default { throw "no Node.js download for a $cpu processor. Install Node.js $NodeMinMajor or later yourself, then run this again." }
    }
    $mirror = if ($env:PULSE_NODE_MIRROR) { $env:PULSE_NODE_MIRROR.TrimEnd('/') } else { 'https://nodejs.org/dist' }
    $name = "win-$arch/node.exe"
    Say "No Node.js $NodeMinMajor or later here, so downloading Node.js $NodeVersion for Pulse's own use..."
    $exe = Join-Path $Tmp 'node.exe'
    $sums = Join-Path $Tmp 'SHASUMS256.txt'
    $allowed = "Install Node.js $NodeMinMajor or later the way your IT team allows, then run this again."
    try {
      Get-Download "$mirror/v$NodeVersion/$name" $exe
      Get-Download "$mirror/v$NodeVersion/SHASUMS256.txt" $sums
    } catch {
      throw "couldn't download Node.js from ${mirror}: $($_.Exception.Message) $allowed"
    }
    $line = Select-String -LiteralPath $sums -SimpleMatch "  $name" | Select-Object -First 1
    try {
      Assert-Sha256 $exe $(if ($line) { ($line.Line -split '\s+')[0] } else { '' })
    } catch {
      throw "$($_.Exception.Message) A company proxy may be changing the download. $allowed"
    }
    if (-not (Test-Node $exe)) {
      throw "the Node.js download won't run on this computer, perhaps because of a company policy. $allowed"
    }
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $own) | Out-Null
    Move-Retrying $exe $own
    # Older versions, unless one is running.
    Get-ChildItem -LiteralPath $nodeRoot -Directory | Where-Object { $_.Name -ne "v$NodeVersion" } |
      Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    return $own
  }

  # Returns a checked release archive.
  function Get-Release([string]$Tmp) {
    if ($env:PULSE_DOWNLOAD_URL) {
      $base = $env:PULSE_DOWNLOAD_URL.TrimEnd('/')
    } elseif ($env:PULSE_VERSION -and $env:PULSE_VERSION -ne 'latest') {
      $base = "https://github.com/$Repo/releases/download/$env:PULSE_VERSION"
    } else {
      $base = "https://github.com/$Repo/releases/latest/download"
    }
    $file = Join-Path $Tmp $Archive
    $sum = "$file.sha256"
    try {
      Get-Download "$base/$Archive" $file
      Get-Download "$base/$Archive.sha256" $sum
    } catch {
      throw "couldn't download Pulse from ${base}: $($_.Exception.Message)"
    }
    Assert-Sha256 $file ((Get-Content -LiteralPath $sum -TotalCount 1) -split '\s+')[0]
    return $file
  }

  function Install-App([string]$Release, [string]$PulseHome, [string]$Tmp) {
    $unpacked = Join-Path $Tmp 'unpacked'
    New-Item -ItemType Directory -Force -Path $unpacked | Out-Null
    # Windows' own tar, not one from Git for Windows, which can't read C:\ paths.
    $tar = if ($env:SystemRoot) { Join-Path $env:SystemRoot 'System32\tar.exe' } else { '' }
    if (-not $tar -or -not (Test-Path -LiteralPath $tar)) {
      $found = Get-Command tar -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
      if (-not $found) { throw 'tar is required. It comes with Windows 10 (version 1803 or later) and Windows 11.' }
      $tar = $found.Path
    }
    # Relative paths: this tar garbles characters outside the system's code page,
    # which some user names have.
    Push-Location -LiteralPath $Tmp
    try {
      & $tar -xzf (Split-Path -Leaf $Release) -C 'unpacked'
      $code = $LASTEXITCODE
    } finally {
      Pop-Location
    }
    if ($code -ne 0) { throw "couldn't unpack the download. Nothing was installed." }
    $new = Join-Path $unpacked 'open-project-pulse'
    foreach ($part in 'bin\pulse.js', 'server\server.js', 'build\index.html') {
      if (-not (Test-Path -LiteralPath (Join-Path $new $part))) {
        throw "the downloaded archive isn't a Pulse release. Nothing was installed."
      }
    }
    # All in PulseHome, so the swap is two renames, and data is not involved.
    $app = Join-Path $PulseHome 'app'
    $old = Join-Path $PulseHome 'app.old'
    Remove-Item -LiteralPath $old -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $app) {
      try {
        Move-Retrying $app $old
      } catch {
        throw "Pulse's files are in use. Stop Pulse, close any window open in $app, then run this again. You still have the version you had."
      }
    }
    try {
      Move-Retrying $new $app
    } catch {
      if (Test-Path -LiteralPath $old) { Move-Item -LiteralPath $old -Destination $app }
      throw "couldn't put the new version in place, perhaps because antivirus was scanning it. You still have the version you had. Run this again."
    }
    Remove-Item -LiteralPath $old -Recurse -Force -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force -Path (Join-Path $PulseHome 'data') | Out-Null
  }

  # pulse.cmd. On one line, so that cmd.exe doesn't go back to the file for more
  # after Node exits, by which time `pulse update` or `pulse uninstall` may have
  # changed it. With no fixed user folder in it, a name with accents is no trouble,
  # and for another folder, OEM is the code page cmd.exe reads batch files in.
  function Install-Launcher([string]$PulseHome, [string]$BinDir) {
    $shown = $PulseHome.Replace('%', '%%')
    if ($env:LOCALAPPDATA -and $PulseHome.StartsWith("$env:LOCALAPPDATA\")) {
      $shown = '%LOCALAPPDATA%' + $PulseHome.Substring($env:LOCALAPPDATA.Length).Replace('%', '%%')
    }
    $own = "%PULSE_HOME%\node\v$NodeVersion\node.exe"
    $lines = @(
      '@echo off',
      'rem Written by the Open Project Pulse installer.',
      'setlocal',
      "set `"PULSE_HOME=$shown`"",
      'set "PULSE_LAUNCHER=%~f0"',
      'set "NODE=node"',
      "if exist `"$own`" set `"NODE=$own`"",
      'if "%NODE%"=="node" where node >nul 2>nul || (echo pulse: Node.js is missing. Run the installer again. 1>&2 & exit /b 1)',
      '"%NODE%" "%PULSE_HOME%\app\bin\pulse.js" %* & exit /b'
    )
    New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
    Set-Content -LiteralPath (Join-Path $BinDir 'pulse.cmd') -Value $lines -Encoding Oem
  }

  # Adds the folder to the user's PATH, keeping any %VARIABLES% in it as they are.
  # Returns on (already there), added, off (asked not to) or failed.
  function Add-ToPath([string]$BinDir) {
    $wanted = $BinDir.TrimEnd('\')
    $here = @($env:Path -split ';' | ForEach-Object { $_.TrimEnd('\') })
    if ($here -contains $wanted) { return 'on' }
    if ($env:PULSE_NO_MODIFY_PATH -eq '1') { return 'off' }
    try {
      $current = (Get-Item -Path 'HKCU:\Environment').GetValue('Path', '', 'DoNotExpandEnvironmentNames')
      $saved = @($current -split ';' | ForEach-Object { $_.TrimEnd('\') })
      if ($saved -notcontains $wanted) {
        $next = if ($current) { "$($current.TrimEnd(';'));$BinDir" } else { $BinDir }
        New-ItemProperty -Path 'HKCU:\Environment' -Name Path -Value $next -PropertyType ExpandString -Force | Out-Null
      }
      $env:Path = "$env:Path;$BinDir"
    } catch {
      return 'failed'
    }
    # Tells open programs that it changed, so that new terminals see it.
    try { [Environment]::SetEnvironmentVariable('PULSE_INSTALLER_NOTE', $null, 'User') } catch { Write-Verbose 'not told' }
    return 'added'
  }

  function Install-Pulse {
    if ($env:OS -ne 'Windows_NT') { throw 'this installer is for Windows. On Linux or macOS, use install.sh: see the README.' }
    if (-not $env:LOCALAPPDATA -or -not $env:USERPROFILE) { throw 'LOCALAPPDATA or USERPROFILE is not set.' }
    if (-not (Get-Command Get-FileHash -ErrorAction SilentlyContinue)) { throw 'this needs PowerShell 5 or later, which comes with Windows 10 and 11.' }

    $pulseHome = if ($env:PULSE_HOME) { $env:PULSE_HOME.TrimEnd('\') } else { Join-Path $env:LOCALAPPDATA 'open-project-pulse' }
    $binDir = if ($env:PULSE_BIN_DIR) { $env:PULSE_BIN_DIR.TrimEnd('\') } else { Join-Path $env:USERPROFILE '.local\bin' }
    New-Item -ItemType Directory -Force -Path $pulseHome | Out-Null

    # Next to the install, so that moving the new app into place is one rename.
    $tmp = Join-Path $pulseHome ".install.$(Get-Random)"
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null
    try {
      # The release first: no point fetching Node.js if there is nothing to run on it.
      $release = Get-Release $tmp
      $node = Get-Node $pulseHome $tmp
      Install-App $release $pulseHome $tmp
      Install-Launcher $pulseHome $binDir
      $onPath = Add-ToPath $binDir

      $pulse = Join-Path $pulseHome 'app\bin\pulse.js'
      $data = Join-Path $pulseHome 'data'
      $installed = & $node $pulse version
      if ($LASTEXITCODE -ne 0) { throw "Pulse was installed but doesn't start. Please report this." }
      # Only into an empty data folder. Pulse works without it, so failing here isn't fatal.
      try {
        $note = @(& $node $pulse sample --if-new --data $data)
        if ($LASTEXITCODE -ne 0) { throw 'failed' }
      } catch {
        $note = @("(The sample project couldn't be added. Pulse itself is fine.)")
      }
    } finally {
      Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
    }

    Say
    Say "$installed is installed."
    Say
    switch ($onPath) {
      'added' { Say 'Open a new terminal window, then start it with:  pulse' }
      'on' { Say 'Start it with:  pulse' }
      default {
        Say "Add this folder to your PATH, or start Pulse by its full path: $binDir"
        Say "Start it with:  $(Join-Path $binDir 'pulse.cmd')"
      }
    }
    Say "Your data:      $data"
    if ($note) {
      Say
      $note | ForEach-Object { Say $_ }
    }
  }

  try {
    Install-Pulse
  } catch {
    Write-Host "error: $($_.Exception.Message)" -ForegroundColor Red
    throw 'Pulse was not installed.'
  }
}
