#!/bin/bash
# allow-of.sh <house id>: prints that house's --allow-inferred=... argument from allow.txt / allow-g4.txt (lane kit-batch-8504-20261121)
d=$(dirname "$0")
line=$(grep -h "^$1	" "$d/allow.txt" "$d/allow-g4.txt" | head -1 | cut -f2-)
line=${line#--allow-inferred=}
line=${line#\'--allow-inferred=}; line=${line%\'}
printf -- '--allow-inferred=%s' "$line"
