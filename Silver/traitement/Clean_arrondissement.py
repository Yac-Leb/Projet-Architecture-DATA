import sys
import os
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../Stockage/traitement"))

from db_connection import get_mongo_client

client = get_mongo_client()
db = client["urban_db"]

features = list(db["bronze_arrondissements"].find({}, {"_id": 0}))

# Nettoyer : garder geometry + propriétés utiles
cleaned = []
for f in features:
    props = f.get("properties", {})
    cleaned.append({
        "type": "Feature",
        "geometry": f.get("geometry"),
        "properties": {
            "code_arrondissement": props.get("c_ar") or props.get("c_arinsee") or props.get("code"),
            "nom": props.get("l_ar") or props.get("l_aroff") or props.get("nom"),
            "superficie_ha": props.get("surface") or props.get("geom_x_explode"),
            "population": props.get("population"),
        }
    })

db["arrondissements"].delete_many({})
db["arrondissements"].insert_many(cleaned)

print(f"{len(cleaned)} arrondissements nettoyés dans MongoDB (urban_db.arrondissements).")
