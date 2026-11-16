"""Create a clean desktop distribution using only Python's standard library."""
import hashlib
import pathlib
import sys
import zipfile

source, destination, folder_name, executable_hash = sys.argv[1:]
source = pathlib.Path(source).resolve()
destination = pathlib.Path(destination).resolve()
files = [entry for entry in source.rglob("*") if entry.is_file()]
if any(entry.is_symlink() for entry in source.rglob("*")):
    raise ValueError("Release staging must not contain symbolic links")
expected = {entry.relative_to(source).as_posix() for entry in files}
required = {f"{folder_name}/{name}" for name in ("Shixu-Studio.exe", "README.txt", "SHA256SUMS.txt", "resources/app.asar")}
if not required <= expected or any(not name.startswith(folder_name + "/") for name in expected):
    raise ValueError("Unexpected release contents")
if any(part.lower() in {"shixustudiodata", "board.json", "board.previous.json", "window.json"} for name in expected for part in pathlib.PurePosixPath(name).parts):
    raise ValueError("Release contains user data")

# The executable is already compressed. Stored ZIP entries are quick to copy
# and retain standard CRC checks without introducing another compression pass.
with zipfile.ZipFile(destination, "x", compression=zipfile.ZIP_STORED) as archive:
    for entry in sorted(files):
        archive.write(entry, entry.relative_to(source).as_posix())

with zipfile.ZipFile(destination, "r") as archive:
    if set(archive.namelist()) != expected or len(archive.infolist()) != len(expected):
        raise ValueError("Unexpected ZIP contents")
    if archive.testzip() is not None:
        raise ValueError("ZIP CRC verification failed")
    digest = hashlib.sha256()
    with archive.open(f"{folder_name}/Shixu-Studio.exe") as executable:
        for chunk in iter(lambda: executable.read(1024 * 1024), b""):
            digest.update(chunk)
    if digest.hexdigest() != executable_hash:
        raise ValueError("Executable SHA-256 verification failed")
    for entry in files:
        name = entry.relative_to(source).as_posix()
        with entry.open("rb") as local, archive.open(name) as packaged:
            while True:
                chunk = local.read(1024 * 1024)
                if chunk != packaged.read(len(chunk) if chunk else 1):
                    raise ValueError(f"ZIP content differs: {name}")
                if not chunk:
                    break
print("ZIP contents, CRC and executable SHA-256 verified.")
