"""Calque carte : marchés alimentaires de Paris (points individuels cliquables).

Garde une ligne par marché avec ses coordonnées et ses détails pour l'affichage
comme marqueurs sur la carte du dashboard — même pattern que Gold_fontaines.py.
"""
import gold_utils as g
import pandas as pd

engine = g.init_gold()

df = pd.read_sql("SELECT * FROM silver.marches", engine)

# Colonne de coordonnées — priorité à geo_point_2d ("lat, lon"), puis lat/lon explicites
geo_col = next((c for c in df.columns if "geo_point" in c.lower()), None)
lat_col = next((c for c in df.columns if c.lower() == "lat" or c.lower() == "latitude"), None)
lon_col = next((c for c in df.columns if c.lower() == "lon" or c.lower() == "longitude"), None)

if geo_col:
    coords = df[geo_col].astype(str).str.split(",", expand=True)
    df["lat"] = pd.to_numeric(coords[0], errors="coerce")
    df["lon"] = pd.to_numeric(coords[1], errors="coerce")
elif lat_col and lon_col:
    df["lat"] = pd.to_numeric(df[lat_col], errors="coerce")
    df["lon"] = pd.to_numeric(df[lon_col], errors="coerce")
else:
    raise ValueError(f"Aucune colonne de coordonnées trouvée. Colonnes disponibles : {list(df.columns)}")

df = df.dropna(subset=["lat", "lon"])

# Colonnes connues : nom_long, jours_tenue, produit
res = df[["code_arrondissement", "lat", "lon"]].copy()
res["nom"] = df["nom_long"].astype(str) if "nom_long" in df.columns else (
    df["nom_court"].astype(str) if "nom_court" in df.columns else "Marché")
res["jours"] = df["jours_tenue"].astype(str) if "jours_tenue" in df.columns else ""
res["produit"] = df["produit"].astype(str) if "produit" in df.columns else ""

g.load_gold(res, engine, "marches_points")
print(f"gold.marches_points chargée avec {len(res)} lignes.")
