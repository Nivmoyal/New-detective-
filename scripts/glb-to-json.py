"""Losslessly convert .glb files to glTF JSON with the binary chunk embedded as a data URI.

Usage: python3 scripts/glb-to-json.py <dir>   (writes <name>.json next to each <name>.glb)
"""
import base64, json, pathlib, struct, sys

for glb in sorted(pathlib.Path(sys.argv[1]).glob('*.glb')):
    data = glb.read_bytes()
    magic, version, _ = struct.unpack_from('<4sII', data, 0)
    assert magic == b'glTF' and version == 2, glb
    offset, doc, binary = 12, None, b''
    while offset < len(data):
        length, kind = struct.unpack_from('<I4s', data, offset)
        chunk = data[offset + 8: offset + 8 + length]
        if kind == b'JSON':
            doc = json.loads(chunk)
        elif kind == b'BIN\x00':
            binary = chunk
        offset += 8 + length
    if binary:
        doc['buffers'][0]['uri'] = 'data:application/octet-stream;base64,' + base64.b64encode(binary).decode()
    out = glb.with_suffix('.json')
    out.write_text(json.dumps(doc, separators=(',', ':')))
    print(f'{out.name:28} {out.stat().st_size // 1024} KB')
