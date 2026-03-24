#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <python_executable> <config_path>"
  exit 1
fi

PYTHON_BIN="$1"
CONFIG_PATH="$2"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_PATH="$SCRIPT_DIR/daily_refresh_agent.py"

# Every day at 06:30 local time.
CRON_LINE="30 6 * * * ${PYTHON_BIN} ${SCRIPT_PATH} --config ${CONFIG_PATH} >> ${SCRIPT_DIR}/logs/cron.log 2>&1"

mkdir -p "${SCRIPT_DIR}/logs"

TMP_FILE="$(mktemp)"
crontab -l > "${TMP_FILE}" 2>/dev/null || true

if ! rg -F "${SCRIPT_PATH}" "${TMP_FILE}" >/dev/null 2>&1; then
  echo "${CRON_LINE}" >> "${TMP_FILE}"
  crontab "${TMP_FILE}"
  echo "Installed cron entry:"
  echo "${CRON_LINE}"
else
  echo "Cron entry already exists for ${SCRIPT_PATH}"
fi

rm -f "${TMP_FILE}"
