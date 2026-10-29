#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> GeoAttend AI Setup"
echo

if ! command -v mysql >/dev/null 2>&1; then
  echo "MySQL client not found. Install MySQL or use Docker: docker compose up mysql -d"
  exit 1
fi

echo "Creating database (requires MySQL root access)..."
read -r -p "MySQL root password (leave empty if none): " MYSQL_ROOT_PASSWORD

if [ -n "$MYSQL_ROOT_PASSWORD" ]; then
  mysql -u root -p"$MYSQL_ROOT_PASSWORD" <<'SQL'
CREATE DATABASE IF NOT EXISTS geoattend;
CREATE USER IF NOT EXISTS 'geoattend'@'localhost' IDENTIFIED BY 'geoattend_secret';
GRANT ALL PRIVILEGES ON geoattend.* TO 'geoattend'@'localhost';
FLUSH PRIVILEGES;
SQL
else
  mysql -u root <<'SQL'
CREATE DATABASE IF NOT EXISTS geoattend;
CREATE USER IF NOT EXISTS 'geoattend'@'localhost' IDENTIFIED BY 'geoattend_secret';
GRANT ALL PRIVILEGES ON geoattend.* TO 'geoattend'@'localhost';
FLUSH PRIVILEGES;
SQL
fi

echo "Setting up backend..."
cd "$ROOT/backend"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp -n .env.example .env
alembic upgrade head
python scripts/seed.py

echo "Setting up web..."
cd "$ROOT/web"
npm install
cp -n .env.local.example .env.local

echo
echo "Setup complete!"
echo "Terminal 1: cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000"
echo "Terminal 2: cd web && npm run dev"
echo "Open http://localhost:3000"
