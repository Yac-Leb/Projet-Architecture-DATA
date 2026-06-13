import requests
from db_connection import get_mongo_client

url = (
    "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/"
    "arrondissements/exports/geojson"
)

print("Téléchargement du GeoJSON des arrondissements de Paris...")

response = requests.get(url, timeout=60)
response.raise_for_status()

features = response.json()["features"]

client = get_mongo_client()
db = client["urban_db"]
collection = db["bronze_arrondissements"]

collection.delete_many({})
collection.insert_many(features)

print(f"{len(features)} arrondissements insérés dans MongoDB (urban_db.bronze_arrondissements).")
