# SCRYVO Studio — Android source project

SCRYVO is an offline-first, landscape Android visual-programming studio prototype. It uses a Kotlin Android WebView shell for Android integration and a locally bundled HTML/CSS/JavaScript editor. No hosted backend, API key, or network connection is needed for the core app.

## What works in this starter build

- Landscape-only Android activity, custom launcher icon, short animated opening screen, and account/register/login screens.
- Local accounts on the current device. Usernames are unique case-insensitively on this device; passwords are PBKDF2-HMAC-SHA256 hashed with a random salt before storage.
- Session restoration after closing/reopening the app, profile menu, and logout.
- Per-account local project lists: create, open, autosave, rename (from project menu), duplicate, delete, import and export `.scryvo` JSON project files.
- Scratch-inspired editor layout: colored categories, drag/tap block palette, stack workspace, nested repeat/forever drop zones, sprite stage, sprite list and coordinates.
- Real Run/Stop interpreter for the included move, turn, go-to, x/y change, say/think, size, show/hide, costume, play/stop sound, wait, repeat/forever, ask, and variable blocks.
- Original bundled starter sprites and backdrops, image import (PNG/JPG/WEBP), costume management, backdrop import, and a touch/mouse paint canvas that saves PNG drawings into the project.
- Sound library of original synthesized sound effects, local audio-file import, microphone recording through Android WebView permissions, and sound preview.
- First-login guided tutorial with animated pointer/spotlight. The tutorial does not move to the next step until the matching action is performed. Completion message: “You have passed the tutorial”.
- Responsive CSS sizing for varied landscape screen dimensions and densities.

## Important scope notes

This is a working **starter studio**, not a complete replacement for the full Scratch 3 editor/runtime. It does not yet implement the entire Scratch block catalogue, full Scratch physics/collision behavior, cloud accounts, cross-device sync, Scratch `.sb3` compatibility, a public community, or APK/game export. `.scryvo` is SCRYVO's own JSON-based project bundle and contains the project data and embedded assets.

Accounts and projects are local to the app installation. They are not online accounts and usernames are not globally reserved. Clearing app data or uninstalling the app can remove local accounts and projects; export important projects as `.scryvo` backups. Local account separation is an app-level feature, not server-grade security.

The drawing tool saves transparent PNG art. The built-in sound pack is synthesized locally rather than copied from Scratch's sound library. The app does not download Scratch characters, costumes, or sounds.

## Build an APK with GitHub Actions

1. Create a new GitHub repository, for example `scryvo-studio`.
2. Extract this ZIP on your phone or computer.
3. Upload the **contents inside the extracted `SCRYVO` folder** to the repository root. The `.github/workflows/build-apk.yml` file must remain at that exact path.
4. Open the repository's **Actions** tab.
5. Select **Build SCRYVO APK**, then choose **Run workflow**. A push to `main` or `master` also triggers the workflow.
6. When the workflow finishes, open its run and download the artifact named `scryvo-debug-apk`.
7. Extract the artifact ZIP; install `app-debug.apk` on your Android device. Android may ask you to allow installation from the app you use to open the APK.

The workflow uses JDK 17, Gradle 8.10.2, Android SDK setup, and builds `:app:assembleDebug`. No GitHub Secrets are required.

## Build locally

Install JDK 17, Android SDK, and Gradle 8.10.2, then run:

```bash
./gradlew :app:assembleDebug
```

The `gradlew` script in this source bundle delegates to an installed Gradle command. GitHub Actions installs the pinned Gradle version automatically.

## Project structure

```text
SCRYVO/
├── .github/workflows/build-apk.yml
├── app/
│   ├── build.gradle.kts
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── assets/
│       │   ├── index.html
│       │   ├── styles.css
│       │   └── app.js
│       ├── java/dev/scryvo/studio/MainActivity.kt
│       └── res/
├── build.gradle.kts
├── settings.gradle.kts
└── gradle.properties
```

## Research and design references

The layout and learning flow take cues from the public Scratch 3 editor model: a color-coded block palette, script workspace, stage, sprite list and properties, plus Code/Costumes/Sounds editing areas. Its sound workflow supports choosing a library sound, importing a file and recording with a microphone. Scratch's `.sb3` format is a ZIP archive containing `project.json` and separate image/audio assets. SCRYVO applies these general interaction patterns with original UI, mascot, starter characters, backdrops and synthesized sounds; it does not copy Scratch's branded assets or editor source.

The Scratch GUI and VM repositories are separate public projects and were archived on GitHub on June 10, 2026. Both repositories identify AGPL-3.0 licensing. This starter bundle does not embed either codebase. It implements a smaller SCRYVO-specific block model and runtime instead. The `.scryvo` project file is not compatible with `.sb3`.

- Scratch GUI repository and license/status: https://github.com/scratchfoundation/scratch-gui
- Scratch VM repository and license/status: https://github.com/scratchfoundation/scratch-vm
- Scratch 3 editor walkthrough: https://learn.adafruit.com/guide-to-scratch-3?view=all
- Scratch project file notes: https://scratchspec.github.io/files/
- Android Storage Access Framework: https://developer.android.com/guide/topics/providers/document-provider

## Mobile-first GitHub instructions

On Android, create an empty GitHub repository, extract this ZIP, then upload the files and folders *inside* the `SCRYVO` folder to the repository root. Keep `.github/workflows/build-apk.yml` in place. In the repository, open **Actions → Build SCRYVO APK → Run workflow**. Download the `scryvo-debug-apk` artifact from the completed workflow run, extract it, then install `app-debug.apk`.

## License

The SCRYVO-specific source in this bundle is provided under the MIT License. AndroidX WebKit and the Android platform are third-party components under their respective licenses. No Scratch source code or Scratch media is bundled in this project.
