#!/usr/bin/env bash
# Запуск смоук-теста: поднимает локальный сервер, прогоняет проверки, гасит сервер.
# Использование:  bash tools/run_tests.sh
set -u

PORT="${PORT:-8123}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

if [ ! -d node_modules/jsdom ]; then
  echo "Нужен jsdom (только для тестов):  npm install --no-save jsdom"
  exit 1
fi

node serve.js "$PORT" >/tmp/restaurant-server.log 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT

# ждём, пока сервер ответит
for i in $(seq 1 40); do
  if node -e "require('http').get({port:$PORT,host:'127.0.0.1',path:'/'},r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))" 2>/dev/null; then
    break
  fi
  sleep 0.2
done

BASE_URL="http://127.0.0.1:$PORT/" node tools/smoke_test.js "$@"
RESULT=$?

exit $RESULT
