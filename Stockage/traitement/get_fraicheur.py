import requests
import pandas as pd
from db_connection import get_postgres_engine, create_bronze_schema, get_mongo_client

sources = {
    "fontaines_raw": (
        "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/"
        "fontaines-a-boire/exports/csv"
        "?delimiter=%3B&list_separator=%2C&quote_all=false&with_bom=true"
    ),
    "ilots_fraicheur_equipements_raw": (
        "https://parisdata.opendatasoft.com/api/explore/v2.1/catalog/datasets/"
        "ilots-de-fraicheur-equipements-activites/exports/csv"
        "?delimiter=%3B&list_separator=%2C&quote_all=false&with_bom=true"
    ),
    "ilots_fraicheur_espaces_verts_raw": (
        "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/"
        "ilots-de-fraicheur-espaces-verts-frais/exports/csv"
        "?delimiter=%3B&list_separator=%2C&quote_all=false&with_bom=true"
    ),
    "commerces_eau_raw": (
        "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/"
        "commerces-eau-de-paris/exports/csv"
        "?delimiter=%3B&list_separator=%2C&quote_all=false&with_bom=true"
    ),
}

engine = get_postgres_engine()
create_bronze_schema(engine)

for table_name, url in sources.items():
    print(f"Téléchargement {table_name}...")
    df = pd.read_csv(url, sep=";")
    df.to_sql(
        table_name,
        engine,
        schema="bronze",
        if_exists="replace",
        index=False,
        chunksize=5000,
        method="multi",
    )
    print(f"  Table bronze.{table_name} créée avec {len(df)} lignes.")

print("Données fraîcheur urbaine chargées.")

# GeoJSON des espaces verts frais (polygones) → MongoDB bronze_espaces_verts_geo
print("Téléchargement GeoJSON espaces verts frais...")
url_geo = (
    "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/"
    "ilots-de-fraicheur-espaces-verts-frais/exports/geojson"
)
geo = requests.get(url_geo, timeout=30).json()
client = get_mongo_client()
db = client["urban_db"]
db["bronze_espaces_verts_geo"].drop()
db["bronze_espaces_verts_geo"].insert_one(geo)
client.close()
print(f"  MongoDB bronze_espaces_verts_geo : {len(geo.get('features', []))} features.")
