#!/usr/bin/env bash
# Runs ON the EC2 instance (Amazon Linux 2023) as ec2-user with sudo. Idempotent: safe to re-run.
#
# The data lives in Supabase. This box only:
#   - serves the exported web app (dist/) over HTTPS with Caddy, and
#   - forwards /ingest/<capture key> (what the iOS Shortcuts post to) to Supabase's ingest function,
#     so capture addresses keep working whatever the backend is.
#
# Nothing else runs here: no Node, no database. The previous release stays in /opt/gullak.old for a rollback.
set -euo pipefail

DOMAIN="${DOMAIN:?set DOMAIN}"
SUPABASE_HOST="${SUPABASE_HOST:-rupjxysgksruhhlokbvx.supabase.co}"
CADDY_VERSION="2.11.9"
APP=/opt/gullak

echo "== caddy ${CADDY_VERSION}"
if ! command -v caddy >/dev/null || ! caddy version | grep -q "v${CADDY_VERSION}"; then
  tmp="$(mktemp -d)"
  base="https://github.com/caddyserver/caddy/releases/download/v${CADDY_VERSION}"
  curl -fsSL -o "$tmp/caddy.tgz" "$base/caddy_${CADDY_VERSION}_linux_amd64.tar.gz"
  curl -fsSL -o "$tmp/checksums.txt" "$base/caddy_${CADDY_VERSION}_checksums.txt"
  (cd "$tmp" && grep "caddy_${CADDY_VERSION}_linux_amd64.tar.gz" checksums.txt | sed 's/  .*$/  caddy.tgz/' | sha512sum -c -)
  tar -xzf "$tmp/caddy.tgz" -C "$tmp" caddy
  sudo install -m 0755 "$tmp/caddy" /usr/local/bin/caddy
  rm -rf "$tmp"
fi
id caddy >/dev/null 2>&1 || sudo useradd --system --home /var/lib/caddy --create-home --shell /sbin/nologin caddy

echo "== unpack release"
test -f /tmp/gullak-release.tgz
sudo rm -rf "$APP.new" && sudo mkdir -p "$APP.new"
sudo tar -xzf /tmp/gullak-release.tgz -C "$APP.new"
sudo rm -rf "$APP.old" && { [ -d "$APP" ] && sudo mv "$APP" "$APP.old" || true; }
sudo mv "$APP.new" "$APP"
sudo chown -R root:root "$APP"
sudo chmod -R a+rX "$APP/dist"


REDIRECTS=""
for old in ${OLD_DOMAINS:-}; do
  REDIRECTS+="${old} {
	redir https://${DOMAIN}{uri} permanent
}

"
done

sudo mkdir -p /etc/caddy
sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
${REDIRECTS}${DOMAIN} {
	encode zstd gzip
	header Strict-Transport-Security "max-age=31536000"

	# iOS Shortcuts post bank SMS here: /ingest/<capture key>
	@ingest path /ingest /ingest/*
	handle @ingest {
		rewrite * /functions/v1{path}
		reverse_proxy https://${SUPABASE_HOST} {
			header_up Host {upstream_hostport}
		}
	}

	handle {
		root * ${APP}/dist
		# Hashed bundles never change; HTML, the manifest and the service worker must always be fresh.
		@hashed path /_expo/static/* /assets/*
		@fresh not path /_expo/static/* /assets/*
		header @hashed Cache-Control "public, max-age=31536000, immutable"
		header @fresh Cache-Control "no-cache"
		# Expo's static export writes one HTML file per route: /setup -> setup.html
		try_files {path} {path}.html {path}/index.html
		file_server
	}

	handle_errors 404 {
		root * ${APP}/dist
		rewrite * /+not-found.html
		file_server
	}

	log {
		output file /var/log/caddy/access.log {
			roll_size 10MiB
			roll_keep 3
		}
	}
}
EOF
sudo mkdir -p /var/log/caddy && sudo chown caddy:caddy /var/log/caddy
sudo tee /etc/systemd/system/caddy.service >/dev/null <<'EOF'
[Unit]
Description=Caddy (HTTPS for gullak)
After=network-online.target
Wants=network-online.target

[Service]
Type=notify
User=caddy
Group=caddy
ExecStart=/usr/local/bin/caddy run --environ --config /etc/caddy/Caddyfile
ExecReload=/usr/local/bin/caddy reload --config /etc/caddy/Caddyfile --force
TimeoutStopSec=5s
LimitNOFILE=1048576
AmbientCapabilities=CAP_NET_BIND_SERVICE
PrivateTmp=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
EOF
sudo -u caddy /usr/local/bin/caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1 ||
  { sudo -u caddy /usr/local/bin/caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile; exit 1; }

echo "== services"
sudo systemctl daemon-reload
sudo systemctl enable caddy >/dev/null 2>&1
sudo systemctl reload caddy 2>/dev/null || sudo systemctl restart caddy
sleep 2
curl -fsS -o /dev/null -w "site %{http_code}\n" "https://${DOMAIN}/" --resolve "${DOMAIN}:443:127.0.0.1"
systemctl is-active caddy
rm -f /tmp/gullak-release.tgz /tmp/gullak-setup.sh
