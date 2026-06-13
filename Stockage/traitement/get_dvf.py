import io
import requests
import pandas as pd
from db_connection import get_postgres_engine, create_bronze_schema

YEARS = [2021, 2022, 2023, 2024]

frames = []

for year in YEARS:
    url = f"https://files.data.gouv.fr/geo-dvf/latest/csv/{year}/departements/75.csv.gz"
    print(f"Téléchargement DVF Paris {year}...")
    response = requests.get(url, timeout=120)
    response.raise_for_status()
    df = pd.read_csv(io.BytesIO(response.content), compression="gzip", low_memory=False)
    df["annee"] = year
    frames.append(df)
    print(f"  {year} : {len(df)} lignes")

dvf = pd.concat(frames, ignore_index=True)

engine = get_postgres_engine()
create_bronze_schema(engine)

dvf.to_sql(
    "dvf_raw",
    engine,
    schema="bronze",
    if_exists="replace",
    index=False,
    chunksize=10000,
    method="multi",
)

print(f"Table bronze.dvf_raw créée avec {len(dvf)} lignes.")
