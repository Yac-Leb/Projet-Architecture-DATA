import pandas as pd
import os

url = "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/logement-encadrement-des-loyers/exports/csv?delimiter=%3B&list_separator=%2C&quote_all=false&with_bom=true"

df = pd.read_csv(url, sep=";")

#print(df.head())
#print(df.shape)

project_root = os.path.dirname(__file__)  # script location
output_path = os.path.join(project_root, "..","Data", "Loyer", "loyer.csv")
os.makedirs(os.path.dirname(output_path), exist_ok=True)
df.to_csv(output_path, index=False)

print("Saved here:", output_path)