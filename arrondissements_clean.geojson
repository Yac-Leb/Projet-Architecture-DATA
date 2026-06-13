import os
import json
from pymongo import MongoClient

MONGO_HOST = "mongodb"
MONGO_PORT = 27017
DB_NAME = "urban_db"

client = MongoClient(MONGO_HOST, MONGO_PORT)
db = client[DB_NAME]

project_root = os.path.dirname(
    os.path.dirname(
        os.path.dirname(__file__)
    )
)

geojson_path = os.path.join(
    project_root,
    "Silver",
    "Data",
    "Arrondissements",
    "arrondissements_clean.geojson"
)

with open(geojson_path, "r", encoding="utf-8") as file:
    geojson = json.load(file)

features = geojson["features"]

collection = db["arrondissements"]

collection.delete_many({})
collection.insert_many(features)

collection.create_index([("geometry", "2dsphere")])

print(f"{len(features)} arrondissements insérés dans MongoDB.")
print("Collection : urban_db.arrondissements")