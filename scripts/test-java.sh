#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
talk2_test_dir="$(mktemp -d)"
trap 'rm -rf "$talk2_test_dir"' EXIT
curl -fsSL https://repo.maven.apache.org/maven2/org/json/json/20240303/json-20240303.jar -o "$talk2_test_dir/json.jar"
javac -encoding UTF-8 -d "$talk2_test_dir/classes" mobile/android/app/src/main/java/com/talk2/SecureChannel.java tests/SecureChannelTest.java
java -cp "$talk2_test_dir/classes" SecureChannelTest
javac -encoding UTF-8 -cp "$talk2_test_dir/json.jar" -d "$talk2_test_dir/classes" tests/stubs/android/content/Context.java mobile/android/app/src/main/java/com/talk2/ModelStore.java tests/ModelStoreTest.java
java -cp "$talk2_test_dir/classes:$talk2_test_dir/json.jar" com.talk2.ModelStoreTest
javac -encoding UTF-8 -cp "$talk2_test_dir/json.jar" -d "$talk2_test_dir/classes" tests/stubs/android/util/Base64.java mobile/android/app/src/main/java/com/talk2/VoiceTransfer.java tests/VoiceTransferTest.java
java -cp "$talk2_test_dir/classes:$talk2_test_dir/json.jar" com.talk2.VoiceTransferTest
javac -encoding UTF-8 -cp "$talk2_test_dir/json.jar" -d "$talk2_test_dir/classes" tests/stubs/android/util/Base64.java mobile/android/app/src/main/java/com/talk2/MeshPacket.java tests/MeshPacketTest.java
java -cp "$talk2_test_dir/classes:$talk2_test_dir/json.jar" com.talk2.MeshPacketTest
javac -encoding UTF-8 -cp "$talk2_test_dir/json.jar" -d "$talk2_test_dir/classes" tests/stubs/android/util/Base64.java mobile/android/app/src/main/java/com/talk2/MeshPacket.java mobile/android/app/src/main/java/com/talk2/MeshFragmentCodec.java tests/MeshFragmentCodecTest.java
java -cp "$talk2_test_dir/classes:$talk2_test_dir/json.jar" com.talk2.MeshFragmentCodecTest
