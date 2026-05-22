import os
import requests

YEARS = [2021, 2022, 2023, 2024]

project_root = os.path.dirname(__file__)

output_dir = os.path.join(
    project_root,
    "..",
    "Data",
    "DVF",
)

os.makedirs(output_dir, exist_ok=True)

for year in YEARS:
    url = f"https://files.data.gouv.fr/geo-dvf/latest/csv/{year}/departements/75.csv.gz"

    output_path = os.path.join(output_dir, f"dvf_paris_{year}.csv.gz")

    print(f"Téléchargement DVF Paris {year}...")

    response = requests.get(url, timeout=120)
    response.raise_for_status()

    with open(output_path, "wb") as file:
        file.write(response.content)

    print("Sauvegardé ici :", output_path)

print("Téléchargement DVF terminé.")