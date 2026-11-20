"""Usuwa flotę testową pytest (Test Machine / Test CAT / Test Fleet / @test.digvo.local)."""
import os
from sqlalchemy import create_engine, text

url = os.environ["DATABASE_URL"]
if url.startswith("postgres://"):
    url = url.replace("postgres://", "postgresql+psycopg://", 1)
elif url.startswith("postgresql://") and "+psycopg" not in url:
    url = url.replace("postgresql://", "postgresql+psycopg://", 1)

engine = create_engine(url)

with engine.begin() as conn:
    machines = conn.execute(
        text("""
            SELECT id, name FROM machines
            WHERE name ILIKE 'Test Machine%'
               OR name ILIKE 'Test CAT%'
               OR name ILIKE 'Test Schedule%'
        """)
    ).fetchall()
    print(f"Maszyny: {len(machines)}")
    for m in machines:
        print(" -", m.name)
    mids = [m.id for m in machines]

    test_users = conn.execute(
        text("SELECT id, email FROM users WHERE email LIKE '%@test.digvo.local'")
    ).fetchall()
    print(f"Userzy testowi: {len(test_users)}")
    uids = [u.id for u in test_users]

    test_orgs = conn.execute(
        text("SELECT id, name FROM organizations WHERE name ILIKE 'Test Fleet%'")
    ).fetchall()
    print(f"Orgi: {len(test_orgs)}")
    oids = [o.id for o in test_orgs]

    # 1) protokoły + bookingi powiązane z testowymi maszynami LUB testowymi klientami
    if mids or uids:
        conn.execute(
            text("""
                DELETE FROM handover_protocols
                WHERE booking_id IN (
                    SELECT id FROM bookings
                    WHERE (:has_m AND machine_id = ANY(:mids))
                       OR (:has_u AND client_id = ANY(:uids))
                       OR (:has_u AND operator_id = ANY(:uids))
                )
            """),
            {"mids": mids or None, "uids": uids or None, "has_m": bool(mids), "has_u": bool(uids)},
        )
        conn.execute(
            text("""
                DELETE FROM bookings
                WHERE (:has_m AND machine_id = ANY(:mids))
                   OR (:has_u AND client_id = ANY(:uids))
                   OR (:has_u AND operator_id = ANY(:uids))
            """),
            {"mids": mids or None, "uids": uids or None, "has_m": bool(mids), "has_u": bool(uids)},
        )

    if mids:
        conn.execute(
            text("DELETE FROM unavailability_blocks WHERE machine_id = ANY(:mids)"),
            {"mids": mids},
        )
        conn.execute(text("DELETE FROM machines WHERE id = ANY(:mids)"), {"mids": mids})

    # 2) operatorzy testowi (najpierw quals, potem profiles, potem users)
    if uids:
        conn.execute(
            text("DELETE FROM unavailability_blocks WHERE operator_id = ANY(:uids)"),
            {"uids": uids},
        )
        conn.execute(
            text("DELETE FROM operator_qualifications WHERE operator_id = ANY(:uids)"),
            {"uids": uids},
        )
        conn.execute(
            text("DELETE FROM operator_profiles WHERE user_id = ANY(:uids)"),
            {"uids": uids},
        )

    if oids:
        conn.execute(
            text("DELETE FROM transport_vehicles WHERE organization_id = ANY(:oids)"),
            {"oids": oids},
        )
        # profiles/users z org, gdyby coś zostało
        conn.execute(
            text("""
                DELETE FROM operator_qualifications
                WHERE operator_id IN (
                    SELECT user_id FROM operator_profiles WHERE organization_id = ANY(:oids)
                )
            """),
            {"oids": oids},
        )
        conn.execute(
            text("DELETE FROM operator_profiles WHERE organization_id = ANY(:oids)"),
            {"oids": oids},
        )

    if uids:
        conn.execute(text("DELETE FROM users WHERE id = ANY(:uids)"), {"uids": uids})

    if oids:
        conn.execute(
            text("DELETE FROM users WHERE organization_id = ANY(:oids)"),
            {"oids": oids},
        )
        conn.execute(text("DELETE FROM organizations WHERE id = ANY(:oids)"), {"oids": oids})

    left_m = conn.execute(
        text("""
            SELECT count(*) FROM machines
            WHERE name ILIKE 'Test Machine%'
               OR name ILIKE 'Test CAT%'
               OR name ILIKE 'Test Schedule%'
        """)
    ).scalar()
    left_u = conn.execute(
        text("SELECT count(*) FROM users WHERE email LIKE '%@test.digvo.local'")
    ).scalar()
    left_o = conn.execute(
        text("SELECT count(*) FROM organizations WHERE name ILIKE 'Test Fleet%'")
    ).scalar()
    print(f"Pozostało — maszyny:{left_m} userzy:{left_u} orgi:{left_o}")

print("OK")