#!/bin/bash
# Concatenate rendered chunks and mux with the mastered soundtrack.
set -e
cd "$(dirname "$0")"
ls out/chunk_*.mp4 | sort | sed "s/^out\//file '/; s/$/'/" > out/list.txt
ffmpeg -y -v error -f concat -safe 0 -i out/list.txt -i out/soundtrack_mastered.wav \
  -map 0:v -map 1:a -c:v libx264 -preset slow -crf 19 -maxrate 9M -bufsize 18M -pix_fmt yuv420p -profile:v high -g 15 -bf 2 -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest out/what_if_the_moon_fell_to_earth.mp4
ffprobe -v error -show_entries format=duration,size -of default=nw=1 out/what_if_the_moon_fell_to_earth.mp4
