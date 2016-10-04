#!/bin/sh

FILENAME=$(basename "$0")
LOCATION="$(cd "$(dirname "$0")" && pwd)"

exec >> ${LOCATION}/../logs/${FILENAME%.*}.log
exec 2>&1

cd ${LOCATION}/.. && node app.js --run download-quotes
