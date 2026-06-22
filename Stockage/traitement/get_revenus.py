import io
import zipfile
import requests
import pandas as pd
from db_connection import get_postgres_engine, create_bronze_schema

url = "https://www.insee.fr/fr/statistiques/fichier/6036907/indic-struct-distrib-revenu-2019-COMMUNES_csv.zip"

print("Téléchargement revenus INSEE 2019...")
response = requests.get(url, timeout=300, stream=True)
response.raise_for_status()

total = int(response.headers.get("content-length", 0))
buffer = io.BytesIO()
downloaded = 0
for chunk in response.iter_content(chunk_size=1024 * 1024):
    buffer.write(chunk)
    downloaded += len(chunk)
    if total:
        print(f"\r  {downloaded / 1e6:.1f} / {total / 1e6:.1f} Mo ({downloaded / total * 100:.0f}%)", end="", flush=True)
print()

buffer.seek(0)
with zipfile.ZipFile(buffer) as z:
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
