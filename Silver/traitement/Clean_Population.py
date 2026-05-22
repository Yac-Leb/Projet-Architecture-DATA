import pandas as pd
import os

project_root = os.path.dirname(__file__)

input_path = os.path.join(
    project_root,
    "..",
    "..",
    "Stockage",
    "Data",
    "Population",
    "population_arrondissements.csv"
)

output_dir = os.path.join(
    project_root,
    "..",
    "Data",
    "Population"
)

os.makedirs(output_dir, exist_ok=True)

print("Lecture dataset population Bronze...")

df = pd.read_csv(
    input_path,
    sep=",",
    dtype=str
)

# ==========================================
# Garder uniquement Paris
# ==========================================

df = df[
    df["com_arm_code"].str.startswith("751", na=False)
]

# ==========================================
# Colonnes utiles
# ==========================================

df = df[[
    "com_arm_code",
    "com_arm_name",
    "com_arm_pop_mun",
    "geo_year"
]]

# ==========================================
# Renommage
# ==========================================

df = df.rename(columns={
    "com_arm_code": "code_arrondissement",
    "com_arm_name": "nom_arrondissement",
    "com_arm_pop_mun": "population",
    "geo_year": "annee"
})

# ==========================================
# Types numériques
# ==========================================

df["population"] = pd.to_numeric(
    df["population"],
    errors="coerce"
)

df["annee"] = pd.to_numeric(
    df["annee"],
    errors="coerce"
)

# ==========================================
# Suppression nulls
# ==========================================

df = df.dropna(
    subset=["population", "annee"]
)

# ==========================================
# Tri
# ==========================================

df = df.sort_values(
    by=["annee", "code_arrondissement"]
)

# ==========================================
# Sauvegarde Silver
# ==========================================

output_path = os.path.join(
    output_dir,
    "population_clean.csv"
)

df.to_csv(
    output_path,
    index=False,
    encoding="utf-8"
)

# ==========================================
# Vérification
# ==========================================

print("\nDataset population Silver créé.")

print(df.head())

print(df.shape)

print("\nFichier sauvegardé ici :")
print(output_path)