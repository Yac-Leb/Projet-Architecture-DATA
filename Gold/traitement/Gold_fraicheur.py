"""Indicateur composite A : fraîcheur urbaine — nombre de ressources de fraîcheur
par arrondissement (fontaines, équipements, espaces verts, commerces eau de Paris).
"""
import gold_utils as g
import pandas as pd

engine = g.init_gold()
polygones = g.load_arrondissements()

base = pd.DataFrame({"code_arrondissement": range(1, 21)})

# 1) Fontaines à boire : arrondissement extrait du libellé commune ("PARIS 14EME ...")
fon = pd.read_sql("SELECT commune FROM silver.fontaines", engine)
fon["code_arrondissement"] = pd.to_numeric(
    fon["commune"].astype(str).str.extract(r"(\d{1,2})")[0], errors="coerce"
)
fon = fon.dropna(subset=["code_arrondissement"])
fon["code_arrondissement"] = fon["code_arrondissement"].astype(int)
nb_fontaines = fon.groupby("code_arrondissement").size().reset_index(name="nb_fontaines")

# 2) Équipements îlots de fraîcheur : colonne arrondissement (75018 -> 18)
eq = pd.read_sql("SELECT arrondissement FROM silver.ilots_fraicheur_equipements", engine)
eq["code_arrondissement"] = eq["arrondissement"].map(g.arr_from_code5)
eq = eq.dropna(subset=["code_arrondissement"])
eq["code_arrondissement"] = eq["code_arrondissement"].astype(int)
nb_equip = eq.groupby("code_arrondissement").size().reset_index(name="nb_equipements")

# 3) Espaces verts frais : colonne arrondissement (75018 -> 18)
ev = pd.read_sql("SELECT arrondissement FROM silver.ilots_fraicheur_espaces_verts", engine)
ev["code_arrondissement"] = ev["arrondissement"].map(g.arr_from_code5)
ev = ev.dropna(subset=["code_arrondissement"])
ev["code_arrondissement"] = ev["code_arrondissement"].astype(int)
nb_ev = ev.groupby("code_arrondissement").size().reset_index(name="nb_espaces_verts")

# 4) Commerces eau de Paris : pas d'arrondissement -> point-in-polygon sur lon/lat
ce = pd.read_sql("SELECT lon, lat FROM silver.commerces_eau", engine)
ce["lon"] = pd.to_numeric(ce["lon"], errors="coerce")
ce["lat"] = pd.to_numeric(ce["lat"], errors="coerce")
nb_ce = g.comptage_par_arrondissement(ce, "lon", "lat", polygones, "nb_commerces_eau")

res = base
for part in (nb_fontaines, nb_equip, nb_ev, nb_ce):
    res = res.merge(part, on="code_arrondissement", how="left")
res = res.fillna(0)

cols_nb = ["nb_fontaines", "nb_equipements", "nb_espaces_verts", "nb_commerces_eau"]
res[cols_nb] = res[cols_nb].astype(int)
res["nb_total_fraicheur"] = res[cols_nb].sum(axis=1)

g.load_gold(res, engine, "fraicheur")
