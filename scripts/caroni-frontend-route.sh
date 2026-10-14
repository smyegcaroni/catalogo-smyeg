#!/usr/bin/env bash
set -euo pipefail

config=/opt/nginx-proxy-manager/data/nginx/proxy_host/3.conf
database=/opt/nginx-proxy-manager/data/database.sqlite
backup_dir=/opt/geolens-backups/20261003T1501Z-pre-frontend-prod
proxy_container=nginx-proxy-manager-app-1

case "${1:-}" in
  prod)
    old_host=frontend
    old_port=5173
    new_host=caroni-frontend-prod
    new_port=8080
    test "$(docker inspect geolens-caroni-frontend-prod --format '{{.State.Health.Status}}')" = healthy
    ;;
  dev)
    old_host=caroni-frontend-prod
    old_port=8080
    new_host=frontend
    new_port=5173
    test "$(docker inspect geolens-frontend-1 --format '{{.State.Health.Status}}')" = healthy
    ;;
  *)
    echo 'Uso: caroni-frontend-route.sh prod|dev' >&2
    exit 2
    ;;
esac

old_server_line="  set \$server         \"${old_host}\";"
old_port_line="  set \$port           ${old_port};"
new_server_line="  set \$server         \"${new_host}\";"
new_port_line="  set \$port           ${new_port};"
test "$(grep -Fxc "$old_server_line" "$config")" -eq 1
test "$(grep -Fxc "$old_port_line" "$config")" -eq 1

update_database() {
  python3 - "$database" "$1" "$2" "$3" "$4" <<'PY'
import sqlite3
import sys

database, old_host, old_port, new_host, new_port = sys.argv[1:]
with sqlite3.connect(database, timeout=10) as db:
    db.execute('BEGIN IMMEDIATE')
    result = db.execute(
        'UPDATE proxy_host SET forward_host=?, forward_port=? '
        'WHERE id=3 AND domain_names=? AND forward_host=? AND forward_port=? AND enabled=1',
        (new_host, int(new_port), '["catalogo.caroni.org.ve"]', old_host, int(old_port)),
    )
    if result.rowcount != 1:
        raise RuntimeError('El destino registrado del catálogo cambió; no se modificó el proxy')
PY
}

backup_copy="$(mktemp "${backup_dir}/proxy-host-3-before-${1}-XXXXXX.conf")"
cp -a "$config" "$backup_copy"

if [ "$1" = prod ]; then
  sed -i 's/^  set \$server         "frontend";$/  set $server         "caroni-frontend-prod";/' "$config"
  sed -i 's/^  set \$port           5173;$/  set $port           8080;/' "$config"
else
  sed -i 's/^  set \$server         "caroni-frontend-prod";$/  set $server         "frontend";/' "$config"
  sed -i 's/^  set \$port           8080;$/  set $port           5173;/' "$config"
fi

if ! grep -Fxq "$new_server_line" "$config" ||
   ! grep -Fxq "$new_port_line" "$config" ||
   ! docker exec "$proxy_container" nginx -t; then
  cp -a "$backup_copy" "$config"
  exit 1
fi

if ! update_database "$old_host" "$old_port" "$new_host" "$new_port"; then
  cp -a "$backup_copy" "$config"
  exit 1
fi

if ! docker exec "$proxy_container" nginx -s reload; then
  update_database "$new_host" "$new_port" "$old_host" "$old_port" || true
  cp -a "$backup_copy" "$config"
  docker exec "$proxy_container" nginx -s reload || true
  exit 1
fi

printf 'Destino activo: %s:%s\nRespaldo: %s\n' "$new_host" "$new_port" "$backup_copy"
