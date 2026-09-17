"""
Migrates an existing torque.db (or any SQLite file created by an
earlier version of this app) to the relationship-protocol
many-to-many model.

Safe to run multiple times — every step checks whether it's already
been applied before doing anything. Back up the file first if you
want to be extra careful, as usual for any migration.

Usage:
    python scripts/migrate_relationship_protocols.py [path/to/torque.db]

If no path is given, defaults to ./torque.db (the same default
DATABASE_URL uses).

What it does, in order:
  1. Create relationship_protocols if it doesn't exist yet.
  2. Backfill relationship_protocols from relationships.protocol_id,
     for every relationship that has a non-null protocol_id.
  3. Drop relationships.protocol_id — via native DROP COLUMN if the
     installed SQLite version supports it (>= 3.35.0), otherwise via
     the classic create-copy-drop-rename table rebuild.

Only touches the `relationships` table's schema and adds one new
table — nodes, graphs, protocols, and executions are untouched.
"""

import sqlite3
import sys


def column_exists(conn: sqlite3.Connection, table: str, column: str) -> bool:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return any(row[1] == column for row in rows)


def table_exists(conn: sqlite3.Connection, table: str) -> bool:
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table,),
    ).fetchone()
    return row is not None


def supports_drop_column() -> bool:
    major, minor, *_ = (int(p) for p in sqlite3.sqlite_version.split("."))
    return (major, minor) >= (3, 35)


def run(db_path: str) -> None:
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = OFF")  # off during the migration itself

    try:
        if not table_exists(conn, "relationships"):
            print(
                f"No 'relationships' table found in {db_path} — "
                "nothing to migrate (a fresh database will get the "
                "new schema automatically from create_all())."
            )
            return

        # ---- Step 1: association table ----
        if not table_exists(conn, "relationship_protocols"):
            print("Creating relationship_protocols table...")
            conn.execute(
                """
                CREATE TABLE relationship_protocols (
                    relationship_id VARCHAR(36) NOT NULL,
                    protocol_id     VARCHAR(36) NOT NULL,
                    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (relationship_id, protocol_id),
                    FOREIGN KEY (relationship_id) REFERENCES relationships(id) ON DELETE CASCADE,
                    FOREIGN KEY (protocol_id)     REFERENCES protocols(id)     ON DELETE CASCADE
                )
                """
            )
            conn.commit()
        else:
            print("relationship_protocols already exists, skipping create.")

        # ---- Step 2: backfill ----
        if column_exists(conn, "relationships", "protocol_id"):
            print("Backfilling relationship_protocols from protocol_id...")
            cursor = conn.execute(
                """
                INSERT OR IGNORE INTO relationship_protocols
                    (relationship_id, protocol_id)
                SELECT id, protocol_id
                FROM relationships
                WHERE protocol_id IS NOT NULL
                """
            )
            conn.commit()
            print(f"  backfilled {cursor.rowcount} attachment(s).")
        else:
            print(
                "relationships.protocol_id already gone — "
                "skipping backfill (assumed already migrated)."
            )

        # ---- Step 3: drop the old column ----
        if column_exists(conn, "relationships", "protocol_id"):
            if supports_drop_column():
                print(
                    f"SQLite {sqlite3.sqlite_version} supports DROP COLUMN, "
                    "dropping relationships.protocol_id directly..."
                )
                conn.execute("ALTER TABLE relationships DROP COLUMN protocol_id")
            else:
                print(
                    f"SQLite {sqlite3.sqlite_version} predates 3.35.0, "
                    "rebuilding relationships table without protocol_id..."
                )
                conn.executescript(
                    """
                    CREATE TABLE relationships_new (
                        id                 VARCHAR(36) PRIMARY KEY,
                        graph_id           VARCHAR(36) NOT NULL REFERENCES graphs(id) ON DELETE CASCADE,
                        source_node_id     VARCHAR(36) NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
                        target_node_id     VARCHAR(36) NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
                        relationship_type  VARCHAR(100) NOT NULL,
                        direction          VARCHAR(20) NOT NULL,
                        context            JSON,
                        reliance           JSON,
                        created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );
                    INSERT INTO relationships_new
                        (id, graph_id, source_node_id, target_node_id,
                         relationship_type, direction, context, reliance, created_at)
                    SELECT id, graph_id, source_node_id, target_node_id,
                           relationship_type, direction, context, reliance, created_at
                    FROM relationships;
                    DROP TABLE relationships;
                    ALTER TABLE relationships_new RENAME TO relationships;
                    """
                )
            conn.commit()
        else:
            print("relationships.protocol_id already absent, skipping drop.")

        print("Migration complete.")

    finally:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.close()


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "torque.db"
    run(path)
