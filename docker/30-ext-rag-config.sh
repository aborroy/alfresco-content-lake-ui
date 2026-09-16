#!/bin/bash
# ---------------------------------------------------------------
# Applies runtime configuration to app.config.json at container
# startup:
#
#   APP_CONFIG_ECM_HOST  the ADF ecmHost placeholder
#   CONNECTORS_URL       the connector listing the status page reads
#
# This follows the same pattern used by the official
# alfresco-content-app Docker image.
# ---------------------------------------------------------------

APP_CONFIG="${APP_CONFIG_ECM_HOST:-http://localhost:8080}"
CONFIG_FILE="/usr/share/nginx/html/app.config.json"

if [ -f "$CONFIG_FILE" ]; then
  # Replace the ADF ecmHost placeholder with the actual URL
  sed -i "s|{protocol}//{hostname}{:port}|${APP_CONFIG}|g" "$CONFIG_FILE"
  echo "ext-rag: app.config.json updated with ECM host: ${APP_CONFIG}"

  # plugins.ragService.connectorsUrl is built as an empty string, and stays empty unless an operator
  # supplies one. It cannot default to a same-origin path: GET /api/connectors is published by an
  # ingester rather than by rag-service, and the deployment proxy does not forward it. Empty means the
  # status page omits its connector panel and issues no request.
  if [ -n "${CONNECTORS_URL}" ]; then
    sed -i "s|\"connectorsUrl\": \"\"|\"connectorsUrl\": \"${CONNECTORS_URL}\"|g" "$CONFIG_FILE"
    echo "ext-rag: app.config.json updated with connectors URL: ${CONNECTORS_URL}"
  fi
fi
