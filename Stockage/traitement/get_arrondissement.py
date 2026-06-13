import os
import requests
import json

project_root = os.path.dirname(__file__)

output_dir = os.path.join(
    project_root,
    "..",
    "Data",
    "Arrondissements"
)

os.makedirs(output_dir, exist_ok=True)

url = (
    "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/"
    "arrondissements/exports/geojson"
)

output_path = os.path.join(
    output_dir,
    "arrondissements_paris.geojson"
)

print("Téléchargement du GeoJSON des arrondissements de Paris...")

response = requests.get(url, timeout=60)
response.raise_for_status()

geojson_data = response.json()

with open(output_path, "w", encoding="utf-8") as file:
    json.dump(geojson_data, file, ensure_ascii=False, indent=2)

print("GeoJSON sauvegardé ici :")
print(output_path)