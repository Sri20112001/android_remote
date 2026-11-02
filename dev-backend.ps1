<#
.SYNOPSIS
  Starts the Windows backend agent in development mode with Air live reloading.
#>
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "agent\windows")
& .\scripts\dev.ps1
