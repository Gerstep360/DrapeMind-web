#!/usr/bin/env bash
# Angular: Node privado, build reproducible y publicación atómica.
set -euo pipefail
umask 022
WEB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="/opt/drapemind/node/current/bin:$PATH"
DRAPE_PREFIX="${DRAPE_PREFIX:-/DrapeMind}"
PUBLIC_ROOT="${DRAPEMIND_WEB_ROOT:-/var/www/drapemind}"
manager() {
    local parent candidate
    parent="$(dirname "$WEB_DIR")"
    for candidate in "$parent/backend/scripts/deploy/platform.sh" "$parent/DrapeMind-Backend/scripts/deploy/platform.sh"; do
        if [[ -f "$candidate" ]]; then exec bash "$candidate" "$@"; fi
    done
    printf 'Prepara ambos repositorios con python3 instalar_vps.py antes de configurar servicios.\n' >&2
    exit 1
}
feedback() {
    [[ -z "${DRAPE_PROGRESS_FILE:-}" ]] || { printf '%s:?:%s\n' "$1" "$2" >"$DRAPE_PROGRESS_FILE.next"; mv -f "$DRAPE_PROGRESS_FILE.next" "$DRAPE_PROGRESS_FILE"; }
}
build() {
    [[ $EUID -eq 0 ]] || { printf 'Usa sudo para publicar en /var/www.\n' >&2; return 1; }
    [[ "$DRAPE_PREFIX" =~ ^/[a-zA-Z0-9_-]+$ ]] || return 2
    [[ "$PUBLIC_ROOT" == /*/drapemind && "$PUBLIC_ROOT" != *'/../'* ]] || return 2
    command -v node >/dev/null && command -v npm >/dev/null || { printf 'Prepara Node con el gestor principal.\n' >&2; return 1; }
    cd "$WEB_DIR"
    feedback npm 'Instalando las dependencias exactas de package-lock.json'
    # npm valida el engine real de Angular; nunca se modifica node_modules para saltarlo.
    npm ci --no-audit --no-fund --engine-strict
    feedback Angular 'Compilando la aplicación para producción'
    npm exec -- ng build --configuration production --base-href "$DRAPE_PREFIX/"
    feedback PWA 'Preparando catálogo sin conexión y versión del shell'
    printf '{"backendUrl":"","apiPrefix":"%s/api/v1"}\n' "$DRAPE_PREFIX" > dist/web/browser/config.json
    node scripts/offline-manifest.mjs
    feedback Web 'Preparando la nueva versión; se conserva la publicada hasta terminar'
    [[ -f dist/web/browser/index.html ]] || return 1
    local release temporary previous=''
    release="$PUBLIC_ROOT/releases/$(date -u +%Y%m%dT%H%M%S)-$$"
    install -d -m 755 "$PUBLIC_ROOT" "$PUBLIC_ROOT/releases" "$release"
    cp -a dist/web/browser/. "$release/"
    printf '{"backendUrl":"","apiPrefix":"%s/api/v1"}\n' "$DRAPE_PREFIX" > "$release/config.json"
    find "$release" -type d -exec chmod 755 {} +
    find "$release" -type f -exec chmod 644 {} +
    if [[ -e "$PUBLIC_ROOT/current" && ! -L "$PUBLIC_ROOT/current" ]]; then
        printf '%s/current debe ser un enlace; se conserva el directorio existente.\n' "$PUBLIC_ROOT" >&2; return 1
    fi
    [[ ! -L "$PUBLIC_ROOT/current" ]] || previous=$(readlink "$PUBLIC_ROOT/current")
    if [[ -n "$previous" ]]; then ln -sfn "$previous" "$PUBLIC_ROOT/previous"; fi
    temporary="$PUBLIC_ROOT/.current-$$"
    ln -s "$release" "$temporary"
    mv -Tf "$temporary" "$PUBLIC_ROOT/current"
    printf 'Web publicada: %s/current (versión anterior conservada).\n' "$PUBLIC_ROOT"
}
case "${1:---menu}" in
 --help|-h) printf '%s\n' '--all / --menu: gestor completo' '--update: actualizar ambos repositorios de forma segura' '--build: compilar y publicar checkout actual' '--nginx: integrar proxy sin reemplazar sitios' '--check: estado de servicios y HTTPS';;
 --build) build;;
 --nginx) manager --nginx;;
 --check) manager --check;;
 --update) manager --update;;
 --all|--menu) manager --frontend;;
 *) printf 'Opción inválida; consulta --help.\n' >&2; exit 2;;
esac
