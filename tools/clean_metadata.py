"""Remove macOS AppleDouble metadata from this generated website checkout.

Only ._* metadata files are removed. Content and source assets are preserved.
Needed before Hugo loads TOML on exFAT; .gitignore is not a Hugo filter.
"""
from pathlib import Path


def clean(root):
    count = 0
    for p in Path(root).rglob("._*"):
        if p.is_file():
            try:
                p.unlink()
                count += 1
            except FileNotFoundError:
                pass
    return count


if __name__ == "__main__":
    print(f"Removed {clean(Path(__file__).resolve().parents[1])} generated metadata files")
