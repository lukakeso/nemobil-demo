#!/bin/sh
CONFIG_DIR="/usr/share/nginx/html/config"
mkdir -p "$CONFIG_DIR"

# cat <<EOF > /usr/share/nginx/html/config/env.js

cat <<EOF > "$CONFIG_DIR/env.js"
window._env_ = {
  VITE_API_URL: "${VITE_API_URL}"
};
EOF

# Start nginx in the foreground so container stays alive
nginx -g "daemon off;"