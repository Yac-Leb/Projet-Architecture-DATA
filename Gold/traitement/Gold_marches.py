"""Indicateur composite C : marchés alimentaires — nombre de marchés et de
journées de tenue hebdomadaire par arrondissement.
"""
import gold_utils as g
import pandas as pd

engine = g.init_gold()

df = pd.read_sql(
    "SELECT id_marche, code_arrondissement, nb_jours_semaine FROM silver.marches",
    engine,
)
df["code_arrondissement"] = pd.to_numeric(df["code_arrondissement"], errors="coerce")
df["nb_jours_semaine"] = pd.to_numeric(df["nb_jours_semaine"], errors="coerce").fillna(0)
df = df.dropna(subset=["code_arrondissement"])
df = df[(df["code_arrondissement"] >= 1) & (df["code_arrondissement"] <= 20)]
df["code_arrondissement"] = df["code_arrondissement"].astype(int)

res = (
    df.groupby("code_arrondissement")
    .agg(
        nb_marches=("id_marche", "nunique"),
        nb_jours_marche_total=("nb_jours_semaine", "sum"),
    )
    .reset_index()
)
res["nb_jours_marche_total"] = res["nb_jours_marche_total"].astype(int)

g.load_gold(res, engine, "marches")
