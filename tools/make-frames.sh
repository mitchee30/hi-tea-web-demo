#!/usr/bin/env bash
# =========================================================
# make-frames.sh：把产品视频拆成网页滚动播放用的帧
#
# 用法（在项目根目录运行）：
#   bash tools/make-frames.sh 片段1.mp4 [片段2.mp4 ...]
#
# 几个片段会按顺序接起来，当成一整段。然后：
#   - 平均取 FRAMES 张（默认 150 张）
#   - 电脑版：宽 1600 的横版 webp → public/media/story/desktop/0001.webp ...
#   - 手机版：从中间裁成 9:16 竖版，宽 720 → public/media/story/mobile/0001.webp ...
#   - 写 public/media/story/frames.json（帧数、尺寸、背景色）
#
# 可以调的参数（写在命令前面），例如：
#   FRAMES=180 MOBILE_FOCUS=0.6 bash tools/make-frames.sh clip.mp4
#   FRAMES        一共取多少帧，越多越顺、文件越大（120~200 比较合适）
#   WIDTH         电脑版宽度，默认 1600
#   QUALITY       webp 质量 0~100，默认 68
#   MOBILE_QUALITY 手机版的质量，默认 58（手机屏幕小，压多一点省流量）
#   MOBILE_FOCUS  手机版裁剪的位置，0=最左 0.5=正中 1=最右；产品偏右就调大一点
#   DESKTOP_FOCUS 电脑屏幕比视频窄时，往哪边裁，默认 0.5
#   STATIC_AT     开了"减少动态效果"的人看到哪一帧（0~1），默认 0.55
#   BG            画面上下边缘渐隐到的颜色，例如 BG=1a120c；不填就取第一帧左上角的颜色
#
# 需要 ffmpeg（Mac：brew install ffmpeg）
# =========================================================
set -euo pipefail

FRAMES="${FRAMES:-150}"
WIDTH="${WIDTH:-1600}"
QUALITY="${QUALITY:-68}"
MOBILE_QUALITY="${MOBILE_QUALITY:-58}"
MOBILE_FOCUS="${MOBILE_FOCUS:-0.5}"
DESKTOP_FOCUS="${DESKTOP_FOCUS:-0.5}"
STATIC_AT="${STATIC_AT:-0.55}"
OUT="${OUT:-public/media/story}"

if [ "$#" -lt 1 ]; then
  echo "用法：bash tools/make-frames.sh 片段1.mp4 [片段2.mp4 ...]" >&2
  exit 1
fi
command -v ffmpeg >/dev/null || { echo "没找到 ffmpeg。Mac 上先运行：brew install ffmpeg" >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# 1. 每个片段统一成 1920x1080、30fps，再接起来（尺寸不同的片段也能接）
inputs=()
filter=""
i=0
total=0
for f in "$@"; do
  [ -f "$f" ] || { echo "找不到文件：$f" >&2; exit 1; }
  d="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")"
  total="$(awk -v a="$total" -v b="$d" 'BEGIN{print a+b}')"
  inputs+=(-i "$f")
  filter+="[$i:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30,setsar=1[v$i];"
  i=$((i+1))
done
concat=""
for ((k=0; k<i; k++)); do concat+="[v$k]"; done
filter+="${concat}concat=n=$i:v=1:a=0[all]"
echo "→ 接起来一共 ${total} 秒，取 ${FRAMES} 帧"
ffmpeg -v error -y "${inputs[@]}" -filter_complex "$filter" -map "[all]" -c:v libx264 -crf 12 -pix_fmt yuv420p "$TMP/all.mp4"

# 2. 平均取 FRAMES 帧
fps="$(awk -v n="$FRAMES" -v t="$total" 'BEGIN{printf "%.5f", n/t}')"
rm -rf "$OUT/desktop" "$OUT/mobile"
mkdir -p "$OUT/desktop" "$OUT/mobile"

echo "→ 电脑版帧（宽 ${WIDTH}）"
ffmpeg -v error -y -i "$TMP/all.mp4" -vf "fps=${fps},scale=${WIDTH}:-2:flags=lanczos" \
  -frames:v "$FRAMES" -c:v libwebp -quality "$QUALITY" -compression_level 6 "$OUT/desktop/%04d.webp"

echo "→ 手机版帧（9:16 竖版，宽 720）"
ffmpeg -v error -y -i "$TMP/all.mp4" -vf "fps=${fps},crop=ih*9/16:ih:(iw-ow)*${MOBILE_FOCUS}:0,scale=720:-2:flags=lanczos" \
  -frames:v "$FRAMES" -c:v libwebp -quality "$MOBILE_QUALITY" -compression_level 6 "$OUT/mobile/%04d.webp"

count="$(ls "$OUT/desktop" | wc -l | tr -d ' ')"

# 3. 取第一帧左上角的颜色当背景色，让画面边缘和网页接得上
bg="$(ffmpeg -v error -i "$TMP/all.mp4" -frames:v 1 -vf "crop=40:40:0:0,scale=1:1" -f rawvideo -pix_fmt rgb24 - | od -An -tx1 | tr -d ' \n')"
[ "${#bg}" -eq 6 ] || bg="120a1c"
[ -n "${BG:-}" ] && bg="${BG#\#}"

dh="$(awk -v w="$WIDTH" 'BEGIN{h=int(w*1080/1920); if (h%2) h++; print h}')"
cat > "$OUT/frames.json" <<JSON
{
  "count": ${count},
  "bg": "#${bg}",
  "staticAt": ${STATIC_AT},
  "desktop": { "path": "desktop/%04d.webp", "width": ${WIDTH}, "height": ${dh}, "focusX": ${DESKTOP_FOCUS} },
  "mobile": { "path": "mobile/%04d.webp", "width": 720, "height": 1280, "focusX": 0.5 }
}
JSON

size_d="$(du -sh "$OUT/desktop" | cut -f1)"
size_m="$(du -sh "$OUT/mobile" | cut -f1)"
echo "✓ 完成：${count} 帧 · 电脑版 ${size_d} · 手机版 ${size_m} · 背景色 #${bg}"
echo "  打开首页往下滑就能看到。不想要了就删掉 ${OUT} 文件夹，首页会自动换回 SVG 版。"
