#!/usr/bin/env bash
# Machine heartbeat collector — reports this machine's state to Paperclip.
# Usage: PAPERCLIP_API_URL=http://... PAPERCLIP_API_KEY=... PAPERCLIP_COMPANY_ID=... bash machine-heartbeat.sh
# For continuous mode: bash machine-heartbeat.sh --loop [interval_seconds]

set -euo pipefail

: "${PAPERCLIP_API_URL:?must be set}"
: "${PAPERCLIP_API_KEY:?must be set}"
: "${PAPERCLIP_COMPANY_ID:?must be set}"

INTERVAL="${1:-}"
LOOP=false
if [[ "$INTERVAL" == "--loop" ]]; then
  LOOP=true
  INTERVAL="${2:-300}"
fi

collect_and_post() {
  local HOSTNAME_VAL
  HOSTNAME_VAL=$(hostname)

  # Tailscale IP
  local TS_IP=""
  if command -v tailscale &>/dev/null; then
    TS_IP=$(tailscale ip -4 2>/dev/null || true)
  fi

  # Detect role from hostname
  local ROLE="general"
  case "$HOSTNAME_VAL" in
    *dev*)     ROLE="dev" ;;
    *prod*)    ROLE="production" ;;
    *database*|*db*) ROLE="database" ;;
    *gpu*)     ROLE="gpu" ;;
  esac

  # Capabilities
  local MEM_MB DISK_AVAIL_GB GPU_INFO CAPS
  MEM_MB=$(free -m 2>/dev/null | awk '/^Mem:/{print $2}' || echo "0")
  DISK_AVAIL_GB=$(df -BG / 2>/dev/null | awk 'NR==2{gsub(/G/,"",$4); print $4}' || echo "0")
  GPU_INFO="null"
  if command -v nvidia-smi &>/dev/null; then
    local GPU_NAME GPU_MEM
    GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1 || true)
    GPU_MEM=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null | head -1 || true)
    if [[ -n "$GPU_NAME" ]]; then
      GPU_INFO=$(printf '{"name":"%s","memoryMb":%s}' "$GPU_NAME" "${GPU_MEM:-0}")
    fi
  fi
  CAPS=$(printf '{"ramMb":%s,"diskAvailGb":%s,"gpu":%s}' "$MEM_MB" "$DISK_AVAIL_GB" "$GPU_INFO")

  # Services — check common services
  local SERVICES="["
  local FIRST=true

  add_svc() {
    local name="$1" port="$2" status="$3"
    if [[ "$FIRST" != "true" ]]; then SERVICES+=","; fi
    SERVICES+=$(printf '{"name":"%s","port":%s,"status":"%s"}' "$name" "$port" "$status")
    FIRST=false
  }

  # Postgres
  if ss -tlnp 2>/dev/null | grep -q ':5433 '; then
    add_svc "postgres" 5433 "running"
  elif ss -tlnp 2>/dev/null | grep -q ':5432 '; then
    add_svc "postgres" 5432 "running"
  fi

  # Podman containers
  if command -v podman &>/dev/null; then
    while IFS=$'\t' read -r cname cstatus cports; do
      local port
      port=$(echo "$cports" | grep -oP '\d+(?=->)' | head -1 || echo "0")
      local st="running"
      [[ "$cstatus" == *"Exited"* ]] && st="stopped"
      add_svc "container:$cname" "${port:-0}" "$st"
    done < <(podman ps -a --format '{{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null || true)
  fi

  # Tmux sessions
  if command -v tmux &>/dev/null; then
    while read -r sess; do
      [[ -z "$sess" ]] && continue
      add_svc "tmux:$sess" 0 "running"
    done < <(tmux list-sessions -F '#{session_name}' 2>/dev/null || true)
  fi

  SERVICES+="]"

  # Projects under ~/.codex/projects/
  local PROJECTS="["
  FIRST=true
  if [[ -d "$HOME/.codex/projects" ]]; then
    for proj_dir in "$HOME/.codex/projects"/*/; do
      [[ ! -d "$proj_dir" ]] && continue
      local pname repo branch
      pname=$(basename "$proj_dir")
      repo=$(git -C "$proj_dir" remote get-url origin 2>/dev/null || echo "")
      branch=$(git -C "$proj_dir" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
      if [[ "$FIRST" != "true" ]]; then PROJECTS+=","; fi
      PROJECTS+=$(printf '{"path":"%s","repo":"%s","branch":"%s"}' "$proj_dir" "$repo" "$branch")
      FIRST=false
    done
  fi
  PROJECTS+="]"

  # Skills under ~/.claude/skills/
  local SKILLS="["
  FIRST=true
  if [[ -d "$HOME/.claude/skills" ]]; then
    for skill_dir in "$HOME/.claude/skills"/*/; do
      [[ ! -d "$skill_dir" ]] && continue
      local sname
      sname=$(basename "$skill_dir")
      if [[ "$FIRST" != "true" ]]; then SKILLS+=","; fi
      SKILLS+=$(printf '{"name":"%s","path":"%s"}' "$sname" "$skill_dir")
      FIRST=false
    done
  fi
  SKILLS+="]"

  # Build payload
  local PAYLOAD
  PAYLOAD=$(cat <<ENDJSON
{
  "hostname": "$HOSTNAME_VAL",
  "tailscaleIp": "$TS_IP",
  "role": "$ROLE",
  "capabilities": $CAPS,
  "services": $SERVICES,
  "projects": $PROJECTS,
  "skills": $SKILLS
}
ENDJSON
)

  # POST heartbeat
  local HTTP_CODE
  HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' \
    -X POST \
    -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    "${PAPERCLIP_API_URL}/api/companies/${PAPERCLIP_COMPANY_ID}/machines/heartbeat")

  echo "[$(date -Iseconds)] heartbeat sent for $HOSTNAME_VAL → HTTP $HTTP_CODE"
}

if [[ "$LOOP" == "true" ]]; then
  echo "Starting heartbeat loop (interval: ${INTERVAL}s)"
  while true; do
    collect_and_post || echo "[$(date -Iseconds)] heartbeat failed"
    sleep "$INTERVAL"
  done
else
  collect_and_post
fi
