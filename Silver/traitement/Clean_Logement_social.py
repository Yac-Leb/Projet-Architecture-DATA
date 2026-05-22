import pandas as pd
import os
import ast

project_root = os.path.dirname(__file__)

input_path = os.path.join(
    project_root,
    "..",
    "..",
    "Stockage",
    "Data",
    "Logements_sociaux",
    "logements_sociaux.csv"
)

output_dir = os.path.join(
    project_root,
    "..",
    "Data",
    "Logements_sociaux"
)

os.makedirs(output_dir, exist_ok=True)

print("Lecture dataset logements sociaux Bronze...")

df = pd.read_csv(input_path, sep=",", dtype=str)

columns_to_keep = [
    "id_livraison",
    "adresse_programme",
    "code_postal",
    "ville",
    "annee",
    "nb_logmt_total",
    "nb_plai",
    "nb_plus",
    "nb_pluscd",
    "nb_pls",
    "mode_real",
    "arrdt",
    "nature_programme",
    "geo_point_2d"
]

df = df[columns_to_keep]

df = df.rename(columns={
    "id_livraison": "id_programme",
    "adresse_programme": "adresse",
    "nb_logmt_total": "nb_logements_total",
    "nb_plai": "nb_logements_plai",
    "nb_plus": "nb_logements_plus",
    "nb_pluscd": "nb_logements_pluscd",
    "nb_pls": "nb_logements_pls",
    "mode_real": "mode_realisation",
    "arrdt": "arrondissement"
})

# Garder Paris uniquement
df = df[df["code_postal"].str.startswith("75", na=False)]

# Code arrondissement propre
df["code_arrondissement"] = df["code_postal"].str[:5]

# Conversion numériques
numeric_cols = [
    "annee",
    "nb_logements_total",
    "nb_logements_plai",
    "nb_logements_plus",
    "nb_logements_pluscd",
    "nb_logements_pls"
]

for col in numeric_cols:
    df[col] = pd.to_numeric(df[col], errors="coerce")

# Extraction latitude / longitude depuis geo_point_2d
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

# Supprimer lignes sans année ou sans nombre total
df = df.dropna(subset=["annee", "nb_logements_total"])

# Tri
df = df.sort_values(by=["annee", "code_arrondissement"])

output_path = os.path.join(
    output_dir,
    "logements_sociaux_clean.csv"
)

df.to_csv(output_path, index=False, encoding="utf-8")

print("\nDataset logements sociaux Silver créé.")
print(df.head())
print(df.shape)

print("\nFichier sauvegardé ici :")
print(output_path)