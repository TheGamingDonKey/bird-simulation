# Run only after creating an empty TheGamingDonKey/bird-simulation repository.
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path -LiteralPath '.git')) {
    throw 'Use the original local checkout, or clone the supplied history bundle before publishing.'
}
$birdRemote = git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0) {
    git remote add origin 'https://github.com/TheGamingDonKey/bird-simulation.git'
} elseif ($birdRemote -ne 'https://github.com/TheGamingDonKey/bird-simulation.git') {
    throw "This checkout has a different origin: $birdRemote"
}
git push --set-upstream origin main
if ($LASTEXITCODE -ne 0) { throw 'Push failed. Complete GitHub sign-in and check repository access.' }
git push origin --tags
if ($LASTEXITCODE -ne 0) { throw 'Code was pushed, but tags failed to upload.' }
Write-Host 'Published: https://github.com/TheGamingDonKey/bird-simulation'
