param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]] $Opciones
)
$ErrorActionPreference = 'Stop'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error 'Se requiere Node.js 22 o superior.'
    exit 1
}
& node (Join-Path $PSScriptRoot 'scripts/verificar.mjs') @Opciones
exit $LASTEXITCODE
