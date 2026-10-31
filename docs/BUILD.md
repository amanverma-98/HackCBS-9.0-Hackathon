# Build and install

## Toolchain

Use Node.js 22+, JDK 17, Android SDK 35, Build Tools 35.0.0, and NDK 26.1.10909125. This project pins React Native 0.76.9 to use its Java-compatible legacy NativeModule bridge. It is a compatibility baseline, not a claim that 0.76 is the latest React Native. A later React Native upgrade needs its normal Android/toolchain/architecture migration.

`npm ci` installs the locked dependencies. All commands below start at the Talk2 repository root unless stated otherwise.

```sh
npm ci
npm run check
mkdir -p /tmp/talk2-java-tests
javac -d /tmp/talk2-java-tests mobile/android/app/src/main/java/com/talk2/SecureChannel.java tests/SecureChannelTest.java
java -cp /tmp/talk2-java-tests SecureChannelTest
```

On Windows, use a local directory instead of `/tmp` and normal Windows paths as needed.

For both Java crypto and model-store integrity checks on Linux/macOS or CI, run `bash scripts/test-java.sh`. It downloads the pinned `org.json` test dependency into a temporary directory and cleans up afterward.

## Development

Enable USB debugging, connect a data-capable cable, unlock the phone and accept
the computer authorization. From the repository root on Windows:

```powershell
adb devices
adb reverse tcp:8081 tcp:8081
npm start
```

In another terminal:

```powershell
cd mobile\android
.\gradlew.bat :app:installDebug
```

Do not start a second Metro process. `EADDRINUSE` means port 8081 already has one.
If already inside `mobile`, use `cd android`, not `cd mobile/android`.

A regular `debug` APK expects Metro. It installs as `com.talk2.dev` with label
Talk2 Dev, so it can coexist with the standalone app and avoid signing conflicts.
Its state and downloaded packs are separate. Reinstall after Java/Gradle changes;
JavaScript and TypeScript use Fast Refresh.

## Standalone test APK

The `standalone` build type is release-like with a JS bundle and Android's debug signing key. It is for local testing and must not be uploaded to Play as your production signing identity.

```sh
cd mobile/android
./gradlew :app:assembleStandalone
```

Windows: `gradlew.bat :app:assembleStandalone`.

Output: `mobile/android/app/build/outputs/apk/standalone/app-standalone.apk`.

Install with `adb install -r PATH_TO_APK`. An update requires the same signing key. If the previous app used another key, Android will require uninstalling it first; uninstalling deletes its private model packs and history.

## Android App Bundle

Create your own upload keystore:

```sh
keytool -genkeypair -v -keystore talk2-upload.jks -alias talk2 -keyalg RSA -keysize 3072 -validity 10000
```

Set these environment variables locally or through CI secrets:

```text
TALK2_KEYSTORE=/absolute/path/to/talk2-upload.jks
TALK2_STORE_PASSWORD=your password
TALK2_KEY_ALIAS=talk2
TALK2_KEY_PASSWORD=your key password
```

Then:

```sh
cd mobile/android
./gradlew :app:bundleRelease
```

Output: `mobile/android/app/build/outputs/bundle/release/app-release.aab`. Without the signing variables the release bundle is unsigned and requires signing before publication. An AAB is not an APK; use Play's internal testing or bundletool to install derived APKs.

The repository's GitHub Actions workflow runs checks, Java crypto tests, builds the standalone APK and builds the unsigned release AAB. Download its artifacts from the Actions run. Signing a production release requires your own secrets and publishing setup; nothing is uploaded to a store by this workflow.

## No Kotlin source in your repository

Every native app class is Java; project Gradle files are Groovy. The archive contains no `.kt` or `.kts` files, and CI verifies this for tracked source. React Native dependencies/build plugins internally use Kotlin; they are third-party code installed outside git tracking. Do not commit `node_modules`, `.gradle`, build directories or extracted upstream branches. GitHub's language breakdown is based on committed source; there is no need to disguise language detection.

## Two physical phones

Follow `DEVICE_TESTS.md` before distribution. Android emulators do not establish representative Wi-Fi Direct/Bluetooth behavior. No successful desktop unit test proves radio, permission, battery or model performance on your target phones.
