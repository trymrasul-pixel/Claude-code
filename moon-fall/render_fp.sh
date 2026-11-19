#!/bin/bash
# Re-render only the first-person street shots (resumable).
cd "$(dirname "$0")"
run() { IFS=: read s e <<< "$1"; f=$(printf "out/fp/seg_%05d_%05d.mp4" $s $e); [ -f "$f.done" ] && return; node render.js range $s $e "$f" > "$f.log" 2>&1 && touch "$f.done"; }
export -f run
printf "%s\n" 0:1380 4200:5880 7860:9400 9400:10950 12900:14040 15150:16230 18360:20040 | xargs -P 3 -I{} bash -c 'run {}'
echo ALL_DONE
