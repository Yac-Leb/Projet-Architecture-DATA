"""Indicateur 4 (complément) : part des logements sociaux par arrondissement et par année.

part_logements_sociaux_pct(arr, année) = cumul logements sociaux financés jusqu'à l'année
                                         / nombre de ménages × 100

Le numérateur est le parc social CUMULÉ par année (gold.logements_sociaux.cumul_logements,
déjà calculé en amont) → la part varie dans le temps. Le dénominateur reste figé : faute de
stock officiel de résidences principales par année, on approxime par NBMEN19 (ménages fiscaux
2019, FiLoSoFi). C'est une estimation, pas le taux SRU officiel.
"""
import gold_utils as g
import pandas as pd

engine = g.init_gold()

# Cumul de logements sociaux par arrondissement et par année (déjà grille complète + report)
ls = pd.read_sql(
    "SELECT code_arrondissement, annee, cumul_logements FROM gold.logements_sociaux", engine
)

# Nombre de ménages par arrondissement (FiLoSoFi NBMEN19, dénominateur figé)
rev = pd.read_sql('SELECT code_arrondissement, "NBMEN19" FROM silver.revenus', engine)
rev["code_arrondissement"] = rev["code_arrondissement"].map(g.arr_from_code5)
rev["nb_menages"] = pd.to_numeric(rev["NBMEN19"], errors="coerce")
rev = rev.dropna(subset=["code_arrondissement", "nb_menages"])
rev["code_arrondissement"] = rev["code_arrondissement"].astype(int)
rev = rev.groupby("code_arrondissement")["nb_menages"].sum().reset_index()

res = ls.merge(rev, on="code_arrondissement", how="inner")
res["nb_menages"] = res["nb_menages"].astype(int)
res["part_logements_sociaux_pct"] = (
    res["cumul_logements"] / res["nb_menages"] * 100
).round(1)

g.load_gold(res, engine, "logements_sociaux_part")
