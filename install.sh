#!/usr/bin/env bash
# =====================================================================
# DRAPEMIND - INSTALADOR INDEPENDIENTE DE FRONTEND (ANGULAR & NGINX)
# Servidor IP: 157.173.102.129
# Prefijo: /DrapeMind/
# Proxy Backend API: 127.0.0.1:8045
# =====================================================================

set -eo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

SERVER_IP="157.173.102.129"
BACKEND_PORT=8045
WEB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WWW_TARGET="/var/www/drapemind/browser"

log_info() { echo -e "${CYAN}${BOLD}[FRONTEND INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}${BOLD}[FRONTEND OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}${BOLD}[FRONTEND AVISO]${NC} $1"; }
log_error() { echo -e "${RED}${BOLD}[FRONTEND ERROR]${NC} $1" >&2; }

banner() {
    clear 2>/dev/null || true
    echo -e "${CYAN}${BOLD}"
    echo "======================================================================"
    echo "       DRAPEMIND ATELIER - INSTALADOR INDEPENDIENTE DE FRONTEND"
    echo "======================================================================"
    echo -e "${NC}"
    echo -e " Directorio Frontend: ${BOLD}${WEB_DIR}${NC}"
    echo -e " Publicación Web:     ${BOLD}${WWW_TARGET}${NC}"
    echo -e " URL Pública:         ${BOLD}http://${SERVER_IP}/DrapeMind/${NC}"
    echo -e " Destino API Proxy:   ${BOLD}127.0.0.1:${BACKEND_PORT}${NC}"
    echo "======================================================================"
    echo ""
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "Se requieren privilegios de administrador (sudo) para escribir en /var/www y configurar Nginx."
        echo "Ejecuta: sudo bash install.sh"
        exit 1
    fi
}

install_dependencies() {
    log_info "Verificando Node.js, npm y Nginx..."
    export DEBIAN_FRONTEND=noninteractive

    if ! command -v nginx >/dev/null 2>&1; then
        log_info "Instalando Nginx..."
        apt-get update -qq
        apt-get install -y -qq nginx
        systemctl enable --now nginx
    fi

    if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
        log_info "Instalando Node.js LTS (v20)..."
        apt-get update -qq
        apt-get install -y -qq curl ca-certificates gnupg
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
        apt-get install -y -qq nodejs
    fi

    log_success "Node.js $(node -v 2>/dev/null || echo '') y Nginx listos."
}

build_and_deploy_angular() {
    log_info "Instalando dependencias de Angular (npm install)..."
    cd "${WEB_DIR}"

    npm install --silent

    log_info "Compilando Angular para producción con base-href /DrapeMind/..."
    npm run build:prod

    log_info "Desplegando en ${WWW_TARGET}..."
    mkdir -p "${WWW_TARGET}"
    rm -rf "${WWW_TARGET:?}"/*

    cp -r "${WEB_DIR}/dist/web/browser/"* "${WWW_TARGET}/"

    # Generar config.json de producción
    cat <<EOF > "${WWW_TARGET}/config.json"
{
  "backendUrl": "",
  "apiPrefix": "/DrapeMind/api/v1"
}
EOF

    # Crear enlace simbólico de seguridad para Nginx universal
    mkdir -p /var/www/html
    rm -rf /var/www/html/DrapeMind
    ln -sf "${WWW_TARGET}" /var/www/html/DrapeMind

    chown -R www-data:www-data /var/www/drapemind /var/www/html/DrapeMind 2>/dev/null || true
    chmod -R 755 "${WWW_TARGET}"

    log_success "Frontend Angular compilado y publicado en ${WWW_TARGET}."
}

configure_nginx() {
    log_info "Configurando Nginx con proxy /DrapeMind..."

    mkdir -p /etc/nginx/snippets

    # Crear snippet modular para /DrapeMind
    cat <<EOF > /etc/nginx/snippets/drapemind-subpath.conf
# =====================================================================
# DRAPEMIND - SNIPPET NGINX MODULAR (SUBPATH: /DrapeMind)
# =====================================================================

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
    proxy_set_header Connection "upgrade";

    proxy_read_timeout 600s;
    proxy_send_timeout 600s;
    proxy_buffering off;
}

location /DrapeMind/static/ {
    proxy_pass http://127.0.0.1:${BACKEND_PORT}/static/;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    expires 7d;
    add_header Cache-Control "public, no-transform";
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

location /DrapeMind/ {
    alias ${WWW_TARGET}/;
    index index.html;
    try_files \$uri \$uri/ /DrapeMind/index.html;
}
EOF

    # Integrar en default si existe
    if [[ -f "/etc/nginx/sites-available/default" ]]; then
        if ! grep -q "drapemind-subpath.conf" /etc/nginx/sites-available/default; then
            log_info "Incluyendo snippet en /etc/nginx/sites-available/default..."
            python3 -c "
with open('/etc/nginx/sites-available/default', 'r') as f:
    content = f.read()

snippet_line = '    include /etc/nginx/snippets/drapemind-subpath.conf;\n'
if snippet_line not in content:
    idx = content.rfind('}')
    if idx != -1:
        new_content = content[:idx] + snippet_line + content[idx:]
        with open('/etc/nginx/sites-available/default', 'w') as f:
            f.write(new_content)
" 2>/dev/null || sed -i '/server {/a \    include /etc/nginx/snippets/drapemind-subpath.conf;' /etc/nginx/sites-available/default
        fi
    else
        # Crear sitio completo si no hay default
        cat <<EOF > /etc/nginx/sites-available/drapemind.conf
map \$http_upgrade \$connection_upgrade {
    default upgrade;
    '' close;
}

server {
    listen 80;
    server_name ${SERVER_IP} localhost;
    client_max_body_size 64M;

    include /etc/nginx/snippets/drapemind-subpath.conf;
}
EOF
        ln -sf /etc/nginx/sites-available/drapemind.conf /etc/nginx/sites-enabled/drapemind.conf
    fi

    if nginx -t; then
        systemctl reload nginx
        log_success "Nginx configurado y recargado correctamente."
    else
        log_error "Error en la sintaxis de Nginx. Por favor revisa la configuración."
    fi
}

verify_frontend() {
    echo ""
    log_info "Verificando acceso a Frontend y Nginx..."
    sleep 1

    local STATUS
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1/DrapeMind/" || echo "000")

    echo ""
    echo "======================================================================"
    echo -e " ${GREEN}${BOLD}✓ FRONTEND DE DRAPEMIND INSTALADO Y EN SERVICIO${NC}"
    echo "======================================================================"
    echo -e " • URL Frontend:      ${CYAN}${BOLD}http://${SERVER_IP}/DrapeMind/${NC}"
    echo -e " • Config Runtime:    ${CYAN}${BOLD}http://${SERVER_IP}/DrapeMind/config.json${NC}"
    echo -e " • Proxy API:         ${CYAN}${BOLD}http://${SERVER_IP}/DrapeMind/api/ -> 127.0.0.1:${BACKEND_PORT}${NC}"
    echo -e " • WebSocket AI:      ${CYAN}${BOLD}ws://${SERVER_IP}/DrapeMind/api/v1/ws/ai${NC}"
    echo -e " • Archivos en disco: ${WWW_TARGET}"
    echo -e " • Código HTTP Local: ${BOLD}${STATUS}${NC}"
    echo "======================================================================"
    echo ""
}

show_help() {
    echo "Uso: sudo bash install.sh [OPCION]"
    echo ""
    echo "Opciones disponibles:"
    echo "  --all         Instalación completa (Node.js, npm, Angular build y Nginx)"
    echo "  --build       Solo compila Angular y copia a /var/www/drapemind/browser"
    echo "  --nginx       Solo configura Nginx y recarga el servicio"
    echo "  --check       Verifica conectividad y código HTTP"
    echo "  --help        Muestra esta ayuda"
    echo ""
}

# --- Ejecución ---
check_root

case "${1:-}" in
    --all)
        banner
        install_dependencies
        build_and_deploy_angular
        configure_nginx
        verify_frontend
        ;;
    --build)
        install_dependencies
        build_and_deploy_angular
        ;;
    --nginx)
        configure_nginx
        ;;
    --check)
        verify_frontend
        ;;
    --help|-h)
        show_help
        ;;
    *)
        banner
        echo "Selecciona una opción para el Frontend:"
        echo "  1) Instalación completa de Frontend (Angular build + Nginx)"
        echo "  2) Solo compilar Angular y desplegar en /var/www"
        echo "  3) Solo configurar Nginx (/DrapeMind)"
        echo "  4) Verificar estado de respuesta HTTP"
        echo "  5) Salir"
        echo ""
        read -rp "Opción [1-5]: " opt
        case $opt in
            1)
                install_dependencies
                build_and_deploy_angular
                configure_nginx
                verify_frontend
                ;;
            2)
                install_dependencies
                build_and_deploy_angular
                ;;
            3)
                configure_nginx
                ;;
            4)
                verify_frontend
                ;;
            5)
                exit 0
                ;;
            *)
                log_error "Opción no válida."
                exit 1
                ;;
        esac
        ;;
esac
