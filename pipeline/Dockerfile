# syntax=docker/dockerfile:1
FROM python:3.13-slim

# cron for the weekly ingest job
RUN apt-get update \
    && apt-get install -y --no-install-recommends cron \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml ./
COPY fantasynfl ./fantasynfl
RUN pip install --no-cache-dir .

# Weekly cron: Mondays 06:00 -> refresh the league DB from ESPN.
COPY deploy/crontab /etc/fantasynfl.cron
RUN crontab /etc/fantasynfl.cron \
    && touch /var/log/fantasynfl.log

COPY deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# DB lives on a shared volume (see docker-compose).
ENV DB_PATH=/data/fantasynfl.db

ENTRYPOINT ["/entrypoint.sh"]
