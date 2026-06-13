"""Indicateur 1 : prix médian au m² par arrondissement et par année (+ évolution)."""
import gold_utils as g
import pandas as pd

engine = g.init_gold()

df = pd.read_sql("SELECT code_arrondissement, annee, prix_m2 FROM silver.dvf", engine)
df["code_arrondissement"] = df["code_arrondissement"].map(g.arr_from_code5)
df["annee"] = pd.to_numeric(df["annee"], errors="coerce")
df["prix_m2"] = pd.to_numeric(df["prix_m2"], errors="coerce")
df = df.dropna(subset=["code_arrondissement", "annee", "prix_m2"])
df["code_arrondissement"] = df["code_arrondissement"].astype(int)
df["annee"] = df["annee"].astype(int)

res = (
    df.groupby(["code_arrondissement", "annee"])
    .agg(
        prix_m2_median=("prix_m2", "median"),
        prix_m2_moyen=("prix_m2", "mean"),
        nb_ventes=("prix_m2", "size"),
    )
    .reset_index()
)

# Évolution annuelle (%) du prix médian par arrondissement
res = res.sort_values(["code_arrondissement", "annee"])
res["evolution_pct"] = (
    res.groupby("code_arrondissement")["prix_m2_median"].pct_change() * 100
)

res["prix_m2_median"] = res["prix_m2_median"].round(0)
res["prix_m2_moyen"] = res["prix_m2_moyen"].round(0)
res["evolution_pct"] = res["evolution_pct"].round(1)

g.load_gold(res, engine, "prix_m2")
