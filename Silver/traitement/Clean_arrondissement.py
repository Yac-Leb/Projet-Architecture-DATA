import os
import json

project_root = os.path.dirname(__file__)

input_path = os.path.join(
    project_root,
    "..",
    "..",
    "Stockage",
    "Data",
    "Arrondissements",
    "arrondissements_paris.geojson"
)

output_dir = os.path.join(
    project_root,
    "..",
    "Data",
    "Arrondissements"
)

os.makedirs(output_dir, exist_ok=True)

output_path = os.path.join(
    output_dir,
    "arrondissements_clean.geojson"
)

print("Lecture du GeoJSON Bronze...")

with open(input_path, "r", encoding="utf-8") as file:
    geojson = json.load(file)

clean_features = []

for feature in geojson["features"]:
    properties = feature.get("properties", {})
    geometry = feature.get("geometry")

    if geometry is None:
        continue

    code_arrondissement = str(properties.get("c_arinsee", "")).strip()
    nom_arrondissement = properties.get("l_ar", "")
    numero_arrondissement = properties.get("c_ar", None)

    clean_feature = {
        "type": "Feature",
        "geometry": geometry,
        "properties": {
            "code_arrondissement": code_arrondissement,
            "nom_arrondissement": nom_arrondissement,
            "numero_arrondissement": numero_arrondissement
        }
    }

    clean_features.append(clean_feature)

clean_geojson = {
    "type": "FeatureCollection",
    "features": clean_features
}

with open(output_path, "w", encoding="utf-8") as file:
    json.dump(clean_geojson, file, ensure_ascii=False, indent=2)

print("GeoJSON Silver créé.")
print("Nombre d'arrondissements :", len(clean_features))
print("Fichier sauvegardé ici :")
print(output_path)