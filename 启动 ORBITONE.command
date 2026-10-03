#!/bin/zsh

PROJECT_DIR="${0:A:h}"
RUNTIME_DIR="$PROJECT_DIR/.orbitone-runtime"
PID_FILE="$RUNTIME_DIR/server.pid"
LOG_FILE="$RUNTIME_DIR/server.log"
HOST="127.0.0.1"
PORT="3000"
URL="http://$HOST:$PORT"
SERVER_PID=""

pause_before_exit() {
  [[ -t 0 ]] || return 0
  echo
  read -k 1 "?按任意键关闭这个窗口..."
  echo
}

fail() {
  echo "❌ $1"
  echo "日志位置：$LOG_FILE"
  pause_before_exit
  exit 1
}

cleanup_runtime() {
  local recorded_pid=""
  if [[ -f "$PID_FILE" ]]; then
    recorded_pid="$(tr -dc '0-9' < "$PID_FILE")"
  fi
  if [[ -n "$SERVER_PID" ]] && [[ "$recorded_pid" == "$SERVER_PID" ]]; then
    rm -f "$PID_FILE"
  fi
}

trap cleanup_runtime EXIT

echo "========================================"
echo "  ORBITONE 星轨音乐盒 · 一键启动"
echo "========================================"
echo

command -v node >/dev/null 2>&1 || fail "没有找到 Node.js，请先安装 Node.js 22.13 或更高版本。"
command -v npm >/dev/null 2>&1 || fail "没有找到 npm，请重新安装 Node.js。"

NODE_VERSION="$(node -p 'process.versions.node' 2>/dev/null)"
NODE_MAJOR="${NODE_VERSION%%.*}"
NODE_REMAINDER="${NODE_VERSION#*.}"
NODE_MINOR="${NODE_REMAINDER%%.*}"
if [[ -z "$NODE_VERSION" ]] || (( NODE_MAJOR < 22 )) || (( NODE_MAJOR == 22 && NODE_MINOR < 13 )); then
  fail "当前 Node.js 版本是 ${NODE_VERSION:-未知}，本项目需要 22.13 或更高版本。"
fi

mkdir -p "$RUNTIME_DIR" || fail "无法创建运行目录。"

if [[ -f "$PID_FILE" ]]; then
  EXISTING_PID="$(tr -dc '0-9' < "$PID_FILE")"
  if [[ -n "$EXISTING_PID" ]] && kill -0 "$EXISTING_PID" 2>/dev/null; then
    echo "✅ ORBITONE 已经在运行：$URL"
    [[ "${ORBITONE_SKIP_OPEN:-0}" == "1" ]] || open "$URL" >/dev/null 2>&1
    pause_before_exit
    exit 0
  fi
  rm -f "$PID_FILE"
fi

PORT_PID="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1)"
if [[ -n "$PORT_PID" ]]; then
  fail "端口 $PORT 已被其他程序占用（PID $PORT_PID）。请先关闭占用程序，或修改脚本中的 PORT。"
fi

cd "$PROJECT_DIR" || fail "无法进入项目目录。"

if [[ ! -d node_modules ]]; then
  echo "首次运行：正在安装依赖，请保持网络连接……"
  npm install || fail "依赖安装失败。"
fi

echo "正在启动本地服务……"
printf '\n[%s] ORBITONE start\n' "$(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
npm run dev -- --port "$PORT" --hostname "$HOST" >> "$LOG_FILE" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > "$PID_FILE"

for attempt in {1..60}; do
  if curl --fail --silent --max-time 1 "$URL" >/dev/null 2>&1; then
    echo "✅ 启动成功：$URL"
    echo "运行日志：$LOG_FILE"
    [[ "${ORBITONE_SKIP_OPEN:-0}" == "1" ]] || open "$URL" >/dev/null 2>&1
    echo
    echo "服务正在运行。你可以保留此窗口，或双击“关闭 ORBITONE.command”安全关闭。"
    wait "$SERVER_PID"
    SERVER_EXIT=$?
    echo
    echo "ORBITONE 服务已停止。"
    exit "$SERVER_EXIT"
  fi

  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    rm -f "$PID_FILE"
    fail "服务提前退出，请查看日志。"
  fi
  sleep 1
done

kill -TERM "$SERVER_PID" 2>/dev/null
rm -f "$PID_FILE"
fail "等待 60 秒后仍无法访问 $URL。"
