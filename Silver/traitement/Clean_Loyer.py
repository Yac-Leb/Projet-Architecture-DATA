import pandas as pd
import os

project_root = os.path.dirname(__file__)

input_path = os.path.join(
    project_root,
    "..",
    "..",
    "Stockage",
    "Data",
    "Loyer",
    "loyer.csv"
)

output_dir = os.path.join(
    project_root,
    "..",
    "Data",
    "Loyer"
)

os.makedirs(output_dir, exist_ok=True)

print("Lecture dataset loyers Bronze...")

df = pd.read_csv(input_path, sep=",", dtype=str)

# Colonnes utiles
df = df[[
    "annee",
    "id_zone",
    "id_quartier",
    "nom_quartier",
    "piece",
    "epoque",
    "meuble_txt",
    "ref",
    "max",
    "min",
    "ville",
    "code_grand_quartier",
    "geo_point_2d"
]]

# Renommage propre
df = df.rename(columns={
    "piece": "nombre_pieces",
    "meuble_txt": "type_location",
    "ref": "loyer_reference_m2",
    "max": "loyer_max_m2",
    "min": "loyer_min_m2",
    "code_grand_quartier": "code_quartier"
})

# Garder Paris uniquement
df = df[df["ville"].str.lower() == "paris"]

# Conversion numériques
numeric_cols = [
    "annee",
    "id_zone",
    "id_quartier",
    "nombre_pieces",
    "loyer_reference_m2",
    "loyer_max_m2",
    "loyer_min_m2",
    "code_quartier"
]

for col in numeric_cols:
    df[col] = (
        df[col]
        .astype(str)
        .str.replace(",", ".", regex=False)
    )
    df[col] = pd.to_numeric(df[col], errors="coerce")

# Extraction latitude / longitude
def extract_lat_lon(value):
    if pd.isna(value):
        return pd.Series([None, None])

    parts = str(value).split(",")

    if len(parts) != 2:
        return pd.Series([None, None])

    latitude = parts[0].strip()
    longitude = parts[1].strip()

    return pd.Series([latitude, longitude])

df[["latitude", "longitude"]] = df["geo_point_2d"].apply(extract_lat_lon)

df["latitude"] = pd.to_numeric(df["latitude"], errors="coerce")
df["longitude"] = pd.to_numeric(df["longitude"], errors="coerce")

df = df.drop(columns=["geo_point_2d"])

# Suppression des lignes inutilisables
df = df.dropna(subset=[
    "annee",
    "loyer_reference_m2",
    "loyer_max_m2",
    "loyer_min_m2"
])

# Filtrage valeurs aberrantes
df = df[
    (df["loyer_reference_m2"] > 0) &
    (df["loyer_reference_m2"] < 100)
]

# Tri
df = df.sort_values(by=["annee", "id_zone", "id_quartier"])

output_path = os.path.join(
    output_dir,
    "loyer_clean.csv"
)

df.to_csv(output_path, index=False, encoding="utf-8")

print("\nDataset loyers Silver créé.")
print(df.head())
print(df.shape)

print("\nFichier sauvegardé ici :")
print(output_path)