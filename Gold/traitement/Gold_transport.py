"""Indicateur composite B : accessibilité transports.

Deux mesures par arrondissement :
- nombre d'arrêts par mode (métro, bus, tram, RER...) + total ;
- **couverture piétonne** : % de la surface de l'arrondissement situé à moins
  de 300 m d'un arrêt (norme d'accessibilité urbaine) — indicateur principal,
  insensible à la taille de l'arrondissement contrairement au comptage brut.

Arrondissement affecté par point-in-polygon car le jeu IDFM ne donne que la
commune "Paris".
"""
import gold_utils as g
import pandas as pd

engine = g.init_gold()
polygones = g.load_arrondissements()

df = pd.read_sql("SELECT stop_id, mode, stop_lon, stop_lat FROM silver.transport", engine)

# Un arrêt physique peut apparaître sur plusieurs lignes -> dédoublonnage par stop_id + mode
df = df.drop_duplicates(subset=["stop_id", "mode"])

df["code_arrondissement"] = [
    g.assign_arrondissement(lo, la, polygones)
    for lo, la in zip(df["stop_lon"], df["stop_lat"])
]
df = df.dropna(subset=["code_arrondissement"])
df["code_arrondissement"] = df["code_arrondissement"].astype(int)

# Comptage par arrondissement et par mode, puis pivot en colonnes
detail = (
    df.groupby(["code_arrondissement", "mode"]).size().reset_index(name="nb")
)
res = detail.pivot_table(
    index="code_arrondissement", columns="mode", values="nb", fill_value=0
).reset_index()
res.columns.name = None

# Préfixer les colonnes de mode et calculer le total
mode_cols = [c for c in res.columns if c != "code_arrondissement"]
res = res.rename(columns={c: f"nb_{str(c).lower()}" for c in mode_cols})
nb_cols = [f"nb_{str(c).lower()}" for c in mode_cols]
res[nb_cols] = res[nb_cols].astype(int)
res["nb_total_arrets"] = res[nb_cols].sum(axis=1)

# Couverture piétonne : % de surface à moins de 300 m d'un arrêt physique.
# Dédoublonnage par position (un même arrêt porte plusieurs lignes/modes).
arrets = df.drop_duplicates(subset=["stop_lon", "stop_lat"])
cov = g.couverture_par_arrondissement(
    zip(arrets["stop_lon"], arrets["stop_lat"]),
    polygones, rayon_m=300.0, pas_m=100.0, nom_colonne="couverture_300m_pct",
)
res = res.merge(cov, on="code_arrondissement", how="left")
res["couverture_300m_pct"] = res["couverture_300m_pct"].fillna(0.0)

g.load_gold(res, engine, "transport")
