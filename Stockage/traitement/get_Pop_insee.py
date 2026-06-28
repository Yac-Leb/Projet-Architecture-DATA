import pandas as pd
from db_connection import get_postgres_engine, create_bronze_schema

url = (
    "https://data.iledefrance.fr/api/explore/v2.1/catalog/datasets/"
    "populations-legales-communes-et-arrondissements-municipaux-millesime-ile-de-fran/"
    "exports/csv?delimiter=%3B&list_separator=%2C&quote_all=false&with_bom=true"
)

df = pd.read_csv(url, sep=";", dtype=str)

engine = get_postgres_engine()
create_bronze_schema(engine)

df.to_sql(
    "population_raw",
    engine,
    schema="bronze",
    if_exists="replace",
    index=False,
    chunksize=10000,
    method="multi",
)

print(f"Table bronze.population_raw créée avec {len(df)} lignes.")
