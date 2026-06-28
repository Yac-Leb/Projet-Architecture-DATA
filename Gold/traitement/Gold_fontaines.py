"""Calque carte : fontaines à boire de Paris (points individuels cliquables).

Contrairement aux autres tables Gold (agrégées par zone), celle-ci garde une
ligne par fontaine avec ses coordonnées et ses détails, pour les afficher
comme marqueurs sur la carte du dashboard.
"""
import gold_utils as g
import pandas as pd

engine = g.init_gold()

df = pd.read_sql(
    "SELECT type_objet, modele, voie, commune, dispo, geo_point_2d FROM silver.fontaines",
    engine,
)

# geo_point_2d = "lat, lon"
coords = df["geo_point_2d"].astype(str).str.split(",", expand=True)
df["lat"] = pd.to_numeric(coords[0], errors="coerce")
df["lon"] = pd.to_numeric(coords[1], errors="coerce")
df = df.dropna(subset=["lat", "lon"])

# Arrondissement depuis "PARIS 14EME ARRONDISSEMENT"
df["code_arrondissement"] = pd.to_numeric(
    df["commune"].astype(str).str.extract(r"(\d{1,2})")[0], errors="coerce"
).astype("Int64")

df["disponible"] = df["dispo"].astype(str).str.upper().eq("OUI")

res = df.rename(columns={"type_objet": "type", "voie": "adresse"})[
    ["code_arrondissement", "type", "modele", "adresse", "disponible", "lat", "lon"]
]

g.load_gold(res, engine, "fontaines")
