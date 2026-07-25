# Tashif Codes F-Droid Repo

Static F-Droid-compatible binary repository served at:

```text
https://tashif.codes/fdroid/repo
```

Install / instructions page: `https://tashif.codes/fdroid`

## Apps

| App | Source repo | Package | Release asset pattern |
| --- | --- | --- | --- |
| **Paisa** | [tashifkhan/Paisa](https://github.com/tashifkhan/Paisa) | `codes.tashif.paisa` | `Paisa-v*.apk` |
| **Patchwork** | [tashifkhan/caldav-todo](https://github.com/tashifkhan/caldav-todo) | `codes.tashhif.patchwork` | `*.apk` |
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
  --field source_repository=tashifkhan/caldav-todo \
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
  metadata/                       # per-app F-Droid metadata (committed)
    codes.tashif.paisa.yml
    codes.tashhif.patchwork.yml
    codes.tashif.delhimetro.yml
  repo/                           # APKs + signed indexes (committed by CI)
  archive/                        # older APKs (created by fdroidserver)
  config.yml.example              # non-secret reference config
  .gitignore                      # blocks keystores / live config.yml
```

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

In **`tashifkhan/caldav-todo`** (Patchwork) and **`tashifkhan/delhi-metro`**:

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
