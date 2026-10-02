#!/bin/sh
# Runs LatestArr as the unprivileged "node" user. Started as root (the
# default), it first hands /app/data to that user, so a volume created by
# an older image (which ran everything as root) keeps working. A separate
# BACKUP_PATH mount gets the same, as far as its filesystem allows (a NAS
# share may not let root change owners; LatestArr then says so when a
# backup can't be written).
set -e

if [ "$(id -u)" = "0" ]; then
  mkdir -p /app/data
  chown -R node:node /app/data
  if [ -n "$BACKUP_PATH" ]; then
    mkdir -p "$BACKUP_PATH" && chown node:node "$BACKUP_PATH" \
      || echo "latestarr: couldn't give the node user $BACKUP_PATH; make sure it can write there" >&2
  fi
  exec su-exec node "$@"
fi

exec "$@"
