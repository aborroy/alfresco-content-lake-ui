#!/bin/bash
# ---------------------------------------------------------------
# Replaces the ecmHost placeholder in app.config.json with the
# value of APP_CONFIG_ECM_HOST at container startup.
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
fi
