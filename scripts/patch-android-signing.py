import re

path = "app-mobile/android/app/build.gradle"
s = open(path).read()

s = re.sub(
    r"(debug\s*\{\s*storeFile file\('debug\.keystore'\)\s*storePassword 'android'\s*keyAlias 'androiddebugkey'\s*keyPassword 'android'\s*\})",
    "\\1\n"
    "        release {\n"
    "            storeFile file('akiofertas-release.keystore')\n"
    "            storePassword System.getenv('AKI_RELEASE_STORE_PASSWORD')\n"
    "            keyAlias 'akiofertas'\n"
    "            keyPassword System.getenv('AKI_RELEASE_STORE_PASSWORD')\n"
    "        }",
    s,
    count=1,
)

s = re.sub(
    r"(// Caution! In production.*?signingConfig signingConfigs)\.debug",
    r'\1.release\n            ndk { debugSymbolLevel "none" }',
    s,
    count=1,
    flags=re.S,
)

assert "akiofertas-release.keystore" in s, "signing block not inserted"
assert "signingConfig signingConfigs.release" in s, "release build type not repointed"

open(path, "w").write(s)
print("build.gradle patched for release signing")
