# Replace storefront spec lines: stdin is 'slug<TAB>spec' per line.  python3 scripts/storefronts/setspec.py < edits.tsv
# Replace spec lines: reads "slug<TAB>spec" lines from stdin.
import re, sys
p='src/canalRecall/storefrontSpecs.ts'; s=open(p).read()
for line in sys.stdin:
    line=line.strip()
    if not line: continue
    k,v=line.split('\t',1)
    s,n=re.subn(r"^  '"+re.escape(k)+r"': .*$", lambda m: "  '"+k+"': "+v+",", s, flags=re.M); assert n==1,k
open(p,'w').write(s)
