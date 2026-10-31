$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
$testRoot = Join-Path (Get-Location) '.stage2-java-test'
New-Item -ItemType Directory -Force -Path $testRoot | Out-Null
$jar = Join-Path $testRoot 'json-20240303.jar'
if (-not (Test-Path $jar)) { Invoke-WebRequest 'https://repo.maven.apache.org/maven2/org/json/json/20240303/json-20240303.jar' -OutFile $jar }
$classes = Join-Path $testRoot 'classes'
New-Item -ItemType Directory -Force -Path $classes | Out-Null
$base = 'mobile/android/app/src/main/java/com/talk2'
$names = @('SecureChannel', 'ModelStore', 'VoiceTransfer', 'MeshPacket', 'MeshFragmentCodec', 'MeshSendQueue', 'MeshVoiceStore', 'MeshRouter', 'MeshSeal')
$sources = @('tests/stubs/android/content/Context.java', 'tests/stubs/android/util/Base64.java', 'tests/stubs/android/util/AtomicFile.java', 'tests/stubs/android/security/keystore/KeyProperties.java', 'tests/stubs/android/security/keystore/KeyGenParameterSpec.java')
$sources += $names | ForEach-Object { "$base/$_.java" }
$tests = @('SecureChannelTest', 'ModelStoreTest', 'VoiceTransferTest', 'MeshPacketTest', 'MeshFragmentCodecTest', 'MeshVoiceStoreTest', 'MeshRouterTest', 'MeshSealTest')
$sources += $tests | ForEach-Object { "tests/$_.java" }
& javac -encoding UTF-8 -cp $jar -d $classes $sources
if ($LASTEXITCODE -ne 0) { throw 'Java compilation failed' }
foreach ($test in $tests) {
  $name = if ($test -eq 'SecureChannelTest') { $test } else { "com.talk2.$test" }
  & java -cp "$classes;$jar" $name
  if ($LASTEXITCODE -ne 0) { throw "$test failed" }
}
