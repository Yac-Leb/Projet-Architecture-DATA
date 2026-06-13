"""Indicateur 2 : répartition des types de logements (appartement/maison) par arrondissement."""
import gold_utils as g
import pandas as pd

engine = g.init_gold()

df = pd.read_sql(
    "SELECT code_arrondissement, type_local, surface_reelle_bati, prix_m2 FROM silver.dvf",
    engine,
)
df["code_arrondissement"] = df["code_arrondissement"].map(g.arr_from_code5)
df["surface_reelle_bati"] = pd.to_numeric(df["surface_reelle_bati"], errors="coerce")
df["prix_m2"] = pd.to_numeric(df["prix_m2"], errors="coerce")
df = df.dropna(subset=["code_arrondissement", "type_local"])
df["code_arrondissement"] = df["code_arrondissement"].astype(int)

res = (
    df.groupby(["code_arrondissement", "type_local"])
    .agg(
        nb_biens=("type_local", "size"),
        surface_moyenne=("surface_reelle_bati", "mean"),
        prix_m2_median=("prix_m2", "median"),
    )
    .reset_index()
)

# Part (%) de chaque type au sein de l'arrondissement
total = res.groupby("code_arrondissement")["nb_biens"].transform("sum")
res["part_pct"] = (res["nb_biens"] / total * 100).round(1)
res["surface_moyenne"] = res["surface_moyenne"].round(1)
res["prix_m2_median"] = res["prix_m2_median"].round(0)

g.load_gold(res, engine, "types_logements")
