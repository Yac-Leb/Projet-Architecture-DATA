import sys
import os
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../Stockage/traitement"))

import pandas as pd
from db_connection import get_postgres_engine, create_silver_schema

engine = get_postgres_engine()
create_silver_schema(engine)

df = pd.read_sql("SELECT * FROM bronze.arrets_lignes_raw", engine)

# Filtrer Paris (les arrêts parisiens ont nom_commune = "Paris", code_insee 75056)
df = df[df["nom_commune"].astype(str).str.lower().str.startswith("paris")]

# Coordonnées en numérique (le découpage par arrondissement se fait en Gold via point-in-polygon)
df["stop_lat"] = pd.to_numeric(df["stop_lat"], errors="coerce")
df["stop_lon"] = pd.to_numeric(df["stop_lon"], errors="coerce")
df = df.dropna(subset=["stop_lat", "stop_lon"])

colonnes = ["stop_id", "stop_name", "route_long_name", "mode", "stop_lat", "stop_lon", "nom_commune", "code_insee"]
df = df[[c for c in colonnes if c in df.columns]]

df.to_sql("transport", engine, schema="silver", if_exists="replace", index=False, chunksize=10000, method="multi")
print(f"silver.transport chargée avec {len(df)} lignes.")
