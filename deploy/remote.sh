#!/usr/bin/env bash
# Deploy on the server itself: pull main and rebuild the containers.
# GitHub Actions calls it on every push to main and on a manual workflow run.
# For the key from Actions this is the only allowed command (command= in authorized_keys).
set -euo pipefail

# The body is in a block: bash reads it in full before git pull replaces this file.
{
	cd /srv/codenames

	# Two pushes in a row must not build compose at the same time: the second waits for the first.
	exec 9>/tmp/codenames-deploy.lock
	flock 9

	git pull --ff-only --quiet
	git log -1 --oneline
	docker compose -f deploy/docker-compose.yml up -d --build --quiet-pull
	docker image prune -f >/dev/null
	exit
}
