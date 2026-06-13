import sys
import os
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../Stockage/traitement"))

import pandas as pd
from db_connection import get_postgres_engine, create_silver_schema

engine = get_postgres_engine()
create_silver_schema(engine)

df = pd.read_sql("SELECT * FROM bronze.revenus_raw", engine)

# Filtrer Paris (codes communes 75101–75120)
df = df[df["CODGEO"].astype(str).str.startswith("751")]

# Renommer les colonnes clés FiLoSoFi DISP
rename_map = {}
if "CODGEO" in df.columns:
    rename_map["CODGEO"] = "code_arrondissement"
if "LIBGEO" in df.columns:
    rename_map["LIBGEO"] = "nom_arrondissement"
if "Q219" in df.columns:
    rename_map["Q219"] = "revenu_median"
if "GI19" in df.columns:
    rename_map["GI19"] = "indice_gini"
if "TP6019" in df.columns:
    rename_map["TP6019"] = "taux_pauvrete"

df = df.rename(columns=rename_map)

df.to_sql("revenus", engine, schema="silver", if_exists="replace", index=False, chunksize=5000, method="multi")
print(f"silver.revenus chargée avec {len(df)} lignes.")
