#!/usr/bin/env bash
# =====================================================================
# DRAPEMIND - CONFIGURADOR Y ACTUALIZADOR RÁPIDO DE NGINX
# Configura WebSocket upgrade, subpath /DrapeMind/, proxy API y archivos estáticos
# =====================================================================

set -eo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

BACKEND_PORT=8045
WWW_TARGET="/var/www/drapemind/browser"

echo -e "${CYAN}${BOLD}[DRAPEMIND NGINX] Iniciando configuración de Nginx...${NC}"

if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}[ERROR] Este script requiere privilegios de root (sudo).${NC}"
    exit 1
fi

mkdir -p /etc/nginx/conf.d /etc/nginx/snippets /var/www/drapemind/browser

# 1. Configurar soporte global para WebSockets y tamaño máximo de carga (64M)
echo -e "${CYAN}[1/4] Configurando /etc/nginx/conf.d/websocket_upgrade.conf y upload_size...${NC}"
cat <<'EOF_WS' > /etc/nginx/conf.d/websocket_upgrade.conf
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}
EOF_WS

cat <<'EOF_BODY' > /etc/nginx/conf.d/drapemind_upload.conf
client_max_body_size 64M;
EOF_BODY

# 2. Configurar Snippet modular /DrapeMind
echo -e "${CYAN}[2/4] Configurando /etc/nginx/snippets/drapemind-subpath.conf...${NC}"
cat <<EOF > /etc/nginx/snippets/drapemind-subpath.conf
# =====================================================================
# DRAPEMIND - SNIPPET NGINX MODULAR (SUBPATH: /DrapeMind)
# =====================================================================

client_max_body_size 64M;

location = /DrapeMind {
    return 301 /DrapeMind/;
}

location /DrapeMind/api/ {
    proxy_pass http://127.0.0.1:${BACKEND_PORT}/api/;
    proxy_http_version 1.1;

    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header X-Forwarded-Prefix /DrapeMind;

    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$connection_upgrade;

    proxy_read_timeout 600s;
    proxy_send_timeout 600s;
    proxy_buffering off;
}

location /DrapeMind/static/ {
    proxy_pass http://127.0.0.1:${BACKEND_PORT}/DrapeMind/static/;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    expires 7d;
    add_header Cache-Control "public, no-transform";
}

location /static/ {
    proxy_pass http://127.0.0.1:${BACKEND_PORT}/DrapeMind/static/;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    expires 7d;
}

location /DrapeMind/health/ {
    proxy_pass http://127.0.0.1:${BACKEND_PORT}/health/;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
}

location /DrapeMind/docs {
    proxy_pass http://127.0.0.1:${BACKEND_PORT}/docs;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-Prefix /DrapeMind;
}

location /DrapeMind/redoc {
    proxy_pass http://127.0.0.1:${BACKEND_PORT}/redoc;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-Prefix /DrapeMind;
}

location = /DrapeMind/config.json {
    alias ${WWW_TARGET}/config.json;
    add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
}

location = /config.json {
    alias ${WWW_TARGET}/config.json;
    add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
}

location = /DrapeMind/favicon.ico {
    alias ${WWW_TARGET}/favicon.ico;
}

location = /favicon.ico {
    alias ${WWW_TARGET}/favicon.ico;
}

location /DrapeMind/ {
    alias ${WWW_TARGET}/;
    index index.html;
    try_files \$uri \$uri/ /DrapeMind/index.html;
}
EOF

# 3. Integrar en /etc/nginx/sites-available/default si aún no está incluido
echo -e "${CYAN}[3/4] Verificando inclusión en servidor Nginx...${NC}"
if [[ -f "/etc/nginx/sites-available/default" ]]; then
    if ! grep -q "drapemind-subpath.conf" /etc/nginx/sites-available/default; then
        sed -i '/server {/a \    include /etc/nginx/snippets/drapemind-subpath.conf;' /etc/nginx/sites-available/default
    fi
fi

# 4. Probar configuración y recargar Nginx
echo -e "${CYAN}[4/4] Verificando sintaxis y recargando Nginx...${NC}"
nginx -t
systemctl reload nginx
echo -e "${GREEN}${BOLD}[OK] Nginx configurado y recargado exitosamente.${NC}"
