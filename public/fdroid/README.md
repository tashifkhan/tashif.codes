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
| **Billi** | [tashifkhan/Billi](https://github.com/tashifkhan/Billi) | `sh.taf.billi` | `Billi-v*.apk` |
| **Patchwork** | [tashifkhan/Patchwork](https://github.com/tashifkhan/Patchwork) | `codes.tashhif.patchwork` | `*.apk` |
| **Delhi Metro** | [tashifkhan/delhi-metro](https://github.com/tashifkhan/delhi-metro) | `codes.tashif.delhimetro` | `DelhiMetro-v*.apk` |
| **Namma Metro** | [tashifkhan/blr-metro](https://github.com/tashifkhan/blr-metro) | `codes.tashif.blrmetro` | `NammaMetro-v*.apk` |

## How publishing works

1. An app repo builds a release APK and attaches it to a GitHub Release
   (Billi: `Release`; Patchwork / Delhi Metro / Namma Metro: EAS `github-release` + tag push).
2. That workflow dispatches `.github/workflows/publish-fdroid.yml` in this repo
   (or you run it manually).
3. The workflow syncs existing APKs from the `tashif-codes-fdroid` R2 bucket,
   downloads the new GitHub Release asset, copies it into `public/fdroid/repo`,
   and runs `fdroid update`. fdroidserver uses the APK's package ID to find
   `metadata/<package>.yml` and its listing assets.
4. APKs are uploaded back to R2. The signed index and metadata are committed
   so Vercel can serve the index; APKs themselves are not in git. A Cloudflare
   Worker serves `https://tashif.codes/fdroid/repo/<apkName>` (and the current
   version aliases under `/fdroid/*.apk`) with HTTP 200 from R2.

The repo keeps recent versions in `repo/` only (`archive_older: 0`). There is no
`/fdroid/archive` tree, so versions older than those kept in `repo/` are not served.

Use the manual import examples below. Billi's first import needs the published 2.0.0 APK.

```bash
# Billi
gh workflow run publish-fdroid.yml \
  --repo tashifkhan/tashif.codes \
  --field source_repository=tashifkhan/Billi \
  --field release_tag=v2.0.0 \
  --field apk_pattern='Billi-v*.apk'

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

# Namma Metro
gh workflow run publish-fdroid.yml \
  --repo tashifkhan/tashif.codes \
  --field source_repository=tashifkhan/blr-metro \
  --field release_tag=v1.0.0 \
  --field apk_pattern='NammaMetro-v*.apk'
```

## Layout

```text
public/fdroid/
  metadata/
    <package>.yml                 # name, summary, description, links, licence
    <package>/en-US/
      icon.png                    # listing icon, extracted from the APK if missing
      featureGraphic.jpg          # 1024x500 banner
      phoneScreenshots/           # shown in the F-Droid client and on the site
      tenInchScreenshots/         # tablet screens, optional
      video.txt                   # one URL to a walkthrough video
      changelogs/<versionCode>.txt  # "What's new" per version, 500 chars max
  repo/                           # signed indexes (committed); APKs live in R2
  config.yml.example              # non-secret reference config
  .gitignore                      # blocks keystores / live config.yml
```

## Editing a listing

The listing text, screenshots and video live in `metadata/` and are edited by
hand. The page at `/fdroid` reads those files at build time, so a merged edit
shows on the site for apps already in the signed index. `/fdroid/<app>` redirects
to the app's project page.

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
| `CLOUDFLARE_API_TOKEN` | Wrangler / R2 (R2 Storage Edit, Workers Scripts Edit, Zone Workers Routes Edit on `tashif.codes`) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account that owns the R2 bucket and Worker |

In **`tashifkhan/Billi`**:

| Secret | Purpose |
|---|---|
| `KEYSTORE_BASE64` | APK upload keystore (base64) |
| `KEYSTORE_PASSWORD` / `KEY_ALIAS` / `KEY_PASSWORD` | APK signing |
| `TASHIF_CODES_WORKFLOW_TOKEN` | fine-grained PAT with **Actions: Read and write** on `tashifkhan/tashif.codes` |

In **`tashifkhan/Patchwork`** (Patchwork), **`tashifkhan/delhi-metro`** and **`tashifkhan/blr-metro`**:

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
