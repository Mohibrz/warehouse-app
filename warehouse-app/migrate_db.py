"""سكريبت لترقية قاعدة البيانات"""
import sqlite3
import os

def migrate_database():
    db_path = os.path.join(os.path.dirname(__file__), "warehouse.db")

    if not os.path.exists(db_path):
        print("Database not found. Will be created on server start.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Check users table columns
    cursor.execute("PRAGMA table_info(users)")
    user_columns = [col[1] for col in cursor.fetchall()]
    print("Users table columns:", user_columns)

    # Add created_at if missing
    if 'created_at' not in user_columns:
        print("Adding created_at column to users...")
        cursor.execute("ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
        conn.commit()
        print("OK!")

    # Check notifications table
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='notifications'")
    if not cursor.fetchone():
        print("Creating notifications table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type VARCHAR NOT NULL,
                title VARCHAR NOT NULL,
                message VARCHAR NOT NULL,
                item_id INTEGER,
                warehouse_id INTEGER,
                is_read INTEGER DEFAULT 0,
                is_dismissed INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                read_at TIMESTAMP,
                dismissed_at TIMESTAMP,
                FOREIGN KEY (item_id) REFERENCES items(id),
                FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
            )
        """)
        conn.commit()
        print("OK!")

    # Check transactions table
    cursor.execute("PRAGMA table_info(transactions)")
    tx_columns = [col[1] for col in cursor.fetchall()]
    print("Transactions table columns:", tx_columns)

    if 'previous_quantity' not in tx_columns:
        print("Adding previous_quantity to transactions...")
        cursor.execute("ALTER TABLE transactions ADD COLUMN previous_quantity FLOAT")
        conn.commit()
        print("OK!")

    # Check items table
    cursor.execute("PRAGMA table_info(items)")
    item_columns = [col[1] for col in cursor.fetchall()]
    print("Items table columns:", item_columns)

    # Verify final state
    cursor.execute("PRAGMA table_info(users)")
    print("\nFinal users table:", [col[1] for col in cursor.fetchall()])
    cursor.execute("PRAGMA table_info(notifications)")
    print("Final notifications table:", [col[1] for col in cursor.fetchall()])

    conn.close()
    print("\nMigration completed successfully!")

if __name__ == "__main__":
    migrate_database()
