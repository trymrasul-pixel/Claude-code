#!/bin/bash
# Splice re-rendered first-person segments into the existing master, then encode the final upload file.
set -e
cd "$(dirname "$0")"
SRC=out/what_if_the_moon_fell_to_earth.mp4
mkdir -p out/keep
keep() { a=$1; b=$2; f=$(printf "out/keep/keep_%05d_%05d.mp4" $a $b); [ -f "$f" ] && return;
  ffmpeg -v error -y -ss $(python3 -c "print($a/30)") -i $SRC -frames:v $((b-a)) -an -c:v libx264 -preset veryfast -crf 14 -pix_fmt yuv420p -r 30 "$f"; }
keep 1380 4200; keep 5880 7860; keep 10950 12900; keep 14040 15150; keep 16230 18360
: > out/splice_list.txt
for seg in fp/seg_00000_01380 keep/keep_01380_04200 fp/seg_04200_05880 keep/keep_05880_07860 fp/seg_07860_09400 fp/seg_09400_10950 keep/keep_10950_12900 fp/seg_12900_14040 keep/keep_14040_15150 fp/seg_15150_16230 keep/keep_16230_18360 fp/seg_18360_20040; do
  n=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 out/$seg.mp4); echo "$seg $n frames" >&2
  echo "file '$seg.mp4'" >> out/splice_list.txt
done
ffmpeg -v error -y -f concat -safe 0 -i out/splice_list.txt -i out/soundtrack_mastered.wav -map 0:v -map 1:a \
  -c:v libx264 -preset medium -crf 21 -maxrate 4800k -bufsize 9600k -pix_fmt yuv420p -profile:v high -g 15 -bf 2 -r 30 \
  -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest out/what_if_the_moon_fell_to_earth_fp.mp4
ffprobe -v error -show_entries format=duration,size -of default=nw=1 out/what_if_the_moon_fell_to_earth_fp.mp4
