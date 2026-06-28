import sys
import os
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../Stockage/traitement"))

import pandas as pd
from db_connection import get_postgres_engine, create_silver_schema

engine = get_postgres_engine()
create_silver_schema(engine)

df = pd.read_sql("SELECT * FROM bronze.population_raw", engine)

# Filtrer Paris (codes communes 75101–75120)
code_col = next((c for c in df.columns if "code" in c.lower() and "commune" in c.lower()), None)
if code_col:
    df = df[df[code_col].astype(str).str.startswith("751")]
    df = df.rename(columns={code_col: "code_arrondissement"})

df.to_sql("population", engine, schema="silver", if_exists="replace", index=False, chunksize=10000, method="multi")
print(f"silver.population chargée avec {len(df)} lignes.")
