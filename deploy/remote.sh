#!/usr/bin/env bash
# Выкладка на самом сервере: подтянуть main и пересобрать контейнеры.
# Её вызывают GitHub Actions на каждый пуш в main и при ручном запуске workflow.
# Для ключа из Actions это единственная разрешённая команда (command= в authorized_keys).
set -euo pipefail

# Тело в блоке: bash дочитает его целиком до того, как git pull подменит этот файл.
{
	cd /srv/__PROJECT__

	# Два пуша подряд не должны собирать compose одновременно: второй ждёт первого.
	exec 9>/tmp/__PROJECT__-deploy.lock
	flock 9

	git pull --ff-only --quiet
	git log -1 --oneline
	docker compose -f deploy/docker-compose.yml up -d --build --quiet-pull
	docker image prune -f >/dev/null
	exit
}
