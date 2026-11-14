#!/usr/bin/env python3
"""
Converts a JRT trackmap `coord` file (a Python pickle) into the JSON the mock server drives around.

    python3 tools/trackmap_to_json.py "<path to>/nurburgring nordschleife/coord" tools/track_nordschleife.json

Source: github.com/drjackyl/jrt-trackmaps (public domain). The file is a pickle, so it is loaded with an
unpickler that refuses every import: a pickle can name any Python callable and run it on load, and this one
only needs plain dicts, ints and floats.
"""

import json
import pickle
import sys


class NoImports(pickle.Unpickler):
    def find_class(self, module, name):
        raise pickle.UnpicklingError(f"blocked: pickle tried to load {module}.{name}")


def main():
    src, dst = sys.argv[1], sys.argv[2]
    with open(src, "rb") as f:
        d = NoImports(f).load()
    # x/y are metres; keys are point indices 0..k_max-1
    n = d["k_max"]
    out = {
        "source": "github.com/drjackyl/jrt-trackmaps, nurburgring nordschleife/coord (public domain)",
        "x": [round(float(d["x"][i]), 1) for i in range(n)],
        "y": [round(float(d["y"][i]), 1) for i in range(n)],
    }
    with open(dst, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"{n} points -> {dst}")


if __name__ == "__main__":
    main()
