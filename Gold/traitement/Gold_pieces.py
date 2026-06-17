"""Indicateur 2 (complément) : répartition des logements par nombre de pièces
(Studio/T1, T2, T3, T4+) par arrondissement, à partir des ventes DVF.
"""
import gold_utils as g
import pandas as pd

engine = g.init_gold()

df = pd.read_sql(
    "SELECT code_arrondissement, nombre_pieces_principales FROM silver.dvf", engine
)
df["code_arrondissement"] = df["code_arrondissement"].map(g.arr_from_code5)
df["nb_pieces"] = pd.to_numeric(df["nombre_pieces_principales"], errors="coerce")
df = df.dropna(subset=["code_arrondissement", "nb_pieces"])
df = df[df["nb_pieces"] >= 1]  # on exclut les valeurs à 0 (incohérentes)
df["code_arrondissement"] = df["code_arrondissement"].astype(int)


def categorie(n):
    if n == 1:
        return "Studio/T1"
    if n == 2:
        return "T2"
    if n == 3:
        return "T3"
    return "T4+"


df["categorie"] = df["nb_pieces"].apply(categorie)

res = (
    df.groupby(["code_arrondissement", "categorie"]).size()
    .reset_index(name="nb_biens")
)
total = res.groupby("code_arrondissement")["nb_biens"].transform("sum")
res["part_pct"] = (res["nb_biens"] / total * 100).round(1)

# Ordre logique des catégories
ordre = {"Studio/T1": 0, "T2": 1, "T3": 2, "T4+": 3}
res["_ordre"] = res["categorie"].map(ordre)
res = res.sort_values(["code_arrondissement", "_ordre"]).drop(columns="_ordre")

g.load_gold(res, engine, "pieces")
