"""Indicateur 3 : accessibilité prix vs revenus par arrondissement.

m2_par_revenu_annuel = surface (m²) achetable avec un an de revenu disponible médian.
Plus la valeur est basse, moins le logement est accessible.
"""
import gold_utils as g
import pandas as pd

engine = g.init_gold()

# Prix médian au m² par arrondissement (toutes années confondues)
dvf = pd.read_sql("SELECT code_arrondissement, prix_m2 FROM silver.dvf", engine)
dvf["code_arrondissement"] = dvf["code_arrondissement"].map(g.arr_from_code5)
dvf["prix_m2"] = pd.to_numeric(dvf["prix_m2"], errors="coerce")
dvf = dvf.dropna(subset=["code_arrondissement", "prix_m2"])
dvf["code_arrondissement"] = dvf["code_arrondissement"].astype(int)
prix = (
    dvf.groupby("code_arrondissement")["prix_m2"].median()
    .round(0).reset_index(name="prix_m2_median")
)

# Revenu disponible médian par arrondissement (FiLoSoFi)
rev = pd.read_sql("SELECT code_arrondissement, revenu_median FROM silver.revenus", engine)
rev["code_arrondissement"] = rev["code_arrondissement"].map(g.arr_from_code5)
rev["revenu_median"] = pd.to_numeric(rev["revenu_median"], errors="coerce")
rev = rev.dropna(subset=["code_arrondissement", "revenu_median"])
rev["code_arrondissement"] = rev["code_arrondissement"].astype(int)
rev = rev.groupby("code_arrondissement")["revenu_median"].median().reset_index()

res = prix.merge(rev, on="code_arrondissement", how="inner")
res["m2_par_revenu_annuel"] = (res["revenu_median"] / res["prix_m2_median"]).round(2)
res["annees_revenu_pour_m2"] = (res["prix_m2_median"] / res["revenu_median"]).round(2)

g.load_gold(res, engine, "accessibilite")
