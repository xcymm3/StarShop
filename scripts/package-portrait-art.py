"""Encode generated master PNGs for runtime; no painting, cropping or resizing."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1] / 'src' / 'assets'
for name in ['room/shop-portrait', 'visitors/customers-sheet']:
    stem = root / name
    with Image.open(stem.with_suffix('.png')) as original:
        original.save(stem.with_suffix('.webp'), format='WEBP', quality=95, method=6)
        with Image.open(stem.with_suffix('.webp')) as runtime:
            assert runtime.size == original.size
            if 'A' in original.getbands():
                assert runtime.getchannel('A').tobytes() == original.getchannel('A').tobytes()
    print(f'{name}.webp: {stem.with_suffix(".webp").stat().st_size} bytes')
