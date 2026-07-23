"""CLI para enfileirar um job ARQ manualmente (seed/backfill sob demanda).

Uso (dentro do container da api/worker, com Redis acessível):
    python -m app.workers.enqueue <job_name> [arg1 arg2 ...]

Exemplos:
    python -m app.workers.enqueue backfill_all_active 2   # seed inicial (2 temporadas)
    python -m app.workers.enqueue sync_warehouse          # sync incremental agora
    python -m app.workers.enqueue backfill_player "LeBron James" 1

O job é processado pelo worker ARQ em execução (este script só enfileira).
Args puramente numéricos são convertidos para int.
"""

from __future__ import annotations

import asyncio
import sys

from app.core.arq import close_arq_pool, init_arq_pool


def _coerce(arg: str) -> str | int:
    return int(arg) if arg.lstrip("-").isdigit() else arg


async def _main(job: str, args: list[str]) -> int:
    pool = await init_arq_pool()
    try:
        job_obj = await pool.enqueue_job(job, *[_coerce(a) for a in args])
        job_id = job_obj.job_id if job_obj is not None else None
        print(f"enqueued {job}({', '.join(args)}) -> job_id={job_id}")
        return 0 if job_obj is not None else 1
    finally:
        await close_arq_pool()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    sys.exit(asyncio.run(_main(sys.argv[1], sys.argv[2:])))
