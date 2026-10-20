"""Launch the signed release and retain native/JS crash evidence on failure."""
import os
import pathlib
import subprocess
import time

package = "com.standalone.sunmiorderprinter"
output = pathlib.Path(os.environ["RUNNER_TEMP"]) / "sunmi-smoke"
output.mkdir(exist_ok=True)
apk = pathlib.Path(os.environ["SUNMI_NATIVE_DIR"]) / "android/app/build/outputs/apk/release/app-release.apk"

def adb(*args, check=True):
    return subprocess.run(["adb", *args], check=check, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT).stdout

adb("install", "-r", str(apk))
adb("logcat", "-c")
adb("shell", "am", "start", "-W", "-n", package + "/.MainActivity")
try:
    for attempt in range(12):
        time.sleep(5)
        log = adb("logcat", "-d", "-v", "threadtime")
        (output / "logcat.txt").write_text(log)
        pid = adb("shell", "pidof", package, check=False).strip()
        if not pid:
            raise RuntimeError("Release process exited at startup; inspect logcat.txt")
        if f"Process: {package}," in log and "FATAL EXCEPTION:" in log:
            raise RuntimeError("Native startup crash recorded; inspect logcat.txt")
        adb("shell", "uiautomator", "dump", "/sdcard/sunmi-ui.xml", check=False)
        xml = adb("shell", "cat", "/sdcard/sunmi-ui.xml", check=False)
        (output / "screen.xml").write_text(xml)
        if "تعذر بدء تطبيق الطابعة" in xml or "حدث خطأ داخل التطبيق" in xml:
            raise RuntimeError("Startup error screen reached; inspect screen.xml and logcat.txt")
        if "اسم المستخدم" in xml or "تسجيل الدخول" in xml:
            print("PASS: signed release opens the merchant login screen without crashing")
            break
    else:
        raise RuntimeError("Login screen did not appear within 60 seconds")
finally:
    adb("shell", "dumpsys", "package", package)
    subprocess.run(["adb", "pull", "/sdcard/sunmi-ui.xml", str(output / "screen.xml")], check=False)
    with open(output / "screen.png", "wb") as screenshot:
        subprocess.run(["adb", "exec-out", "screencap", "-p"], stdout=screenshot, check=False)
