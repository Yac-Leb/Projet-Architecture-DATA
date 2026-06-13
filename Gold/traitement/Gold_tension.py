"""Indicateur composite D : tension immobilière par arrondissement.

rendement_locatif_pct = (loyer de référence €/m² × 12) / prix médian au m² × 100
annees_amortissement = prix médian au m² / (loyer de référence €/m² × 12)
Un rendement faible / un amortissement long traduit une forte tension immobilière.
"""
import gold_utils as g
import pandas as pd

engine = g.init_gold()

# Prix médian au m² par arrondissement
dvf = pd.read_sql("SELECT code_arrondissement, prix_m2 FROM silver.dvf", engine)
dvf["code_arrondissement"] = dvf["code_arrondissement"].map(g.arr_from_code5)
dvf["prix_m2"] = pd.to_numeric(dvf["prix_m2"], errors="coerce")
dvf = dvf.dropna(subset=["code_arrondissement", "prix_m2"])
dvf["code_arrondissement"] = dvf["code_arrondissement"].astype(int)
prix = (
    dvf.groupby("code_arrondissement")["prix_m2"].median()
    .round(0).reset_index(name="prix_m2_median")
)

# Loyer de référence €/m² moyen par arrondissement (code_grand_quartier : 751 AA QQ)
loy = pd.read_sql("SELECT code_grand_quartier, ref FROM silver.loyers", engine)
loy["code_arrondissement"] = pd.to_numeric(
    loy["code_grand_quartier"].astype(str).str.slice(3, 5), errors="coerce"
)
loy["ref"] = pd.to_numeric(loy["ref"], errors="coerce")
loy = loy.dropna(subset=["code_arrondissement", "ref"])
loy = loy[(loy["code_arrondissement"] >= 1) & (loy["code_arrondissement"] <= 20)]
loy["code_arrondissement"] = loy["code_arrondissement"].astype(int)
loyer = (
    loy.groupby("code_arrondissement")["ref"].mean()
    .round(2).reset_index(name="loyer_ref_m2_moyen")
)

res = prix.merge(loyer, on="code_arrondissement", how="inner")
res["rendement_locatif_pct"] = (
    res["loyer_ref_m2_moyen"] * 12 / res["prix_m2_median"] * 100
).round(2)
res["annees_amortissement"] = (
    res["prix_m2_median"] / (res["loyer_ref_m2_moyen"] * 12)
).round(1)

g.load_gold(res, engine, "tension")
