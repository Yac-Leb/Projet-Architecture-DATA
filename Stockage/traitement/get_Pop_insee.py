import os
import pandas as pd

url = (
    "https://data.iledefrance.fr/api/explore/v2.1/catalog/datasets/"
    "populations-legales-communes-et-arrondissements-municipaux-millesime-ile-de-fran/"
    "exports/csv?delimiter=%3B&list_separator=%2C&quote_all=false&with_bom=true"
)

project_root = os.path.dirname(__file__)

output_dir = os.path.join(
    project_root,
    "..",
    "Data",
    "Population"
)

os.makedirs(output_dir, exist_ok=True)

output_path = os.path.join(output_dir, "population_arrondissements.csv")

df = pd.read_csv(url, sep=";", dtype=str)

df.to_csv(output_path, index=False, encoding="utf-8")

print(df.head())
print(df.shape)
print("Fichier sauvegardé ici :")
print(output_path)