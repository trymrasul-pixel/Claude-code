#!/bin/bash
# Renders the whole video in chunks with N parallel workers (resumable).
cd "$(dirname "$0")"
FPS=30; DUR=668; TOTAL=$((FPS*DUR)); CH=1800; N=${N:-3}
mkdir -p out
jobs_list=()
for ((s=0; s<TOTAL; s+=CH)); do e=$((s+CH)); ((e>TOTAL)) && e=$TOTAL; jobs_list+=("$s:$e"); done
run() { IFS=: read s e <<< "$1"; f=$(printf "out/chunk_%05d.mp4" $s); [ -f "$f.done" ] && return; node render.js range $s $e "$f" > "$f.log" 2>&1 && touch "$f.done"; }
export -f run
printf "%s\n" "${jobs_list[@]}" | xargs -P $N -I{} bash -c 'run {}'
echo ALL_DONE
