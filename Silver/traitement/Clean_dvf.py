import sys
import os
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../Stockage/traitement"))

import pandas as pd
from db_connection import get_postgres_engine, create_silver_schema

engine = get_postgres_engine()
create_silver_schema(engine)

df = pd.read_sql("SELECT * FROM bronze.dvf_raw", engine)

# Garder uniquement les biens immobiliers
df = df[df["type_local"].isin(["Appartement", "Maison"])]

# Nettoyer valeur_fonciere (virgule → point)
df["valeur_fonciere"] = (
    df["valeur_fonciere"].astype(str).str.replace(",", ".").str.strip()
)
df["valeur_fonciere"] = pd.to_numeric(df["valeur_fonciere"], errors="coerce")
df["surface_reelle_bati"] = pd.to_numeric(df["surface_reelle_bati"], errors="coerce")

# Supprimer les lignes sans surface ni valeur
df = df.dropna(subset=["valeur_fonciere", "surface_reelle_bati"])
df = df[df["surface_reelle_bati"] > 0]

# Calcul prix/m²
df["prix_m2"] = df["valeur_fonciere"] / df["surface_reelle_bati"]

# Filtrer les valeurs aberrantes
df = df[(df["prix_m2"] >= 1000) & (df["prix_m2"] <= 50000)]

# code_commune = code arrondissement pour Paris (75101–75120)
colonnes = [
    "code_commune", "nom_commune", "type_local",
    "valeur_fonciere", "surface_reelle_bati", "nombre_pieces_principales",
    "prix_m2", "longitude", "latitude", "annee",
]
df = df[[c for c in colonnes if c in df.columns]]
df = df.rename(columns={"code_commune": "code_arrondissement"})

df.to_sql("dvf", engine, schema="silver", if_exists="replace", index=False, chunksize=10000, method="multi")
print(f"silver.dvf chargée avec {len(df)} lignes.")
