import pandas as pd
import os

url = "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/logements-sociaux-finances-a-paris/exports/csv?delimiter=%3B&list_separator=%2C&quote_all=false&with_bom=true"

df = pd.read_csv(url, sep=";")

print(df.head())
print(df.shape)

