import pandas as pd
import os

project_root = os.path.dirname(__file__)

input_path = os.path.join(
    project_root,
    "..",
    "..",
    "Stockage",
    "Data",
    "Revenus",
    "BASE_TD_FILO_IRIS_2021_DEC.csv"
)

output_dir = os.path.join(
    project_root,
    "..",
    "Data",
    "Revenus"
)

os.makedirs(output_dir, exist_ok=True)

print("Lecture du fichier Bronze...")

df = pd.read_csv(
    input_path,
    sep=";",
    dtype=str
)

# Garder uniquement les IRIS de Paris
df = df[df["IRIS"].str.startswith("751", na=False)]

# Garder les colonnes utiles
df = df[[
    "IRIS",
    "DEC_MED21",
    "DEC_TP6021"
]]

# Renommer les colonnes
df = df.rename(columns={
    "IRIS": "code_iris",
    "DEC_MED21": "revenu_median",
    "DEC_TP6021": "taux_pauvrete"
})

# Convertir les virgules françaises en points
df["revenu_median"] = df["revenu_median"].str.replace(",", ".", regex=False)
df["taux_pauvrete"] = df["taux_pauvrete"].str.replace(",", ".", regex=False)

# Conversion numérique
df["revenu_median"] = pd.to_numeric(df["revenu_median"], errors="coerce")
df["taux_pauvrete"] = pd.to_numeric(df["taux_pauvrete"], errors="coerce")

# Code arrondissement
df["code_arrondissement"] = df["code_iris"].str[:5]

# Année
df["annee"] = 2021

# Supprimer seulement les lignes sans revenu médian
df = df.dropna(subset=["revenu_median"])

output_path = os.path.join(
    output_dir,
    "revenus_clean.csv"
)

df.to_csv(output_path, index=False, encoding="utf-8")

print("\nDataset Silver créé.")
print(df.head())
print(df.shape)

print("\nFichier sauvegardé ici :")
print(output_path)