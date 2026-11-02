<#
.SYNOPSIS
  Runs the full verification suite: formatting check, go vet and tests.

.EXAMPLE
  .\scripts\test.ps1
  .\scripts\test.ps1 -Arch 386 -Race
#>
[CmdletBinding()]
param(
    [ValidateSet("amd64", "386")]
    [string]$Arch = "amd64",
    [switch]$Race
)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

# 1. Formatting: every file must be gofmt-clean.
$unformatted = gofmt -l .
if ($unformatted) {
    Write-Host "gofmt needed on:" -ForegroundColor Red
    $unformatted
    exit 1
}
Write-Host "gofmt: ok" -ForegroundColor Green

# 2. Static analysis.
$env:GOARCH = $Arch
go vet ./...
if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host "go vet: ok" -ForegroundColor Green

# 3. Tests.
$testArgs = @("./...")
if ($Race) { $testArgs = @("-race") + $testArgs }
go test @testArgs
if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host "go test: ok" -ForegroundColor Green
