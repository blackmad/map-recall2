import json, sys, re
ident, entry_json = sys.argv[1], sys.argv[2]
p = 'src/canalRecall/landmarks/manualCatalogue.json'
s = open(p).read()
entry = json.loads(open(entry_json).read())
text = '\n'.join(' ' + l for l in json.dumps(entry, indent=1, ensure_ascii=False).split('\n'))
start = s.find('\n {\n  "id": "%s",' % ident)
if start >= 0:
    # replace: the entry runs to the next "\n }" at indent 1
    end = s.find('\n }', start + 3) + 3
    s = s[:start] + '\n' + text + s[end:]
else:
    assert s.endswith('\n }\n]\n')
    s = s[:-len('\n]\n')] + ',\n' + text + '\n]\n'
json.loads(s)
open(p, 'w').write(s)
print('ok', ident, 'replaced' if start >= 0 else 'added')
