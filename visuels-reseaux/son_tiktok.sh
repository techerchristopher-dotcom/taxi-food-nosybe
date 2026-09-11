#!/usr/bin/env bash
# La bande-son des 14 s. Deux choses que le clip ne donne pas tout seul :
#
# 1. L'ASMR s'arrete a 10 s et la video dure 14. Quatre secondes de silence
#    sous la carte, c'est un trou. On prolonge le fond : 2,5 s de la fin du
#    clip, bouclees en fondu croise, a 42 % du niveau — « le son continue
#    sous la carte, en retrait ».
# 2. Le son sorti du modele est a -36,7 dB de moyenne : inaudible sur un
#    telephone. loudnorm le remonte a -14 LUFS, la cible des reseaux.
#    C'est une remontee de 20 dB, ce n'est pas un detail de finition.
set -e
CLIP=${1:?clip .mp4}
OUT=${2:?sortie .m4a}
D=${3:-14.0}          # duree finale
T=$(mktemp -d)
ffmpeg -v error -y -i "$CLIP" -vn -acodec pcm_s16le -ar 48000 "$T/son.wav"
DUREE=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$T/son.wav")
DEB=$(python3 -c "print(max(0, $DUREE - 2.75))")
ffmpeg -v error -y -i "$T/son.wav" -ss "$DEB" -t 2.5 -af "afade=t=in:st=$DEB:d=0.4" "$T/queue.wav"
ffmpeg -v error -y -i "$T/queue.wav" -i "$T/queue.wav" \
  -filter_complex "[0][1]acrossfade=d=0.4:c1=tri:c2=tri" "$T/fond.wav"
ffmpeg -v error -y -i "$T/son.wav" -i "$T/fond.wav" -filter_complex "\
 [0]atrim=0:$DUREE,asetpts=N/SR/TB[a]; \
 [1]atrim=0:4.0,asetpts=N/SR/TB,volume=0.42,adelay=${DUREE%.*}000|${DUREE%.*}000[b]; \
 [a][b]amix=inputs=2:duration=longest:normalize=0,afade=t=out:st=$(python3 -c "print($D-1.5)"):d=1.5,\
 apad=whole_dur=$D[out]" -map "[out]" -acodec aac -b:a 160k "$T/brut.m4a"
ffmpeg -v error -y -i "$T/brut.m4a" -af "loudnorm=I=-14:TP=-1.5:LRA=11" -acodec aac -b:a 160k "$OUT"
ffmpeg -hide_banner -nostats -i "$OUT" -af volumedetect -f null /dev/null 2>&1 | grep -E "mean_volume|max_volume"
