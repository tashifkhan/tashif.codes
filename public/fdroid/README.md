# Tashif Codes F-Droid Repo

Static F-Droid-compatible binary repository served at:

```text
https://tashif.codes/fdroid/repo
```

Add it with the signing key fingerprint so F-Droid verifies the repo on first sync:

```text
https://tashif.codes/fdroid/repo?fingerprint=568557c435bdf555725de95de596a90d6fa964d4bf0b71874f254cd0be7e94c9
```

Install / instructions page: `https://tashif.codes/fdroid`

## Apps

| App | Source repo | Package | Release asset pattern |
| --- | --- | --- | --- |
| **Paisa** | [tashifkhan/Paisa](https://github.com/tashifkhan/Paisa) | `codes.tashif.paisa` | `Paisa-v*.apk` |
| **Patchwork** | [tashifkhan/Patchwork](https://github.com/tashifkhan/Patchwork) | `codes.tashhif.patchwork` | `*.apk` |
| **Delhi Metro** | [tashifkhan/delhi-metro](https://github.com/tashifkhan/delhi-metro) | `codes.tashif.delhimetro` | `DelhiMetro-v*.apk` |

## How publishing works

1. An app repo builds a release APK and attaches it to a GitHub Release
   (Paisa: `Release`; Patchwork / Delhi Metro: EAS `github-release` + tag push).
2. That workflow dispatches `.github/workflows/publish-fdroid.yml` in this repo
   (or you run it manually).
3. The workflow downloads the APK, copies it into `public/fdroid/repo`, runs
   `fdroid update`, and commits the signed index.
4. Vercel deploys the static files under `/fdroid/repo`.

Manual import examples:

```bash
# Paisa
gh workflow run publish-fdroid.yml \
  --repo tashifkhan/tashif.codes \
  --field source_repository=tashifkhan/Paisa \
  --field release_tag=v1.0.0 \
  --field apk_pattern='Paisa-v*.apk'

# Patchwork
gh workflow run publish-fdroid.yml \
  --repo tashifkhan/tashif.codes \
  --field source_repository=tashifkhan/Patchwork \
  --field release_tag=v1.0.0 \
  --field apk_pattern='*.apk'

# Delhi Metro
gh workflow run publish-fdroid.yml \
  --repo tashifkhan/tashif.codes \
  --field source_repository=tashifkhan/delhi-metro \
  --field release_tag=v1.1.0 \
  --field apk_pattern='DelhiMetro-v*.apk'
```

## Layout

```text
public/fdroid/
  metadata/
    <package>.yml                 # name, summary, description, links, licence
    <package>/en-US/
      icon.png                    # taken from the APK by CI
      featureGraphic.jpg          # 1024x500 banner
      phoneScreenshots/           # shown in the F-Droid client and on the site
      tenInchScreenshots/         # tablet screens, optional
      video.txt                   # one URL to a walkthrough video
      changelogs/<versionCode>.txt  # "What's new" per version, 500 chars max
  repo/                           # APKs + signed indexes (committed by CI)
  archive/                        # older APKs (created by fdroidserver)
  config.yml.example              # non-secret reference config
  .gitignore                      # blocks keystores / live config.yml
```

## Editing a listing

The listing text, screenshots and video live in `metadata/` and are edited by
hand. The page at `/fdroid` reads those files at build time, so a merged edit
shows on the site straight away. `/fdroid/<app>` redirects to the app's project
page.

The F-Droid client reads the signed index instead. After merging a listing
edit, re-sign the index without importing an APK:

```bash
gh workflow run publish-fdroid.yml \
  --repo tashifkhan/tashif.codes \
  --field metadata_only=true
```

A normal release does this too, so an edit also goes out with the next version.

`changelogs/<versionCode>.txt` is written by CI from the GitHub release notes
(`.github/scripts/write-fdroid-changelog.py`). It keeps the opening line and as
many bullets as fit in 500 characters. A file that already exists is left
alone, so write one by hand before releasing if you want different wording.

The walkthrough videos are served by taf.sh, and `video.txt` points at them
under `https://taf.sh/media/<id>/`.

## Required GitHub Secrets

In **`tashifkhan/tashif.codes`**:

| Secret | Purpose |
|---|---|
| `FDROID_KEYSTORE_BASE64` | base64-encoded PKCS12 keystore |
| `FDROID_KEYSTORE_PASS` | keystore password |
| `FDROID_KEY_ALIAS` | key alias (usually `fdroid`) |
| `FDROID_KEY_PASS` | key password |
| `FDROID_SOURCE_TOKEN` | optional; only if the APK release repo is private |

In **`tashifkhan/Paisa`**:

| Secret | Purpose |
|---|---|
| `KEYSTORE_BASE64` | APK upload keystore (base64) |
| `KEYSTORE_PASSWORD` / `KEY_ALIAS` / `KEY_PASSWORD` | APK signing |
| `TASHIF_CODES_WORKFLOW_TOKEN` | fine-grained PAT with **Actions: Read and write** on `tashifkhan/tashif.codes` |

In **`tashifkhan/Patchwork`** (Patchwork) and **`tashifkhan/delhi-metro`**:

| Secret | Purpose |
|---|---|
| `EXPO_TOKEN` | EAS cloud builds |
| `TASHIF_CODES_WORKFLOW_TOKEN` | same as above |

## Create the repo signing keystore (once)

```sh
keytool -genkeypair \
  -v \
  -keystore fdroid-repo.p12 \
  -storetype PKCS12 \
  -alias fdroid \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000

# macOS
base64 -i fdroid-repo.p12 | pbcopy

# Linux
base64 -w0 fdroid-repo.p12 | xclip -selection clipboard
```

Store the copied value as `FDROID_KEYSTORE_BASE64`. **Back up `fdroid-repo.p12` offline.** If it is lost, existing F-Droid clients will not trust indexes signed by a replacement key.

## Local dry-run (optional)

```sh
cd public/fdroid
cp config.yml.example config.yml
# edit passwords + point keystore at your local .p12
cp /path/to/Some-App.apk repo/
fdroid update --create-metadata --rename-apks --pretty --verbose
```

Do not commit `config.yml` or any keystore file.
