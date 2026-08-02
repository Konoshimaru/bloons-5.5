from pathlib import Path

# Get the directory where this script is located
script_dir = Path(__file__).resolve().parent
target_dir = script_dir / "excluded_svgs"

# Create the folder if it doesn't already exist
target_dir.mkdir(exist_ok=True)

moved_count = 0
for file in script_dir.iterdir():
    if file.is_file() and file.suffix.lower() == ".svg":
        file.rename(target_dir / file.name)
        print(f"Moved: {file.name}")
        moved_count += 1

print(f"\nDone! Excluded {moved_count} .svg file(s) into '{target_dir.name}'.")
