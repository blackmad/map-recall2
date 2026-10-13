#!/usr/bin/env python3
"""Register a bespoke builder in build-manual-landmarks.ts (import after the queue-lane marker, else-if before the generic fallback).

    python3 scripts/landmarks/register-builder.py <id> <exportedFunction> <builder-file-without-ts>
"""
import sys

lid, fn, mod = sys.argv[1:4]
p = 'scripts/landmarks/build-manual-landmarks.ts'
s = open(p).read()
imp = f"import {{{fn}}} from './{mod}';\n"
if imp not in s:
    marker = "// Landmark queue lane 5 (2026-10-13)\n"
    s = s.replace(marker, marker + imp, 1)
call = f"    else if(id==='{lid}'){fn}(w,d,helpers);\n"
if call not in s:
    s = s.replace("    else buildCulturalLandmark(id,w,d,helpers);", call + "    else buildCulturalLandmark(id,w,d,helpers);", 1)
open(p, 'w').write(s)
print('registered', lid)
