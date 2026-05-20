import pandas as pd
import os

project_root = os.path.dirname(__file__)

input_path = os.path.join(
    project_root,
    "..",
    "Data",
    "Revenus",
    "raw",
    "BASE_TD_FILO_IRIS_2021_DEC.csv"
)

output_dir = os.path.join(
    project_root,
    "..",
    "Data",
    "Revenus"
)

os.makedirs(output_dir, exist_ok=True)

# Lecture CSV
df = pd.read_csv(input_path, sep=";", dtype=str)

# Garder uniquement Paris
df = df[df["IRIS"].str.startswith("751", na=False)]

# Colonnes importantes
df = df[[
    "IRIS",
    "DEC_MED21",
    "DEC_TP6021"
]]

# Renommage propre
df = df.rename(columns={
    "IRIS": "code_iris",
    "DEC_MED21": "revenu_median",
    "DEC_TP6021": "taux_pauvrete"
})

# Code arrondissement
df["code_arrondissement"] = df["code_iris"].str[:5]

# Année
df["annee"] = 2021

# Sauvegarde
output_path = os.path.join(
    output_dir,
    "revenus_iris_paris_2021.csv"
)

df.to_csv(output_path, index=False, encoding="utf-8")

# Vérification
print(df.head())
print(df.shape)

print("Fichier sauvegardé ici :")
print(output_path)