#!/bin/zsh

PROJECT_DIR="${0:A:h}"
RUNTIME_DIR="$PROJECT_DIR/.orbitone-runtime"
PID_FILE="$RUNTIME_DIR/server.pid"
LOG_FILE="$RUNTIME_DIR/server.log"
HOST="127.0.0.1"
PORT="3000"
URL="http://$HOST:$PORT"

pause_before_exit() {
  [[ -t 0 ]] || return 0
  echo
  read -k 1 "?按任意键关闭这个窗口..."
  echo
}

descendants_of() {
  local parent_pid="$1"
  local child_pid
  for child_pid in $(pgrep -P "$parent_pid" 2>/dev/null); do
    descendants_of "$child_pid"
    echo "$child_pid"
  done
}

echo "========================================"
echo "  ORBITONE 星轨音乐盒 · 一键关闭"
echo "========================================"
echo

if [[ ! -f "$PID_FILE" ]]; then
  echo "ℹ️ 没有找到 ORBITONE 的运行记录，服务可能已经关闭。"
  echo "如果 $URL 仍能访问，说明端口由其他程序占用，本脚本不会误关它。"
  pause_before_exit
  exit 0
fi

SERVER_PID="$(tr -dc '0-9' < "$PID_FILE")"
if [[ -z "$SERVER_PID" ]] || ! kill -0 "$SERVER_PID" 2>/dev/null; then
  rm -f "$PID_FILE"
  echo "✅ 运行记录已清理，ORBITONE 当前没有运行。"
  pause_before_exit
  exit 0
fi

CHILD_PIDS=("${(@f)$(descendants_of "$SERVER_PID")}")

for child_pid in $CHILD_PIDS; do
  [[ -n "$child_pid" ]] && kill -TERM "$child_pid" 2>/dev/null
done
kill -TERM "$SERVER_PID" 2>/dev/null

for attempt in {1..30}; do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    break
  fi
  sleep 0.2
done

for child_pid in $CHILD_PIDS; do
  if [[ -n "$child_pid" ]] && kill -0 "$child_pid" 2>/dev/null; then
    kill -KILL "$child_pid" 2>/dev/null
  fi
done
if kill -0 "$SERVER_PID" 2>/dev/null; then
  kill -KILL "$SERVER_PID" 2>/dev/null
fi

rm -f "$PID_FILE"
printf '[%s] ORBITONE stopped\n' "$(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"

echo "✅ ORBITONE 已关闭。"
echo "日志保留在：$LOG_FILE"
pause_before_exit
