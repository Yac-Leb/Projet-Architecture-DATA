"""Indicateur 4 : logements sociaux financés par arrondissement et par année (+ cumul)."""
import gold_utils as g
import pandas as pd

engine = g.init_gold()

df = pd.read_sql(
    "SELECT arrdt, annee, nb_logmt_total FROM silver.logements_sociaux", engine
)
df["code_arrondissement"] = pd.to_numeric(df["arrdt"], errors="coerce")
df["annee"] = pd.to_numeric(df["annee"], errors="coerce")
df["nb_logmt_total"] = pd.to_numeric(df["nb_logmt_total"], errors="coerce")
df = df.dropna(subset=["code_arrondissement", "annee"])
df = df[(df["code_arrondissement"] >= 1) & (df["code_arrondissement"] <= 20)]
df["code_arrondissement"] = df["code_arrondissement"].astype(int)
df["annee"] = df["annee"].astype(int)

res = (
    df.groupby(["code_arrondissement", "annee"])
    .agg(
        nb_logements_sociaux=("nb_logmt_total", "sum"),
        nb_programmes=("nb_logmt_total", "size"),
    )
    .reset_index()
)

# Grille complète arrondissements (1-20) × années : une année sans opération
# n'apparaît pas dans la source → on la force à 0 (et non "donnée manquante").
annees = range(int(res["annee"].min()), int(res["annee"].max()) + 1)
grille = pd.MultiIndex.from_product(
    [range(1, 21), annees], names=["code_arrondissement", "annee"]
)
res = (
    res.set_index(["code_arrondissement", "annee"])
    .reindex(grille, fill_value=0)
    .reset_index()
    .sort_values(["code_arrondissement", "annee"])
)

# Cumul des logements sociaux livrés par arrondissement au fil des années
# (se reporte correctement : les années à 0 n'ajoutent rien au cumul).
res["cumul_logements"] = (
    res.groupby("code_arrondissement")["nb_logements_sociaux"].cumsum()
)

g.load_gold(res, engine, "logements_sociaux")
