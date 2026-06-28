import sys
import os
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../Stockage/traitement"))

import pandas as pd
from db_connection import get_postgres_engine, create_silver_schema, get_mongo_client

engine = get_postgres_engine()
create_silver_schema(engine)

tables = [
    "fontaines_raw",
    "ilots_fraicheur_equipements_raw",
    "ilots_fraicheur_espaces_verts_raw",
    "commerces_eau_raw", 
]

for table in tables:
    df = pd.read_sql(f"SELECT * FROM bronze.{table}", engine)

    if table == "commerces_eau_raw":
        cols_to_drop = [c for c in df.columns if "postal" in c.lower() or "commune" in c.lower()]
        df = df.drop(columns=cols_to_drop)

    silver_table = table.replace("_raw", "")
    df.to_sql(silver_table, engine, schema="silver", if_exists="replace", index=False, chunksize=5000, method="multi")
    print(f"silver.{silver_table} chargée avec {len(df)} lignes.")

# GeoJSON des espaces verts frais : Bronze MongoDB → Silver MongoDB (filtre géométries nulles)
client = get_mongo_client()
db = client["urban_db"]
bronze_geo = db["bronze_espaces_verts_geo"].find_one({}, {"_id": 0})
if bronze_geo:
    features_propres = [
        f for f in bronze_geo.get("features", [])
        if f.get("geometry") is not None
    ]
    db["espaces_verts_geo"].drop()
    db["espaces_verts_geo"].insert_one({
        "type": "FeatureCollection",
        "features": features_propres,
    })
    print(f"silver espaces_verts_geo : {len(features_propres)} features.")
else:
    print("AVERTISSEMENT : bronze_espaces_verts_geo introuvable. Relancer Bronze.")
client.close()
