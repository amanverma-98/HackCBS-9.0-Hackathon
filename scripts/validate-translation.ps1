# Dev-only: verifies offline translation pairs with the app's real TranslationEngine on the JVM.
# Downloads the release translation pack (~680 MB, checksum-verified) and ONNX Runtime once into
# a cache, then writes a report. Enable only the languages it lists in
# TranslationEngine.ENABLED and shared/translation-pairs.cjs.
# -English checks the English pack (en-indic + indic-en) from the local model-release folder.
param([string]$Cache = (Join-Path $env:TEMP 'talk2-translation-check'), [switch]$English)
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$pack = Join-Path $Cache 'packs\translation'; $lib = Join-Path $Cache 'lib'; $classes = Join-Path $Cache 'classes'
New-Item -ItemType Directory -Force -Path $pack, $lib, $classes | Out-Null
$manifest = Get-Content model-host/upstream-manifest.json -Raw | ConvertFrom-Json
if ($English) {
  $enPack = Join-Path $Cache 'packs/translation-en'; New-Item -ItemType Directory -Force -Path $enPack | Out-Null
  foreach ($f in $manifest.packs.'translation-en'.files) {
    $dest = Join-Path $enPack $f.name
    if (-not (Test-Path $dest)) { Copy-Item (Join-Path 'model-release' $f.name) $dest }
    if ((Get-FileHash $dest -Algorithm SHA256).Hash.ToLower() -ne $f.sha256) { throw "Checksum mismatch: $($f.name)" }
  }
}
foreach ($f in $manifest.packs.translation.files) {
  $dest = Join-Path $pack $f.name
  if (-not (Test-Path $dest) -or (Get-FileHash $dest -Algorithm SHA256).Hash.ToLower() -ne $f.sha256) {
    Invoke-WebRequest $f.url -OutFile $dest
    if ((Get-FileHash $dest -Algorithm SHA256).Hash.ToLower() -ne $f.sha256) { throw "Checksum mismatch: $($f.name)" }
  }
}
$jars = @{
  'onnxruntime-1.20.0.jar' = 'https://repo1.maven.org/maven2/com/microsoft/onnxruntime/onnxruntime/1.20.0/onnxruntime-1.20.0.jar'
  'json-20240303.jar' = 'https://repo1.maven.org/maven2/org/json/json/20240303/json-20240303.jar'
}
foreach ($name in $jars.Keys) { $dest = Join-Path $lib $name; if (-not (Test-Path $dest)) { Invoke-WebRequest $jars[$name] -OutFile $dest } }
$cp = "$classes;$(Join-Path $lib 'onnxruntime-1.20.0.jar');$(Join-Path $lib 'json-20240303.jar')"
$base = 'mobile/android/app/src/main/java/com/talk2'
& javac -encoding UTF-8 -cp $cp -d $classes tests/stubs/android/content/Context.java "$base/ModelStore.java" "$base/IndicScript.java" "$base/TranslationEngine.java" tests/TranslationCheck.java
if ($LASTEXITCODE -ne 0) { throw 'Compilation failed' }
$report = Join-Path $Cache 'translation-report.txt'
$mode = if ($English) { 'en' } else { 'indic' }
& java "-Dfile.encoding=UTF-8" -cp $cp com.talk2.TranslationCheck $Cache (Resolve-Path model-host/upstream-manifest.json) $report $mode
if ($LASTEXITCODE -ne 0) { throw 'Translation check failed to run' }
Write-Output "Report: $report"
