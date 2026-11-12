#!/bin/bash
# Browser queue for every lane on this machine: /tmp/canal-pw.sh <cmd> runs <cmd> in one of three shared slots.
# Tracked source: scripts/browser-queue/canal-pw.sh; installed by scripts/browser-queue/install.sh (write + mv, never
# edit /tmp/canal-pw.sh in place: running bash instances read their script lazily). Docs: docs/browser-queue.md.
#
#   /tmp/canal-pw.sh <cmd>                      shared: one of three slots (spec runs, gates, main pushes, frames)
#   CANAL_PW_TIMING=1 /tmp/canal-pw.sh <cmd>    exclusive: the whole machine, for timing measurements only
#   /tmp/canal-pw.sh --status                   slots, holders, the gate and the queue in order
#
# Fair: every waiter takes a ticket in <dir>/canal-pw.queue (name = arrival time in microseconds + pid); a waiter may
# take a free slot only when fewer waiters are ahead of it than slots are free, so jobs start in arrival order.
# Crash-safe: each poll a waiter reclaims a slot whose holder is dead (pid + start time in <slot>/pid, <slot>/start),
# one with no pid file older than CANAL_PW_GRACE, and expires one held longer than its max hold (holder and its direct
# children get SIGTERM). A ticket whose waiter died is dropped. Every reclaim, expiry and drop goes to
# <dir>/canal-pw.events.log with the old holder's command; so do acquire and release (with waited/held seconds).
# Nesting: a call made inside a held slot (CANAL_PW_HELD set) runs in the outer slot (house:frames wraps itself).
#
# Environment (defaults): CANAL_PW_DIR (/tmp)  CANAL_PW_SLOTS (3)  CANAL_PW_POLL (2 s)  CANAL_PW_GRACE (30 s)
#   CANAL_PW_MAX_HOLD (7200 s; a job may ask for more for itself, capped at 21600)  CANAL_PW_TIMING (unset)
# History: 2026-11-01 two slots + exclusive; 2026-11-10 three slots, only CANAL_PW_TIMING exclusive; 2026-11-12 nesting
# guard + <slot>/pid; 2026-11-12 lane Q1 (#378): FIFO tickets, dead-holder reclaim, max hold, events log, --status.
if [ -n "${CANAL_PW_HELD:-}" ]; then exec "$@"; fi

D=${CANAL_PW_DIR:-/tmp}
N=${CANAL_PW_SLOTS:-3}
POLL=${CANAL_PW_POLL:-2}
GRACE=${CANAL_PW_GRACE:-30}
MAX_HOLD=${CANAL_PW_MAX_HOLD:-7200}
[ "$MAX_HOLD" -gt 21600 ] 2>/dev/null && MAX_HOLD=21600
GATE=$D/canal-pw.lock
Q=$D/canal-pw.queue
LOG=$D/canal-pw.events.log
REAP=$D/canal-pw.reap
SLOTS=()
i=1; while [ $i -le "$N" ]; do SLOTS+=("$D/canal-pw.slot$i"); i=$((i + 1)); done

now() { date +%s; }
mtime() { stat -f %m "$1" 2>/dev/null || stat -c %Y "$1" 2>/dev/null || echo 0; }
# A process's start time: with the pid it names one process even after the pid is reused. Empty when it is gone.
startof() { ps -o lstart= -p "$1" 2>/dev/null | sed 's/^ *//;s/ *$//'; }
# Polling is fork-light (twenty waiters poll at once under load): liveness is kill -0; the start time is compared only
# before a holder is killed (expiry) and in --status, where a reused pid would do harm or mislead.
alive() { kill -0 "$1" 2>/dev/null; }
same() { local s; s=$(startof "$1"); [ -n "$s" ] && { [ -z "${2:-}" ] || [ "$s" = "$2" ]; }; }
first() { FIRST=""; { read -r FIRST < "$1"; } 2>/dev/null; }
log() {
  [ -f "$LOG" ] && [ "$(wc -c < "$LOG" 2>/dev/null || echo 0)" -gt 5000000 ] && mv -f "$LOG" "$LOG.1" 2>/dev/null
  printf '%s %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*" >> "$LOG" 2>/dev/null
}
short() { printf '%s' "$*" | tr '\n' ' ' | cut -c1-240; }
CMD=$(short "$*")
ME_START=$(startof $$)

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
}

status() {
  local s pid age t tpid
  for s in "${SLOTS[@]}" "$GATE"; do
    if [ -d "$s" ]; then
      pid=$(head -n1 "$s/pid" 2>/dev/null)
      age=$(( $(now) - $(cat "$s/since" 2>/dev/null || mtime "$s") ))
      printf '%-22s held %5ss pid %-7s %s %s\n' "${s##*/}" "$age" "${pid:-?}" "$(same "${pid:-0}" "$(cat "$s/start" 2>/dev/null)" && echo alive || echo DEAD)" "$(cat "$s/cmd" 2>/dev/null || ps -o command= -p "${pid:-0}" 2>/dev/null | cut -c1-160)"
    else
      printf '%-22s free\n' "${s##*/}"
    fi
  done
  echo "queue (oldest first):"
  for t in "$Q"/[0-9]*; do
    [ -f "$t" ] || continue; t=${t##*/}; tpid=${t##*.}
    printf '  %s waited %5ss %s %s\n' "$tpid" "$(( $(now) - ${t%%.*} ))" "$(sed -n 3p "$Q/$t" 2>/dev/null)" "$(sed -n 4p "$Q/$t" 2>/dev/null)"
  done
}

case "${1:-}" in
  --status) status; exit 0 ;;
  --help|-h|"") usage; exit 0 ;;
esac

# Reclaim one slot (or the gate) when its holder is gone or over its max hold. Under $REAP, re-reading the pid before
# removing, so two waiters never both act and a slot just re-taken by a live job is left alone.
reap() {
  local d=$1 pid start since mh reason="" expire="" thr age pid2 cmd c
  [ -d "$d" ] || return 0
  first "$d/pid"; pid=$FIRST
  if [ -z "$pid" ]; then
    # A new holder writes its pid right after mkdir; a gate from the pre-Q1 script never has one, so it gets the max hold.
    thr=$GRACE; [ "$d" = "$GATE" ] && thr=$MAX_HOLD
    age=$(( NOW - $(mtime "$d") ))
    [ "$age" -gt "$thr" ] && reason="no pid file for ${age}s"
  elif ! alive "$pid"; then reason="holder $pid is dead"
  else
    first "$d/since"; since=$FIRST; [ -n "$since" ] || since=$(mtime "$d/pid")
    first "$d/maxhold"; mh=${FIRST:-$MAX_HOLD}
    age=$(( NOW - since ))
    if [ "$age" -gt "$mh" ]; then
      first "$d/start"; start=$FIRST
      if same "$pid" "$start"; then reason="held ${age}s > max hold ${mh}s"; expire=1
      else reason="holder $pid is dead (pid reused by another process)"; fi
    fi
  fi
  [ -n "$reason" ] || return 0
  if ! mkdir "$REAP" 2>/dev/null; then
    [ $(( NOW - $(mtime "$REAP") )) -gt 60 ] && rmdir "$REAP" 2>/dev/null
    return 0
  fi
  first "$d/pid"; pid2=$FIRST
  if [ -d "$d" ] && [ "$pid2" = "$pid" ]; then
    cmd=$(cat "$d/cmd" 2>/dev/null); [ -n "$cmd" ] || cmd="(pre-Q1 holder) $(ps -o command= -p "${pid:-0}" 2>/dev/null | cut -c1-200)"
    # Take the slot away first (the holder's own cleanup then finds no pid of its own and frees nothing a newcomer took).
    mv "$d" "$d.reaped.$$" 2>/dev/null && rm -rf "$d.reaped.$$"
    if [ -n "$expire" ]; then
      for c in $(pgrep -P "$pid" 2>/dev/null); do kill -TERM "$c" 2>/dev/null; done
      kill -TERM "$pid" 2>/dev/null
      log "EXPIRE ${d##*/} holder=$pid ($reason; holder and its children sent SIGTERM) by=$$ cmd: $cmd"
    else
      log "RECLAIM ${d##*/} holder=${pid:-none} ($reason) by=$$ cmd: $cmd"
    fi
  fi
  rmdir "$REAP" 2>/dev/null
  return 0
}
reap_all() { local s; NOW=$(now); for s in "${SLOTS[@]}" "$GATE"; do reap "$s"; done; }

# Fill a held slot or the gate: pid first (the grace rule keys on it), then what --status and the log show.
claim() {
  echo $$ > "$1/pid"
  echo "$ME_START" > "$1/start"
  now > "$1/since"
  echo "$MAX_HOLD" > "$1/maxhold"
  printf '%s\n' "$CMD (cwd $PWD, PW_PORT ${PW_PORT:-unset})" > "$1/cmd"
}

# Waiters ahead of my ticket (dead ones dropped). Sets AHEAD and TIMING_AHEAD.
scan_queue() {
  local t tpid l1 l2 mode tcmd
  AHEAD=0; TIMING_AHEAD=0
  for t in "$Q"/[0-9]*; do   # glob order = ticket order (fixed-width arrival time first)
    [ "$t" = "$TICKET" ] && return 0
    [ -f "$t" ] || continue
    tpid=${t##*.}
    if ! alive "$tpid"; then
      mode=""; tcmd=""; { read -r l1; read -r l2; read -r mode; read -r tcmd; } 2>/dev/null < "$t"
      rm -f "$t" && log "DROP ticket ${t##*/} (waiter $tpid is dead) by=$$ cmd: $tcmd"
      continue
    fi
    AHEAD=$((AHEAD + 1))
    mode=""; { read -r l1; read -r l2; read -r mode; } 2>/dev/null < "$t"
    [ "$mode" = timing ] && TIMING_AHEAD=1
  done
}

HELD=""; TICKET=""; T0=$(now)
cleanup() {
  [ -n "$TICKET" ] && rm -f "$TICKET"
  first "$HELD/pid"
  if [ -n "$HELD" ] && [ "$FIRST" = "$$" ]; then
    rm -rf "$HELD"
    log "RELEASE ${HELD##*/} pid=$$ held=$(( $(now) - ${T1:-$T0} ))s rc=${RC:-signal} cmd: $CMD"
  fi
}
trap cleanup EXIT
trap 'exit 129' HUP; trap 'exit 130' INT; trap 'exit 143' TERM

MODE=shared; [ -n "${CANAL_PW_TIMING:-}" ] && MODE=timing
mkdir -p "$Q" 2>/dev/null
TICKET_NAME=$(perl -MTime::HiRes=time -e 'printf "%017.6f", time').$$
printf '%s\n%s\n%s\n%s\n' "$$" "$ME_START" "$MODE" "$CMD" > "$Q/.new.$$" && mv -f "$Q/.new.$$" "$Q/$TICKET_NAME"
TICKET=$Q/$TICKET_NAME

if [ "$MODE" = timing ]; then
  # Take the gate in turn (no new shared job starts after that), then wait for every slot to drain.
  while :; do
    reap_all
    scan_queue
    if [ "$AHEAD" -eq 0 ] && mkdir "$GATE" 2>/dev/null; then HELD=$GATE; claim "$GATE"; break; fi
    sleep "$POLL"
  done
  rm -f "$TICKET"; TICKET=""
  while :; do
    busy=0; NOW=$(now); for s in "${SLOTS[@]}"; do reap "$s"; [ -d "$s" ] && busy=1; done
    [ $busy -eq 0 ] && break
    sleep "$POLL"
  done
else
  while [ -z "$HELD" ]; do
    reap_all
    if [ ! -d "$GATE" ]; then
      scan_queue
      if [ "$TIMING_AHEAD" -eq 0 ]; then
        free=0; for s in "${SLOTS[@]}"; do [ -d "$s" ] || free=$((free + 1)); done
        if [ "$AHEAD" -lt "$free" ]; then
          for s in "${SLOTS[@]}"; do
            if mkdir "$s" 2>/dev/null; then HELD=$s; claim "$s"; break; fi
          done
        fi
      fi
    fi
    [ -z "$HELD" ] && sleep "$POLL"
  done
  rm -f "$TICKET"; TICKET=""
fi

T1=$(now)
log "ACQUIRE ${HELD##*/} pid=$$ mode=$MODE waited=$((T1 - T0))s cmd: $CMD"
export CANAL_PW_HELD=$HELD
"$@"
RC=$?
exit $RC
