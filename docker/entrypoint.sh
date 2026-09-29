#!/bin/sh
# Runs LatestArr as the unprivileged "node" user. Started as root (the
# default), it first hands /app/data to that user, so a volume created by
# an older image (which ran everything as root) keeps working.
set -e

if [ "$(id -u)" = "0" ]; then
  mkdir -p /app/data
  chown -R node:node /app/data
  exec su-exec node "$@"
fi

exec "$@"
