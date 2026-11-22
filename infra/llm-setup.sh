#!/usr/bin/env bash
# Runs ON the EC2 instance. Installs Gullak's category model: Qwen3 0.6B (the smallest model SemIf/openjev
# offers) served by llama.cpp's llama-server on 127.0.0.1:8090, behind an API key.
# Idempotent: safe to re-run. Builds llama.cpp from source (the prebuilt Linux binaries need a newer glibc).
#
#   LLM_KEY=<secret> bash llm-setup.sh
set -euo pipefail

LLAMA_TAG="v1.0.0"
MODEL_URL="https://huggingface.co/unsloth/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q4_K_M.gguf"
MODEL_SHA256="ac2d97712095a558e31573f62f466a3f9d93990898b0ec79d7c974c1780d524a"
SRC=/opt/llama.cpp
MODELS=/var/lib/gullak-llm
BIN=/usr/local/bin/llama-server

echo "== build tools"
sudo dnf install -y -q git cmake gcc-c++ make >/dev/null

if [ ! -x "$BIN" ] || ! "$BIN" --version 2>&1 | grep -q "${LLAMA_TAG#v}"; then
  echo "== build llama.cpp ${LLAMA_TAG} (takes a while on 2 vCPUs)"
  sudo rm -rf "$SRC"
  sudo git clone -q --depth 1 --branch "$LLAMA_TAG" https://github.com/ggml-org/llama.cpp "$SRC"
  sudo cmake -S "$SRC" -B "$SRC/build" -DCMAKE_BUILD_TYPE=Release -DLLAMA_CURL=OFF -DGGML_NATIVE=ON \
    -DLLAMA_BUILD_TESTS=OFF -DLLAMA_BUILD_EXAMPLES=OFF -DLLAMA_BUILD_HTML=OFF \
    -DLLAMA_BUILD_UI=OFF -DLLAMA_USE_PREBUILT_UI=OFF >/dev/null
  sudo cmake --build "$SRC/build" --target llama-server -j 2 >/dev/null
  sudo install -m 0755 "$SRC/build/bin/llama-server" "$BIN"
fi
"$BIN" --version 2>&1 | head -2

echo "== model"
id gullak-llm >/dev/null 2>&1 || sudo useradd --system --home "$MODELS" --shell /sbin/nologin gullak-llm
sudo mkdir -p "$MODELS"
MODEL="$MODELS/qwen3-0.6b-q4_k_m.gguf"
if [ ! -f "$MODEL" ] || ! echo "$MODEL_SHA256  $MODEL" | sha256sum -c --status -; then
  sudo curl -fsSL -o "$MODEL.part" "$MODEL_URL"
  echo "$MODEL_SHA256  $MODEL.part" | sha256sum -c -
  sudo mv "$MODEL.part" "$MODEL"
fi
sudo chown -R gullak-llm:gullak-llm "$MODELS"

echo "== service"
sudo mkdir -p /etc/gullak
if [ -n "${LLM_KEY:-}" ]; then
  echo "LLM_KEY=${LLM_KEY}" | sudo tee /etc/gullak/llm.env >/dev/null
  sudo chmod 600 /etc/gullak/llm.env
fi
test -f /etc/gullak/llm.env

# Small context (one SMS + the category list), one slot, prompt cache so the fixed instructions
# are only processed once. mlock off: the box relies on swap if memory gets tight.
sudo tee /etc/systemd/system/gullak-llm.service >/dev/null <<EOF
[Unit]
Description=Gullak category model (llama-server, Qwen3 0.6B)
After=network-online.target

[Service]
User=gullak-llm
Group=gullak-llm
EnvironmentFile=/etc/gullak/llm.env
ExecStart=${BIN} -m ${MODEL} --host 127.0.0.1 --port 8090 --api-key \${LLM_KEY} \\
  -c 2048 -np 1 -t 2 --cache-reuse 256 --no-webui --log-disable
Restart=always
RestartSec=3
MemoryMax=650M
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now gullak-llm >/dev/null 2>&1
sudo systemctl restart gullak-llm
for i in $(seq 1 30); do
  curl -fsS -o /dev/null http://127.0.0.1:8090/health && break
  sleep 2
done
curl -fsS http://127.0.0.1:8090/health && echo
systemctl is-active gullak-llm
