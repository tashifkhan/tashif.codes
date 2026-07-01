# Tashif Codes F-Droid Repo

Static F-Droid repository served at:

```text
https://tashif.codes/fdroid/repo
```

The `Publish F-Droid Repo` GitHub Action downloads an APK from a GitHub Release, copies it into `public/fdroid/repo`, runs `fdroid update`, and commits the generated index files back to this repository.

## Required GitHub Secrets

In `tashifkhan/tashif.codes`:

- `FDROID_KEYSTORE_BASE64`: base64-encoded PKCS12 keystore.
- `FDROID_KEYSTORE_PASS`: keystore password.
- `FDROID_KEY_ALIAS`: key alias, for example `fdroid`.
- `FDROID_KEY_PASS`: key password.

In `tashifkhan/Patchwork`, optional but recommended so the APK release workflow triggers this repo automatically:

- `TASHIF_CODES_WORKFLOW_TOKEN`: fine-grained GitHub token with Actions read/write access to `tashifkhan/tashif.codes`.

The `Patchwork` repo also needs `EXPO_TOKEN` for EAS APK builds.

Create the keystore locally:

```sh
keytool -genkeypair \
  -v \
  -keystore fdroid-repo.p12 \
  -storetype PKCS12 \
  -alias fdroid \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000

base64 -i fdroid-repo.p12 | pbcopy
```

Store the copied value as `FDROID_KEYSTORE_BASE64` in GitHub Actions secrets. Keep the original keystore backed up securely. If it is lost, existing F-Droid clients will not trust indexes signed by a new key.
