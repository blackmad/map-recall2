#!/bin/bash
# Tests for scripts/browser-queue/canal-pw.sh and pre-push, against temp slot dirs (never /tmp/canal-pw.*).
#   bash scripts/browser-queue/test.sh            all cases (about a minute)
#   bash scripts/browser-queue/test.sh fifo ...   named cases: takeover nopid fifo deadwaiter nesting timing expire rc prepush
# Every process a case starts is killed by PID at the end of the case.
HERE=$(cd "$(dirname "$0")" && pwd)
PW=$HERE/canal-pw.sh
HOOK=$HERE/pre-push
FAIL=0; PIDS=""
export CANAL_PW_POLL=0.2 CANAL_PW_GRACE=3
unset CANAL_PW_HELD CANAL_PW_TIMING CANAL_PW_MAX_HOLD

fresh() { T=$(mktemp -d "${TMPDIR:-/tmp}/canal-pw-test.XXXXXX"); export CANAL_PW_DIR=$T; }
bg() { "$@" & PIDS="$PIDS $!"; LAST=$!; }
cleanup_case() {
  local p c
  for p in $PIDS; do for c in $(pgrep -P "$p" 2>/dev/null); do kill -9 "$c" 2>/dev/null; done; kill -9 "$p" 2>/dev/null; done
  wait 2>/dev/null; PIDS=""
  rm -rf "$T"
}
# wait_for <seconds> <test expression...>
wait_for() { local n=$(( $1 * 10 )); shift; while [ $n -gt 0 ]; do eval "$@" && return 0; sleep 0.1; n=$((n - 1)); done; return 1; }
ok() { echo "  ok   $*"; }
bad() { echo "  FAIL $*"; FAIL=1; }
# Start a waiter and return once its ticket is in the queue (arrival order is ticket order, not fork order).
waiter() { bg "$@"; wait_for 10 "ls $T/canal-pw.queue 2>/dev/null | grep -q '\.$LAST\$'" || echo "       (waiter $LAST took no ticket in 10 s)"; }
events() { sed 's/^/       log: /' "$T/canal-pw.events.log" 2>/dev/null; }

case_takeover() {
  echo "takeover: kill -9 a holder (wrapper and its child); a waiter takes the slot"
  fresh; export CANAL_PW_SLOTS=1
  bg "$PW" sleep 300; H=$LAST
  wait_for 5 '[ -f $T/canal-pw.slot1/pid ]' || bad "holder never took the slot"
  bg "$PW" sh -c "date +%s > $T/waiter-ran"
  sleep 1; [ -f "$T/waiter-ran" ] && bad "waiter ran while the holder lived"
  K=$(date +%s); kill -9 $(pgrep -P $H) $H
  if wait_for 5 '[ -f $T/waiter-ran ]'; then ok "waiter ran $(( $(cat $T/waiter-ran) - K ))s after kill -9 (grace ${CANAL_PW_GRACE}s)"; else bad "waiter did not take over"; fi
  grep -q "RECLAIM canal-pw.slot1 holder=$H (holder $H is dead).*cmd: sleep 300" "$T/canal-pw.events.log" && ok "RECLAIM logged with the old holder's command" || bad "no RECLAIM line"
  events; cleanup_case
}

case_nopid() {
  echo "nopid: a slot dir with no pid file is reclaimed after the grace"
  fresh; export CANAL_PW_SLOTS=1
  mkdir "$T/canal-pw.slot1"; S=$(date +%s)
  bg "$PW" sh -c "date +%s > $T/ran"
  if wait_for 10 '[ -f $T/ran ]'; then d=$(( $(cat $T/ran) - S )); [ $d -ge 3 ] && ok "reclaimed after ${d}s (grace 3s)" || bad "reclaimed too early (${d}s)"; else bad "never reclaimed"; fi
  grep -q "RECLAIM canal-pw.slot1 holder=none (no pid file" "$T/canal-pw.events.log" && ok "logged" || bad "not logged"
  events; cleanup_case
}

case_fifo() {
  echo "fifo: five waiters behind a holder start in arrival order"
  fresh; export CANAL_PW_SLOTS=1
  bg "$PW" sleep 2
  wait_for 5 '[ -f $T/canal-pw.slot1/pid ]'
  for i in 1 2 3 4 5; do waiter "$PW" sh -c "echo $i >> $T/order; sleep 0.3"; done
  wait_for 20 '[ $(wc -l 2>/dev/null < $T/order || echo 0) -ge 5 ]'
  got=$(tr '\n' ' ' < "$T/order"); [ "$got" = "1 2 3 4 5 " ] && ok "order $got" || bad "order $got"
  # Three slots, nine waiters: the order of starts still follows arrival.
  rm -f "$T/order"; export CANAL_PW_SLOTS=3
  for s in 1 2 3; do bg "$PW" sleep 2; done
  wait_for 5 '[ -f $T/canal-pw.slot3/pid ]'
  for i in 1 2 3 4 5 6 7 8 9; do waiter "$PW" sh -c "echo $i >> $T/order; sleep 1"; done
  wait_for 30 '[ $(wc -l 2>/dev/null < $T/order || echo 0) -ge 9 ]'
  # Up to three waiters may start in one poll, so a start may trail an earlier ticket by fewer than 3 places, no more.
  got=$(tr '\n' ' ' < "$T/order"); far=$(tr '\n' ' ' < "$T/order" | awk '{for(i=1;i<=NF;i++){d=$i-i; if(d<0)d=-d; if(d>m)m=d} print m+0}')
  [ $(wc -l < "$T/order") -eq 9 ] && [ "$far" -lt 3 ] && ok "3 slots, order $got (furthest from arrival: $far)" || bad "3 slots, order $got (furthest $far)"
  cleanup_case
}

case_deadwaiter() {
  echo "deadwaiter: a waiter killed in the queue does not block the ones behind it"
  fresh; export CANAL_PW_SLOTS=1
  bg "$PW" sleep 2
  wait_for 5 '[ -f $T/canal-pw.slot1/pid ]'
  waiter "$PW" sh -c "echo 1 >> $T/order"
  waiter "$PW" sh -c "echo 2 >> $T/order"; D=$LAST
  waiter "$PW" sh -c "echo 3 >> $T/order"
  kill -9 $D
  wait_for 15 '[ $(wc -l 2>/dev/null < $T/order || echo 0) -ge 2 ]'
  got=$(tr '\n' ' ' < "$T/order"); [ "$got" = "1 3 " ] && ok "order $got (2 was killed while waiting)" || bad "order $got"
  grep -q "DROP ticket .*\.$D (waiter $D is dead)" "$T/canal-pw.events.log" && ok "DROP logged" || bad "no DROP line"
  ls "$T/canal-pw.queue" | grep -q . && bad "tickets left: $(ls $T/canal-pw.queue)" || ok "queue empty"
  events; cleanup_case
}

case_nesting() {
  echo "nesting: a wrapped call inside a held slot runs in the outer slot (all slots held, no deadlock)"
  fresh; export CANAL_PW_SLOTS=1
  bg "$PW" "$PW" sh -c "echo \$CANAL_PW_HELD > $T/inner"; N1=$LAST
  if wait_for 5 '[ -s $T/inner ]'; then ok "inner ran with CANAL_PW_HELD=$(cat $T/inner)"; else bad "nested call deadlocked"; fi
  wait $N1 2>/dev/null
  [ -d "$T/canal-pw.slot1" ] && bad "slot still held after the outer call" || ok "slot released"
  cleanup_case
}

case_timing() {
  echo "timing: A, B hold both slots; S, T (CANAL_PW_TIMING=1), C queue in that order. T waits for its turn, runs alone, and holds back later shared jobs"
  fresh; export CANAL_PW_SLOTS=2
  bg "$PW" sh -c "echo A-start >> $T/seq; sleep 1.5; echo A-end >> $T/seq"
  wait_for 5 '[ -f $T/canal-pw.slot1/pid ]'
  bg "$PW" sh -c "echo B-start >> $T/seq; sleep 1.5; echo B-end >> $T/seq"
  wait_for 5 '[ -f $T/canal-pw.slot2/pid ]'
  waiter "$PW" sh -c "echo S-start >> $T/seq; sleep 0.5; echo S-end >> $T/seq"
  waiter env CANAL_PW_TIMING=1 "$PW" sh -c "n=\$(ls -d $T/canal-pw.slot* 2>/dev/null | wc -l | tr -d ' '); echo T-start-slots=\$n >> $T/seq; sleep 1; echo T-end >> $T/seq"
  waiter "$PW" sh -c "echo C-start >> $T/seq; echo C-end >> $T/seq"
  wait_for 20 'grep -q C-end $T/seq 2>/dev/null'
  got=$(tr '\n' ' ' < "$T/seq"); echo "       sequence: $got"
  case "$got" in
    "A-start B-start "*"S-start"*"S-end"*"T-start-slots=0 T-end C-start C-end ")
      case "$got" in *A-end*B-end*T-start*|*B-end*A-end*T-start*) ok "S (queued first) ran before T; T ran alone after A, B, S; C (queued after T) waited for T" ;; *) bad "T started before A and B ended" ;; esac ;;
    *) bad "unexpected sequence" ;;
  esac
  cleanup_case
}

case_expire() {
  echo "expire: a holder over its max hold is stopped and its slot handed on"
  fresh; export CANAL_PW_SLOTS=1
  CANAL_PW_MAX_HOLD=2 bg "$PW" sleep 300; H=$LAST
  wait_for 5 '[ -f $T/canal-pw.slot1/pid ]'
  bg "$PW" sh -c "date +%s > $T/ran"
  if wait_for 10 '[ -f $T/ran ]'; then ok "waiter ran after expiry"; else bad "no expiry"; fi
  grep -q "EXPIRE canal-pw.slot1 holder=$H (held [0-9]*s > max hold 2s;.*cmd: sleep 300" "$T/canal-pw.events.log" && ok "EXPIRE logged" || bad "no EXPIRE line"
  wait_for 5 '! kill -0 $H 2>/dev/null' && ok "holder stopped" || bad "holder still running"
  events; cleanup_case
}

case_rc() {
  echo "rc: the command's exit status passes through; the slot is released"
  fresh; export CANAL_PW_SLOTS=1
  "$PW" sh -c 'exit 7'; rc=$?
  [ $rc -eq 7 ] && ok "exit 7 passed through" || bad "rc $rc"
  [ -d "$T/canal-pw.slot1" ] && bad "slot left behind" || ok "slot released"
  grep -q "RELEASE canal-pw.slot1 .* rc=7" "$T/canal-pw.events.log" && ok "RELEASE logged" || bad "no RELEASE line"
  cleanup_case
}

case_prepush() {
  echo "prepush: lane-branch pushes run lint only; a push to main runs lint and the smoke in a slot"
  fresh; export CANAL_PW_SLOTS=1
  mkdir -p "$T/bin"
  cat > "$T/bin/npm" <<EOF
#!/bin/sh
echo "npm \$* held=\${CANAL_PW_HELD:-none}" >> $T/npm.log
EOF
  chmod +x "$T/bin/npm"
  Z=0000000000000000000000000000000000000000
  printf 'refs/heads/lane/x abc refs/heads/lane/x %s\n' $Z | PATH="$T/bin:$PATH" CANAL_PW="$PW" sh "$HOOK" origin url >/dev/null; rc=$?
  got=$(tr '\n' ';' < "$T/npm.log"); [ $rc -eq 0 ] && [ "$got" = "npm run lint held=none;" ] && ok "lane push: $got" || bad "lane push rc=$rc: $got"
  rm -f "$T/npm.log"
  printf 'refs/heads/lane/x abc refs/heads/lane/x %s\nrefs/heads/main def refs/heads/main %s\n' $Z $Z | PATH="$T/bin:$PATH" CANAL_PW="$PW" sh "$HOOK" origin url >/dev/null; rc=$?
  got=$(tr '\n' ';' < "$T/npm.log"); [ $rc -eq 0 ] && [ "$got" = "npm run lint held=none;npm run test:e2e:smoke held=$T/canal-pw.slot1;" ] && ok "main push: $got" || bad "main push rc=$rc: $got"
  rm -f "$T/npm.log"
  printf '(delete) %s refs/heads/main abc\n' $Z | PATH="$T/bin:$PATH" CANAL_PW="$PW" CANAL_PW_HELD=outer sh "$HOOK" origin url >/dev/null
  got=$(tr '\n' ';' < "$T/npm.log"); [ "$got" = "npm run lint held=outer;npm run test:e2e:smoke held=outer;" ] && ok "main push inside a held slot runs nested: $got" || bad "nested main push: $got"
  cleanup_case
}

CASES=${*:-takeover nopid fifo deadwaiter nesting timing expire rc prepush}
for c in $CASES; do "case_$c"; done
[ $FAIL -eq 0 ] && echo "browser-queue tests: all passed" || echo "browser-queue tests: FAILED"
exit $FAIL
