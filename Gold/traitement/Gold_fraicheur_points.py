"""Calque carte : points de fraîcheur urbaine (4 sources géolocalisées).

Une ligne par point (fontaine, espace vert frais, équipement, commerce eau de
Paris), pour afficher la fraîcheur LÀ OÙ elle se trouve (clusters sur la carte),
et non par arrondissement.
"""
import gold_utils as g
import pandas as pd

engine = g.init_gold()
polygones = g.load_arrondissements()


def coords_depuis_geopoint(df):
    """geo_point_2d = 'lat, lon' -> colonnes lat, lon."""
    c = df["geo_point_2d"].astype(str).str.split(",", expand=True)
    df["lat"] = pd.to_numeric(c[0], errors="coerce")
    df["lon"] = pd.to_numeric(c[1], errors="coerce")
    return df


morceaux = []

# 1) Fontaines à boire
f = pd.read_sql("SELECT type_objet AS nom, geo_point_2d FROM silver.fontaines", engine)
f = coords_depuis_geopoint(f)
f["source"] = "Fontaine à boire"
morceaux.append(f[["source", "nom", "lat", "lon"]])

# 2) Équipements îlots de fraîcheur
e = pd.read_sql("SELECT nom, geo_point_2d FROM silver.ilots_fraicheur_equipements", engine)
e = coords_depuis_geopoint(e)
e["source"] = "Équipement fraîcheur"
morceaux.append(e[["source", "nom", "lat", "lon"]])

# 3) Espaces verts frais
v = pd.read_sql("SELECT nom, geo_point_2d FROM silver.ilots_fraicheur_espaces_verts", engine)
v = coords_depuis_geopoint(v)
v["source"] = "Espace vert frais"
morceaux.append(v[["source", "nom", "lat", "lon"]])

# 4) Commerces eau de Paris (lon/lat directs)
ce = pd.read_sql("SELECT nom_commerce AS nom, lon, lat FROM silver.commerces_eau", engine)
ce["lon"] = pd.to_numeric(ce["lon"], errors="coerce")
ce["lat"] = pd.to_numeric(ce["lat"], errors="coerce")
ce["source"] = "Commerce eau de Paris"
morceaux.append(ce[["source", "nom", "lat", "lon"]])

pts = pd.concat(morceaux, ignore_index=True)
pts = pts.dropna(subset=["lat", "lon"])
pts = pts[(pts["lat"] != 0) & (pts["lon"] != 0)]

# Arrondissement par point-in-polygon (pour l'infobulle)
pts["code_arrondissement"] = [
    g.assign_arrondissement(lo, la, polygones) for lo, la in zip(pts["lon"], pts["lat"])
]
pts["code_arrondissement"] = pd.to_numeric(pts["code_arrondissement"], errors="coerce").astype("Int64")

g.load_gold(pts, engine, "fraicheur_points")
