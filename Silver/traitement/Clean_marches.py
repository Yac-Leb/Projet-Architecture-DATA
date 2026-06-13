import sys
import os
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../Stockage/traitement"))

import pandas as pd
from db_connection import get_postgres_engine, create_silver_schema

engine = get_postgres_engine()
create_silver_schema(engine)

df = pd.read_sql("SELECT * FROM bronze.marches_raw", engine)

# Colonne arrondissement : 'ardt' dans ce dataset
ardt_col = next((c for c in df.columns if "ardt" in c.lower() or "arrondissement" in c.lower()), None)

if ardt_col:
    df["code_arrondissement"] = pd.to_numeric(
        df[ardt_col].astype(str).str.extract(r"(\d{1,2})")[0], errors="coerce"
    ).astype("Int64")

    # Compter les jours de tenue par marché si disponible
    jours_col = next((c for c in df.columns if "jour" in c.lower()), None)
    if jours_col:
        df["nb_jours_semaine"] = df[jours_col].astype(str).str.split(",").apply(
            lambda x: len([j for j in x if j.strip()])
        )

df.to_sql("marches", engine, schema="silver", if_exists="replace", index=False, chunksize=5000, method="multi")
print(f"silver.marches chargée avec {len(df)} lignes.")
