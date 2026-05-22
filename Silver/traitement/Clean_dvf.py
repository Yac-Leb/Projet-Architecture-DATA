import pandas as pd
import os
import glob

project_root = os.path.dirname(__file__)

input_dir = os.path.join(
    project_root,
    "..",
    "..",
    "Stockage",
    "Data",
    "DVF"
)

output_dir = os.path.join(
    project_root,
    "..",
    "Data",
    "DVF"
)

os.makedirs(output_dir, exist_ok=True)

files = glob.glob(os.path.join(input_dir, "dvf_paris_*.csv.gz"))

all_data = []

for file_path in files:
    print("\nLecture :", file_path)

    df = pd.read_csv(
        file_path,
        compression="gzip",
        dtype=str,
        low_memory=False
    )

    print("Colonnes disponibles :")
    print(df.columns.tolist())
    print("Shape brute :", df.shape)

    year = os.path.basename(file_path).split("_")[-1].replace(".csv.gz", "")

    columns_to_keep = [
        "id_mutation",
        "date_mutation",
        "nature_mutation",
        "valeur_fonciere",
        "adresse_numero",
        "adresse_nom_voie",
        "code_postal",
        "code_commune",
        "nom_commune",
        "type_local",
        "surface_reelle_bati",
        "nombre_pieces_principales",
        "surface_terrain",
        "longitude",
        "latitude"
    ]

    existing_columns = [col for col in columns_to_keep if col in df.columns]
    df = df[existing_columns]

    df["annee"] = int(year)

    all_data.append(df)

if all_data:
    final_df = pd.concat(all_data, ignore_index=True)

    # Nettoyage valeurs numériques
    numeric_cols = [
        "valeur_fonciere",
        "surface_reelle_bati",
        "nombre_pieces_principales",
        "surface_terrain",
        "longitude",
        "latitude"
    ]

    for col in numeric_cols:
        if col in final_df.columns:
            final_df[col] = (
                final_df[col]
                .astype(str)
                .str.replace(",", ".", regex=False)
            )
            final_df[col] = pd.to_numeric(final_df[col], errors="coerce")

    # Garder uniquement les ventes
    if "nature_mutation" in final_df.columns:
        final_df = final_df[final_df["nature_mutation"] == "Vente"]

    # Garder uniquement appartements / maisons
    if "type_local" in final_df.columns:
        final_df = final_df[
            final_df["type_local"].isin(["Appartement", "Maison"])
        ]

    # Supprimer les lignes inutilisables pour prix/m²
    final_df = final_df.dropna(
        subset=["valeur_fonciere", "surface_reelle_bati"]
    )

    final_df = final_df[final_df["surface_reelle_bati"] > 0]
    final_df = final_df[final_df["valeur_fonciere"] > 0]

    # Calcul prix au m²
    final_df["prix_m2"] = (
        final_df["valeur_fonciere"] / final_df["surface_reelle_bati"]
    )

    # Filtrer valeurs aberrantes
    final_df = final_df[
        (final_df["prix_m2"] >= 1000) &
        (final_df["prix_m2"] <= 50000)
    ]

    # Code arrondissement
    final_df["code_arrondissement"] = final_df["code_postal"]

    output_path = os.path.join(output_dir, "dvf_paris_clean.csv")

    final_df.to_csv(
        output_path,
        index=False,
        encoding="utf-8"
    )

    print("\nDataset DVF Silver créé.")
    print(final_df.head())
    print(final_df.shape)
    print("Fichier sauvegardé ici :", output_path)

else:
    print("Aucun fichier DVF trouvé.")