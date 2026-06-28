"""Utilitaires partagés de la couche Gold : connexions, normalisation
arrondissement et affectation point -> arrondissement (point-in-polygon).
"""
import sys
import os
import math
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../Stockage/traitement"))

import pandas as pd
from db_connection import get_postgres_engine, get_mongo_client, create_gold_schema


def get_engine():
    return get_postgres_engine()


def init_gold():
    engine = get_postgres_engine()
    create_gold_schema(engine)
    return engine


def load_gold(df, engine, table):
    df.to_sql(table, engine, schema="gold", if_exists="replace", index=False, method="multi")
    print(f"gold.{table} chargée avec {len(df)} lignes.")


def arr_from_code5(valeur):
    """Code commune Paris 5 chiffres (75101 ou 75018) -> n° arrondissement 1-20."""
    if valeur is None or pd.isna(valeur):
        return None
    s = str(valeur)
    # Retirer une éventuelle partie décimale ("75012.0" -> "75012")
    if "." in s:
        s = s.split(".")[0]
    s = "".join(ch for ch in s if ch.isdigit())
    if len(s) >= 2:
        n = int(s[-2:])
        if 1 <= n <= 20:
            return n
    return None


# ----- Point-in-polygon (ray casting) sans dépendance externe -----

def _rings_from_geometry(geom):
    """Renvoie la liste des anneaux extérieurs (listes de [lon, lat])."""
    if not geom:
        return []
    t = geom.get("type")
    coords = geom.get("coordinates", [])
    if t == "Polygon":
        return [coords[0]] if coords else []
    if t == "MultiPolygon":
        return [poly[0] for poly in coords if poly]
    return []


def load_arrondissements():
    """Charge les polygones d'arrondissement depuis MongoDB.
    Renvoie une liste de dicts : {code, rings, bbox}.
    """
    client = get_mongo_client()
    db = client["urban_db"]
    polygones = []
    for feature in db["arrondissements"].find({}, {"_id": 0}):
        code = feature.get("properties", {}).get("code_arrondissement")
        try:
            code = int(code)
        except (TypeError, ValueError):
            continue
        for ring in _rings_from_geometry(feature.get("geometry")):
            lons = [p[0] for p in ring]
            lats = [p[1] for p in ring]
            polygones.append({
                "code": code,
                "ring": ring,
                "bbox": (min(lons), min(lats), max(lons), max(lats)),
            })
    return polygones


def _point_in_ring(lon, lat, ring):
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if ((yi > lat) != (yj > lat)) and \
           (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def assign_arrondissement(lon, lat, polygones):
    """Renvoie le n° d'arrondissement (1-20) contenant le point, ou None."""
    if lon is None or lat is None or pd.isna(lon) or pd.isna(lat):
        return None
    for poly in polygones:
        minx, miny, maxx, maxy = poly["bbox"]
        if minx <= lon <= maxx and miny <= lat <= maxy:
            if _point_in_ring(lon, lat, poly["ring"]):
                return poly["code"]
    return None


def comptage_par_arrondissement(df, lon_col, lat_col, polygones, nom_colonne):
    """Affecte chaque ligne (lon, lat) à un arrondissement et compte par arrondissement."""
    df = df.copy()
    df["code_arrondissement"] = [
        assign_arrondissement(lo, la, polygones)
        for lo, la in zip(df[lon_col], df[lat_col])
    ]
    df = df.dropna(subset=["code_arrondissement"])
    df["code_arrondissement"] = df["code_arrondissement"].astype(int)
    return df.groupby("code_arrondissement").size().reset_index(name=nom_colonne)


# ----- Couverture d'accessibilité (% de surface proche d'un point) -----

_M_PAR_DEG_LAT = 111320.0  # mètres par degré de latitude (quasi constant)


def couverture_par_arrondissement(points, polygones, rayon_m=300.0, pas_m=100.0,
                                  nom_colonne="couverture_pct"):
    """Part de la surface de chaque arrondissement située à moins de `rayon_m`
    d'au moins un point (ex. arrêt de transport).

    Méthode sans dépendance géo : on échantillonne l'intérieur de chaque
    arrondissement par une grille régulière de pas `pas_m`, puis on compte la
    proportion de points de grille proches d'un arrêt (distance euclidienne
    locale en mètres). Norme d'accessibilité piétonne classique : 300 m.

    `points` : itérable de (lon, lat). Renvoie un DataFrame
    [code_arrondissement, nom_colonne] (pourcentage arrondi à 0.1).
    """
    pts = [(float(lo), float(la)) for lo, la in points
           if lo is not None and la is not None and not pd.isna(lo) and not pd.isna(la)]

    # Regrouper les anneaux par arrondissement (un MultiPolygon = plusieurs entrées)
    par_code = {}
    for poly in polygones:
        par_code.setdefault(poly["code"], []).append(poly)

    r2 = rayon_m * rayon_m
    lignes = []

    for code, polys in par_code.items():
        minx = min(p["bbox"][0] for p in polys)
        miny = min(p["bbox"][1] for p in polys)
        maxx = max(p["bbox"][2] for p in polys)
        maxy = max(p["bbox"][3] for p in polys)

        lat_moy = (miny + maxy) / 2
        m_par_deg_lon = _M_PAR_DEG_LAT * math.cos(math.radians(lat_moy))
        pas_lat = pas_m / _M_PAR_DEG_LAT
        pas_lon = pas_m / m_par_deg_lon
        marge_lat = rayon_m / _M_PAR_DEG_LAT
        marge_lon = rayon_m / m_par_deg_lon

        # Arrêts pertinents : bbox élargie du rayon (inclut les arrêts voisins
        # juste de l'autre côté de la frontière, qui desservent quand même).
        proches = [
            (lo, la) for lo, la in pts
            if minx - marge_lon <= lo <= maxx + marge_lon
            and miny - marge_lat <= la <= maxy + marge_lat
        ]

        total = couverts = 0
        lat = miny
        while lat <= maxy:
            m_lon_pt = _M_PAR_DEG_LAT * math.cos(math.radians(lat))
            lon = minx
            while lon <= maxx:
                if any(_point_in_ring(lon, lat, p["ring"]) for p in polys):
                    total += 1
                    for slo, sla in proches:
                        dx = (slo - lon) * m_lon_pt
                        dy = (sla - lat) * _M_PAR_DEG_LAT
                        if dx * dx + dy * dy <= r2:
                            couverts += 1
                            break
                lon += pas_lon
            lat += pas_lat

        pct = round(100.0 * couverts / total, 1) if total else 0.0
        lignes.append({"code_arrondissement": code, nom_colonne: pct})

    return pd.DataFrame(lignes)
