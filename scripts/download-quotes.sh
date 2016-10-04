#!/bin/sh

FILENAME=$(basename "$0")
LOCATION="$(cd "$(dirname "$0")" && pwd)"
DATESTAMP=$(date +"%Y-%m-%d-%H-%M")

exec >> ${LOCATION}/../logs/${DATESTAMP}.log
exec 2>&1

cd ${LOCATION}/.. && node app.js --run download-quotes --count 10 --days 10
