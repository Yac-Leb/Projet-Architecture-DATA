"""Indicateur 4 (complément) : part des logements sociaux par arrondissement.

part_logements_sociaux_pct = total logements sociaux financés / nombre de ménages × 100

Note : faute de stock officiel de résidences principales, on approxime le
dénominateur par NBMEN19 (nombre de ménages fiscaux 2019, FiLoSoFi).
C'est une estimation, pas le taux SRU officiel.
"""
import gold_utils as g
import pandas as pd

engine = g.init_gold()

# Total des logements sociaux financés par arrondissement (toutes années)
ls = pd.read_sql("SELECT arrdt, nb_logmt_total FROM silver.logements_sociaux", engine)
ls["code_arrondissement"] = pd.to_numeric(ls["arrdt"], errors="coerce")
ls["nb_logmt_total"] = pd.to_numeric(ls["nb_logmt_total"], errors="coerce")
ls = ls.dropna(subset=["code_arrondissement"])
ls = ls[(ls["code_arrondissement"] >= 1) & (ls["code_arrondissement"] <= 20)]
ls["code_arrondissement"] = ls["code_arrondissement"].astype(int)
total_ls = (
    ls.groupby("code_arrondissement")["nb_logmt_total"].sum()
    .reset_index(name="nb_logements_sociaux")
)

# Nombre de ménages par arrondissement (FiLoSoFi NBMEN19)
rev = pd.read_sql('SELECT code_arrondissement, "NBMEN19" FROM silver.revenus', engine)
rev["code_arrondissement"] = rev["code_arrondissement"].map(g.arr_from_code5)
rev["nb_menages"] = pd.to_numeric(rev["NBMEN19"], errors="coerce")
rev = rev.dropna(subset=["code_arrondissement", "nb_menages"])
rev["code_arrondissement"] = rev["code_arrondissement"].astype(int)
rev = rev.groupby("code_arrondissement")["nb_menages"].sum().reset_index()

res = total_ls.merge(rev, on="code_arrondissement", how="inner")
res["nb_logements_sociaux"] = res["nb_logements_sociaux"].astype(int)
res["nb_menages"] = res["nb_menages"].astype(int)
res["part_logements_sociaux_pct"] = (
    res["nb_logements_sociaux"] / res["nb_menages"] * 100
).round(1)

g.load_gold(res, engine, "logements_sociaux_part")
