import io
import requests
import pandas as pd
from concurrent.futures import ThreadPoolExecutor, as_completed
from db_connection import get_postgres_engine, create_bronze_schema

YEARS = [2021, 2022, 2023, 2024]


def _telecharger_annee(year):
    url = f"https://files.data.gouv.fr/geo-dvf/latest/csv/{year}/departements/75.csv.gz"
    print(f"Téléchargement DVF Paris {year}...")
    response = requests.get(url, timeout=120)
    response.raise_for_status()
    df = pd.read_csv(io.BytesIO(response.content), compression="gzip", low_memory=False)
    df["annee"] = year
    print(f"  {year} : {len(df)} lignes")
    return df


with ThreadPoolExecutor(max_workers=4) as executor:
    futures = {executor.submit(_telecharger_annee, year): year for year in YEARS}
    frames = [f.result() for f in as_completed(futures)]

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
