import sys
import os
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../Stockage/traitement"))

import pandas as pd
from db_connection import get_postgres_engine, create_silver_schema

engine = get_postgres_engine()
create_silver_schema(engine)

tables = [
    "fontaines_raw",
    "ilots_fraicheur_equipements_raw",
    "ilots_fraicheur_espaces_verts_raw",
    "commerces_eau_raw", 
]

for table in tables:
    df = pd.read_sql(f"SELECT * FROM bronze.{table}", engine)

    if table == "commerces_eau_raw":
        cols_to_drop = [c for c in df.columns if "postal" in c.lower() or "commune" in c.lower()]
        df = df.drop(columns=cols_to_drop)

    silver_table = table.replace("_raw", "")
    df.to_sql(silver_table, engine, schema="silver", if_exists="replace", index=False, chunksize=5000, method="multi")
    print(f"silver.{silver_table} chargée avec {len(df)} lignes.")
