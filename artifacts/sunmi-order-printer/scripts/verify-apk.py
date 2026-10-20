"""Verify actual release payload, not just the requested Gradle flags."""
import os
import pathlib
import subprocess
import sys
import zipfile

apk, aapt = sys.argv[1:3]
badging = subprocess.check_output([aapt, "dump", "badging", apk], text=True)
if "application-debuggable" in badging:
    raise RuntimeError("APK is debuggable, expected a release")
if "package: name='com.standalone.sunmiorderprinter'" not in badging:
    raise RuntimeError("Unexpected applicationId")
sdk_line = next(line for line in badging.splitlines() if line.startswith("sdkVersion:"))
minimum = int(sdk_line.split("'")[1])
if minimum > 24:
    raise RuntimeError(f"Android minimum unexpectedly increased to API {minimum}")
with zipfile.ZipFile(apk) as bundle:
    names = bundle.namelist()
    for abi in ("armeabi-v7a", "arm64-v8a", "x86_64"):
        hermes = any(f"lib/{abi}/{name}" in names for name in ("libhermes.so", "libhermesvm.so"))
        if f"lib/{abi}/libreactnative.so" not in names or not hermes:
            raise RuntimeError(f"Missing native runtime for {abi}")
    if any("/expo-dev-launcher/" in name for name in names):
        raise RuntimeError("Development launcher must not be shipped")
    js = bundle.read("assets/index.android.bundle")
    api = os.environ["EXPO_PUBLIC_API_BASE_URL"].encode()
    if api not in js:
        raise RuntimeError("Production API URL is missing from the compiled JS bundle")
print(f"Verified release, bundled API URL, ARM32/ARM64/x86_64, minSdkVersion={minimum}")
print("\n".join(line for line in badging.splitlines() if line.startswith(("package:", "sdkVersion:", "native-code:"))))
