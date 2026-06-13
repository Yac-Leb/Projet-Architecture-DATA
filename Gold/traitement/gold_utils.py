"""Utilitaires partagés de la couche Gold : connexions, normalisation
arrondissement et affectation point -> arrondissement (point-in-polygon).
"""
import sys
import os
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
