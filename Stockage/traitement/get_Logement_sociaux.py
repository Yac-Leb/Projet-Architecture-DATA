import pandas as pd
from db_connection import get_postgres_engine, create_bronze_schema

url = (
    "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/"
    "logements-sociaux-finances-a-paris/exports/csv"
    "?delimiter=%3B&list_separator=%2C&quote_all=false&with_bom=true"
)

df = pd.read_csv(url, sep=";")

engine = get_postgres_engine()
create_bronze_schema(engine)

df.to_sql(
    "logements_sociaux_raw",
    engine,
    schema="bronze",
    if_exists="replace",
    index=False,
    chunksize=10000,
    method="multi",
)

print(f"Table bronze.logements_sociaux_raw créée avec {len(df)} lignes.")
