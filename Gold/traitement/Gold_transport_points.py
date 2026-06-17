"""Calque carte : arrêts de transport de Paris (points individuels cliquables).

Garde une ligne par arrêt physique (dédoublonné par stop_id + mode) avec ses
coordonnées, son nom et son mode — même pattern que Gold_fontaines.py.
Point-in-polygon réutilisé depuis gold_utils (même logique que Gold_transport.py).
"""
import gold_utils as g
import pandas as pd

engine = g.init_gold()
polygones = g.load_arrondissements()

df = pd.read_sql(
    "SELECT stop_id, stop_name, mode, stop_lon, stop_lat FROM silver.transport",
    engine,
)

df = df.drop_duplicates(subset=["stop_id", "mode"])

df["code_arrondissement"] = [
    g.assign_arrondissement(lo, la, polygones)
    for lo, la in zip(df["stop_lon"], df["stop_lat"])
]
df = df.dropna(subset=["code_arrondissement"])
df["code_arrondissement"] = df["code_arrondissement"].astype(int)

MODE_MAP = {
    "metro": "metro", "Metro": "metro",
    "Bus": "bus", "bus": "bus",
    "Tramway": "tram", "tram": "tram",
    "RapidTransit": "rer", "rapidtransit": "rer",
    "regionalRail": "rer", "LocalTrain": "rer",
    "Funicular": "autre",
}
df["mode"] = df["mode"].map(lambda m: MODE_MAP.get(str(m), "bus"))

res = df.rename(columns={"stop_lon": "lon", "stop_lat": "lat", "stop_name": "nom"})[
    ["code_arrondissement", "nom", "mode", "lat", "lon"]
]

g.load_gold(res, engine, "transport_points")
print(f"gold.transport_points chargée avec {len(res)} lignes.")
