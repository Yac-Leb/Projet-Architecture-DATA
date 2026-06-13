import io
import zipfile
import requests
import pandas as pd
from db_connection import get_postgres_engine, create_bronze_schema

url = "https://www.insee.fr/fr/statistiques/fichier/6036907/indic-struct-distrib-revenu-2019-COMMUNES_csv.zip"

print("Téléchargement revenus INSEE 2019...")
response = requests.get(url, timeout=120)
response.raise_for_status()

with zipfile.ZipFile(io.BytesIO(response.content)) as z:
    with z.open("FILO2019_DISP_COM.csv") as f:
        df = pd.read_csv(f, sep=";", low_memory=False)

engine = get_postgres_engine()
create_bronze_schema(engine)

df.to_sql(
    "revenus_raw",
    engine,
    schema="bronze",
    if_exists="replace",
    index=False,
    chunksize=5000,
    method="multi",
)

print(f"Table bronze.revenus_raw créée avec {len(df)} lignes.")
