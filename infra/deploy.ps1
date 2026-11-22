# Builds the web app on this PC and deploys it to the EC2 instance (Caddy serves it and forwards /ingest to Supabase).
# Usage (from the repo root):
#   .\infra\deploy.ps1                    # or: npm run deploy
#   .\infra\deploy.ps1 -SkipBuild         # re-deploy the last build
param(
  # Server address and SSH key come from your machine, never from the repo:
  #   $env:GULLAK_HOST = "<ec2 ip>"; $env:GULLAK_KEY = "<path to .pem>"
  [string]$HostName = $env:GULLAK_HOST,
  [string]$User = "ec2-user",
  [string]$Key = $env:GULLAK_KEY,
  [string]$Domain = "gullak.sparkstudio.co.in",
  # Old addresses that should permanently redirect to $Domain (space-separated), if any.
  [string]$OldDomains = "",
  [switch]$SkipBuild
)
if (-not $HostName -or -not $Key) { throw 'Set $env:GULLAK_HOST and $env:GULLAK_KEY first (see the top of this file).' }
# Native tools (npm, ssh) write progress to stderr; failures are caught via $LASTEXITCODE instead.
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not $SkipBuild) {
  Write-Host "== building web app"
  npm --workspace @gullak/mobile run build:web | Out-Host
  if ($LASTEXITCODE -ne 0) { throw "web build failed" }
}

Write-Host "== packing release"
$stage = Join-Path $env:TEMP "gullak-release"
Remove-Item -Recurse -Force $stage -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $stage | Out-Null
Copy-Item -Recurse apps\mobile\dist "$stage\dist"
$tgz = Join-Path $env:TEMP "gullak-release.tgz"
tar -czf $tgz -C $stage dist
if ($LASTEXITCODE -ne 0) { throw "tar failed" }

# Unix line endings, no byte-order mark (Windows PowerShell adds one when piping to ssh).
$setup = Join-Path $env:TEMP "gullak-setup.sh"
$text = [IO.File]::ReadAllText("$PSScriptRoot\remote-setup.sh").Replace("`r", "").TrimStart([char]0xFEFF)
[IO.File]::WriteAllText($setup, $text, (New-Object Text.UTF8Encoding $false))

Write-Host "== uploading"
$target = "$User@$HostName"
scp -i $Key -o BatchMode=yes $tgz $setup "${target}:/tmp/"
if ($LASTEXITCODE -ne 0) { throw "upload failed" }

Write-Host "== installing on the server"
ssh -i $Key -o BatchMode=yes $target "DOMAIN=$Domain OLD_DOMAINS='$OldDomains' bash /tmp/gullak-setup.sh"
if ($LASTEXITCODE -ne 0) { throw "remote setup failed" }

Write-Host "== done: https://$Domain"
