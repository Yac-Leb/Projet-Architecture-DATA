import os
import pandas as pd
from sqlalchemy import create_engine, text

# Connexion PostgreSQL Docker
DB_USER = "admin"
DB_PASSWORD = "admin"
DB_HOST = "postgres"
DB_PORT = "5432"
DB_NAME = "urban_db"

engine = create_engine(
    f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

project_root = os.path.dirname(
    os.path.dirname(
        os.path.dirname(__file__)
    )
)

silver_path = os.path.join(project_root, "Silver", "Data")

datasets = {
    "revenus": os.path.join(silver_path, "Revenus", "revenus_clean.csv"),
    "population": os.path.join(silver_path, "Population", "population_clean.csv"),
    "dvf_transactions": os.path.join(silver_path, "DVF", "dvf_paris_clean.csv"),
    "loyers": os.path.join(silver_path, "Loyer", "loyer_clean.csv"),
    "logements_sociaux": os.path.join(
        silver_path,
        "Logements_sociaux",
        "logements_sociaux_clean.csv"
    )
}

print("Connexion à PostgreSQL...")

with engine.connect() as conn:
    conn.execute(text("CREATE SCHEMA IF NOT EXISTS silver;"))
    conn.commit()

for table_name, file_path in datasets.items():
    print("\n" + "=" * 50)
    print(f"Chargement table : silver.{table_name}")
    print(f"Fichier : {file_path}")

    if not os.path.exists(file_path):
        print(f"Fichier introuvable : {file_path}")
        continue

    df = pd.read_csv(file_path)

    df.to_sql(
        table_name,
        engine,
        schema="silver",
        if_exists="replace",
        index=False,
        chunksize=10000,
        method="multi"
    )

    print(f"Table silver.{table_name} créée avec {len(df)} lignes.")

print("\nIngestion PostgreSQL terminée.")