from django.db import connection


with connection.cursor() as cur:
    cur.execute(
        """
        select
            pid,
            usename,
            state,
            wait_event_type,
            wait_event,
            now() - query_start as age,
            left(query, 220) as query
        from pg_stat_activity
        where datname = current_database()
          and query ilike '%accounts_user%'
        order by query_start nulls last
        """
    )
    rows = cur.fetchall()

print(f"activities={len(rows)}")
for row in rows:
    print(row)
