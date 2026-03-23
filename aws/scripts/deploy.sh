#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"

if [ ! -f "${ROOT_DIR}/aws/scripts/secrets.env" ]; then
  echo "Missing aws/scripts/secrets.env"
  exit 1
fi

set -a
source "${ROOT_DIR}/aws/scripts/secrets.env"
set +a

kubectl create namespace sjt --dry-run=client -o yaml | kubectl apply -f -
kubectl -n sjt create secret generic sjt-secrets \
  --from-literal=POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
  --from-literal=ACCESS_TOKEN_SECRET="${ACCESS_TOKEN_SECRET}" \
  --from-literal=REFRESH_TOKEN_SECRET="${REFRESH_TOKEN_SECRET}" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl apply -f "${ROOT_DIR}/k8s/sjt.yaml"
kubectl rollout status deployment/api -n sjt --timeout=180s
kubectl rollout status deployment/web -n sjt --timeout=180s

install -m 644 "${ROOT_DIR}/aws/nginx/sjt.conf" /etc/nginx/sites-available/sjt.conf
ln -sf /etc/nginx/sites-available/sjt.conf /etc/nginx/sites-enabled/sjt.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
