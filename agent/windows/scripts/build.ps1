<#
.SYNOPSIS
  Builds the TUF Remote Windows agent (amd64 by default).

.EXAMPLE
  .\scripts\build.ps1
  .\scripts\build.ps1 -Arch 386 -Output bin\agent-386.exe
#>
[CmdletBinding()]
param(
    [ValidateSet("amd64", "386")]
    [string]$Arch = "amd64",
    [string]$Output = "bin\tuf-remote-agent.exe",
    [switch]$NoStrip
)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$env:GOOS = "windows"
$env:GOARCH = $Arch

$flags = @()
if (-not $NoStrip) { $flags += @("-ldflags", "-s -w") }

New-Item -ItemType Directory -Force -Path (Split-Path $Output) | Out-Null
go build @flags -o $Output ./cmd/agent
if ($LASTEXITCODE -ne 0) { throw "build failed" }

Write-Host "built $Output (windows/$Arch)" -ForegroundColor Green
