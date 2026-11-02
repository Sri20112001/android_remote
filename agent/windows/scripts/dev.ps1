<#
.SYNOPSIS
  Runs the TUF Remote Windows agent with Air live-reloading.

.EXAMPLE
  .\scripts\dev.ps1
#>
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

if (-not (Get-Command air -ErrorAction SilentlyContinue)) {
    Write-Host "Air is not in PATH. Checking ~/go/bin..." -ForegroundColor Yellow
    $goBin = Join-Path $env:USERPROFILE "go\bin"
    if (Test-Path (Join-Path $goBin "air.exe")) {
        $env:PATH = "$goBin;$env:PATH"
    } else {
        Write-Host "Installing air..." -ForegroundColor Yellow
        go install github.com/air-verse/air@latest
        $env:PATH = "$goBin;$env:PATH"
    }
}

air
