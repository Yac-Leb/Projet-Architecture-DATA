import sys
import os
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../Stockage/traitement"))

import pandas as pd
from db_connection import get_postgres_engine, create_silver_schema

engine = get_postgres_engine()
create_silver_schema(engine)

df = pd.read_sql("SELECT * FROM bronze.logements_sociaux_raw", engine)

# Nettoyer les colonnes numériques
cols_num = [c for c in df.columns if df[c].dtype == object]
for col in cols_num:
    converted = pd.to_numeric(
        df[col].astype(str).str.replace(",", ".").str.strip(), errors="coerce"
    )
    if converted.notna().sum() > len(df) * 0.5:
        df[col] = converted

df = df.dropna(how="all")

df.to_sql("logements_sociaux", engine, schema="silver", if_exists="replace", index=False, chunksize=10000, method="multi")
print(f"silver.logements_sociaux chargée avec {len(df)} lignes.")
