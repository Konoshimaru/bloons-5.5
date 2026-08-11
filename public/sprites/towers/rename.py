import os
import sys

def batch_rename():
    # Get the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    script_name = os.path.basename(__file__)

    print(f"Working Directory: {script_dir}\n")

    # Get inputs from the user
    target_text = input("Enter the text to search for: ").strip()
    if not target_text:
        print("Error: Search text cannot be empty.")
        return

    replacement_text = input("Enter the replacement text: ")

    renamed_count = 0

    # Iterate through all files in the directory
    for item in os.listdir(script_dir):
        old_path = os.path.join(script_dir, item)

        # Ensure we only rename files (not directories) and skip the script itself
        if os.path.isfile(old_path) and item != script_name:
            if target_text in item:
                new_filename = item.replace(target_text, replacement_text)
                new_path = os.path.join(script_dir, new_filename)

                # Avoid overwriting an existing file
                if os.path.exists(new_path):
                    print(f"Skipped '{item}' -> '{new_filename}' already exists.")
                    continue

                os.rename(old_path, new_path)
                print(f"Renamed: '{item}' -> '{new_filename}'")
                renamed_count += 1

    print(f"\nDone! Successfully renamed {renamed_count} file(s).")

if __name__ == "__main__":
    batch_rename()
