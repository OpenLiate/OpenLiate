$exe = Join-Path $PSScriptRoot "dist\cli\openliate.exe"
if (Test-Path $exe) {
    & $exe $args
} else {
    & node "$PSScriptRoot\dist\bin.js" $args
}

