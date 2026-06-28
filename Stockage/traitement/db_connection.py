import os
from sqlalchemy import create_engine, text
from pymongo import MongoClient


def get_postgres_engine():
    user = os.getenv("POSTGRES_USER", "admin")
    password = os.getenv("POSTGRES_PASSWORD", "admin")
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    db = os.getenv("POSTGRES_DB", "urban_db")
    return create_engine(
        f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{db}"
    )


def get_mongo_client():
    host = os.getenv("MONGO_HOST", "localhost")
    port = int(os.getenv("MONGO_PORT", "27017"))
    return MongoClient(host, port)


def create_bronze_schema(engine):
    with engine.connect() as conn:
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS bronze;"))
        conn.commit()


def create_silver_schema(engine):
    with engine.connect() as conn:
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS silver;"))
        conn.commit()


def create_gold_schema(engine):
    with engine.connect() as conn:
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS gold;"))
        conn.commit()


def load_table(df, engine, schema, table_name, chunksize=10000):
    """Charge un DataFrame en remplaçant proprement la table (sans accumulation de doublons)."""
    with engine.connect() as conn:
        conn.execute(text(f'DROP TABLE IF EXISTS "{schema}"."{table_name}"'))
        conn.commit()
    df.to_sql(
        table_name,
        engine,
        schema=schema,
        if_exists="replace",
        index=False,
        chunksize=chunksize,
        method="multi",
    )
    print(f"Table {schema}.{table_name} chargée avec {len(df)} lignes.")
