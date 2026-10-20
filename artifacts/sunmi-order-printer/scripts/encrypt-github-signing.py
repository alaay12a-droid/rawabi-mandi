"""Encrypt local signing material for GitHub Secrets without printing plaintext.

Usage: python encrypt-github-signing.py PUBLIC_KEY_BASE64 OUTPUT_PATH LIBSODIUM
The output contains sealed-box ciphertext only. Never commit credentials.json
or the keystore. This helper does not read Replit environment secrets.
"""
import base64
import ctypes
import json
import os
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
public_key = base64.b64decode(sys.argv[1], validate=True)
if len(public_key) != 32:
    raise ValueError("Invalid GitHub public key")
output = Path(sys.argv[2])
lib = ctypes.cdll.LoadLibrary(sys.argv[3])
if lib.sodium_init() < 0:
    raise RuntimeError("Cannot initialize signing-secret encryption")
lib.crypto_box_seal.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_ulonglong, ctypes.c_void_p]
lib.crypto_box_seal.restype = ctypes.c_int

credentials = json.loads((root / "credentials.json").read_text())["android"]["keystore"]
keystore = (root / credentials["keystorePath"]).resolve()
if not keystore.is_relative_to(root / "credentials"):
    raise ValueError("Signing key must belong to the Sunmi credentials directory")
values = {
    "SUNMI_KEYSTORE_BASE64": base64.b64encode(keystore.read_bytes()),
    "SUNMI_KEYSTORE_PASSWORD": credentials["keystorePassword"].encode(),
    "SUNMI_KEY_ALIAS": credentials["keyAlias"].encode(),
    "SUNMI_KEY_PASSWORD": credentials["keyPassword"].encode(),
}
encrypted = {}
for name, value in values.items():
    if not value:
        raise ValueError("Missing signing field: " + name)
    ciphertext = ctypes.create_string_buffer(len(value) + 48)
    if lib.crypto_box_seal(ciphertext, value, len(value), public_key) != 0:
        raise RuntimeError("Cannot encrypt signing field")
    encrypted[name] = base64.b64encode(ciphertext.raw).decode()
fd = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, "w") as stream:
    json.dump(encrypted, stream)
print("Encrypted original Sunmi signing key and credentials; no plaintext exported.")
