#!/usr/bin/env python3
"""JSC heap snapshots of a Mobile Safari page in the booted iOS Simulator, by class (lane iphone-start-memory-20261127).

The Simulator's webinspectord listens on a UNIX socket (com.apple.webinspectord_sim.socket); this speaks its
binary-plist RPC (the protocol Safari's Web Inspector and ios-webkit-debug-proxy use), attaches to the Safari page
whose URL contains --match, and asks every inspectable target (the page and each dedicated worker) for
`Heap.snapshot`. Each snapshot is summed by JSC class name (self size) and written as JSON; the console gets the top
classes per target. Python because plistlib reads and writes binary plists; nothing here is game logic.

  python3 -I scripts/perf/sim-heap-snapshot.py --match canal-drive [--open URL] [--wait 14] [--out artifacts/perf/sim-heap]

--open: `xcrun simctl openurl booted URL` first (a normal tab, so it is inspectable; WebDriver sessions are not), then
wait --wait seconds before the snapshots. Snapshots pause the target for a few seconds each.
"""
import argparse, glob, json, os, plistlib, socket, struct, subprocess, sys, time, uuid
from collections import defaultdict

ap = argparse.ArgumentParser()
ap.add_argument('--match', default='canal-drive')
ap.add_argument('--open')
ap.add_argument('--wait', type=float, default=14)
ap.add_argument('--out', default='artifacts/perf/sim-heap')
ap.add_argument('--top', type=int, default=25)
ap.add_argument('--label', default='')
ap.add_argument('--eval', help='evaluate this expression in the page (Runtime.evaluate) and exit, e.g. to set storage and navigate')
args = ap.parse_args()

# Newest first: sockets of earlier simulator boots linger and never answer.
paths = sorted(glob.glob('/private/tmp/com.apple.launchd.*/com.apple.webinspectord_sim.socket'), key=os.path.getmtime, reverse=True)
if not paths: sys.exit('no simulator webinspectord socket (is a simulator booted?)')

if args.open:
    subprocess.run(['xcrun', 'simctl', 'openurl', 'booted', args.open], check=True)
    time.sleep(args.wait)

s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
s.connect(paths[0])
conn_id, sender = str(uuid.uuid4()).upper(), str(uuid.uuid4()).upper()

def send(selector, argument):
    data = plistlib.dumps({'__selector': selector, '__argument': argument}, fmt=plistlib.FMT_BINARY)
    s.sendall(struct.pack('>I', len(data)) + data)

buf = b''
def recv(timeout=30):
    global buf
    s.settimeout(timeout)
    while True:
        if len(buf) >= 4:
            n = struct.unpack('>I', buf[:4])[0]
            if len(buf) >= 4 + n:
                msg, buf = buf[4:4 + n], buf[4 + n:]
                return plistlib.loads(msg)
        chunk = s.recv(1 << 20)
        if not chunk: raise EOFError('socket closed')
        buf += chunk

send('_rpc_reportIdentifier:', {'WIRConnectionIdentifierKey': conn_id})
apps = {}
deadline = time.time() + 5
while time.time() < deadline:
    try: m = recv(2)
    except socket.timeout: break
    if m['__selector'] == '_rpc_reportConnectedApplicationList:':
        apps.update(m['__argument'].get('WIRApplicationDictionaryKey', {}))
        break
safari = [k for k, v in apps.items() if 'mobilesafari' in (v.get('WIRApplicationBundleIdentifierKey') or '').lower()]
if not safari: sys.exit(f'no Mobile Safari among inspectable apps: {[v.get("WIRApplicationBundleIdentifierKey") for v in apps.values()]}')
app = safari[0]
send('_rpc_forwardGetListing:', {'WIRConnectionIdentifierKey': conn_id, 'WIRApplicationIdentifierKey': app})
page = None
deadline = time.time() + 10
while time.time() < deadline and page is None:
    m = recv(10)
    if m['__selector'] == '_rpc_applicationSentListing:':
        for p in m['__argument']['WIRListingKey'].values():
            if args.match in (p.get('WIRURLKey') or ''): page = p
if page is None: sys.exit(f'no page matching {args.match!r}')
page_id = page['WIRPageIdentifierKey']
print('page', page_id, page.get('WIRURLKey'), file=sys.stderr)
base = {'WIRConnectionIdentifierKey': conn_id, 'WIRApplicationIdentifierKey': app, 'WIRPageIdentifierKey': page_id, 'WIRSenderKey': sender}
send('_rpc_forwardSocketSetup:', {**base, 'WIRAutomaticallyPause': False})

next_id = [1]
targets = {}
def raw(obj):
    send('_rpc_forwardSocketData:', {**base, 'WIRSocketDataKey': json.dumps(obj).encode()})

def pump(until, timeout=120):
    """Read messages until until(msg) returns a value; records Target.targetCreated on the way."""
    end = time.time() + timeout
    while time.time() < end:
        m = recv(max(1, end - time.time()))
        if m['__selector'] != '_rpc_applicationSentData:': continue
        msg = json.loads(m['__argument']['WIRMessageDataKey'])
        if msg.get('method') == 'Target.targetCreated':
            info = msg['params']['targetInfo']; targets[info['targetId']] = info
        if msg.get('method') == 'Target.dispatchMessageFromTarget':
            inner = json.loads(msg['params']['message'])
            v = until(msg['params']['targetId'], inner)
            if v is not None: return v
        else:
            v = until(None, msg)
            if v is not None: return v
    raise TimeoutError('no answer')

def call(target, method, params=None, timeout=180):
    i = next_id[0]; next_id[0] += 1
    inner = {'id': i, 'method': method, 'params': params or {}}
    raw({'id': 100000 + i, 'method': 'Target.sendMessageToTarget', 'params': {'targetId': target, 'message': json.dumps(inner)}})
    return pump(lambda t, m: m if t == target and m.get('id') == i else None, timeout)

# Target.targetCreated for the page and its workers arrives on attach; give it a moment.
try: pump(lambda t, m: None, 3)
except (TimeoutError, socket.timeout): pass
page_targets = [t for t, i in targets.items() if i.get('type') == 'page']
worker_targets = [t for t, i in targets.items() if i.get('type') == 'worker']
print('targets', {t: i.get('type') for t, i in targets.items()}, file=sys.stderr)

if args.eval:
    for t in page_targets:
        print(json.dumps(call(t, 'Runtime.evaluate', {'expression': args.eval, 'returnByValue': True}, timeout=30).get('result')))
    sys.exit(0)

def array_after(text, key):
    # The snapshot's edges dwarf its nodes: cut out only the arrays we sum instead of parsing the whole document.
    import re
    m = re.search(r'"%s"\s*:\s*\[' % key, text)
    i = j = m.end()
    if key == 'nodes':
        j = text.index(']', i)
    else:
        depth = 1
        while depth:
            c = text[j]
            if c == '"':
                j += 1
                while text[j] != '"': j += 2 if text[j] == '\\' else 1
            elif c == '[': depth += 1
            elif c == ']': depth -= 1
            j += 1
        j -= 1
    return json.loads('[' + text[i:j] + ']')

def summarise(snapshot):
    nodes, names = array_after(snapshot, 'nodes'), array_after(snapshot, 'nodeClassNames')
    stride = 4  # id, size, classNameIndex, flags (JSC HeapSnapshot v2)
    by = defaultdict(lambda: [0, 0]); total = 0
    for k in range(0, len(nodes), stride):
        size, cls = nodes[k + 1], names[nodes[k + 2]]
        by[cls][0] += size; by[cls][1] += 1; total += size
    top = sorted(by.items(), key=lambda kv: -kv[1][0])
    return {'totalMB': round(total / 1048576, 1), 'nodes': len(nodes) // stride,
            'top': [{'class': c, 'MB': round(b / 1048576, 1), 'count': n} for c, (b, n) in top[:60]]}

out = {'page': page.get('WIRURLKey'), 'label': args.label, 'at': time.strftime('%Y-%m-%dT%H:%M:%S'), 'targets': []}
for t in page_targets + worker_targets:
    info = targets[t]
    try:
        call(t, 'Heap.enable', timeout=30)
        res = call(t, 'Heap.snapshot', timeout=300)
        summ = summarise(res['result']['snapshotData'])
    except Exception as e:  # a worker may refuse Heap; keep the rest
        summ = {'error': str(e)[:200]}
    summ.update({'target': t, 'type': info.get('type'), 'url': info.get('url', '')})
    out['targets'].append(summ)
    print(f"== {info.get('type')} {t} {info.get('url', '')[-60:]}: {summ.get('totalMB')} MB in {summ.get('nodes')} cells")
    for row in summ.get('top', [])[:args.top]:
        print(f"   {row['MB']:8.1f} MB  {row['count']:>9}  {row['class']}")
os.makedirs(args.out, exist_ok=True)
fn = os.path.join(args.out, f"sim-heap-{args.label or 'page'}-{time.strftime('%Y%m%dT%H%M%S')}.json")
with open(fn, 'w') as f: json.dump(out, f, indent=1)
print('wrote', fn)
