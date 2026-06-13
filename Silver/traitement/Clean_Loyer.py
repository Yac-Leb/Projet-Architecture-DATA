import sys
import os
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../Stockage/traitement"))

import pandas as pd
from db_connection import get_postgres_engine, create_silver_schema

engine = get_postgres_engine()
create_silver_schema(engine)

df = pd.read_sql("SELECT * FROM bronze.loyers_raw", engine)

# Nettoyer les colonnes numériques (virgule → point)
cols_num = [c for c in df.columns if "loyer" in c.lower() or "prix" in c.lower()]
for col in cols_num:
    df[col] = pd.to_numeric(
        df[col].astype(str).str.replace(",", ".").str.strip(), errors="coerce"
    )

df = df.dropna(how="all")

df.to_sql("loyers", engine, schema="silver", if_exists="replace", index=False, chunksize=10000, method="multi")
print(f"silver.loyers chargée avec {len(df)} lignes.")
