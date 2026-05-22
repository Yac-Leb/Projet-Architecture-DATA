import pandas as pd

df = pd.read_csv("Projet-Architecture-DATA\\Bronze\\Data\\Loyer\\Loyer.csv")
df = df.drop(columns=["code_grand_quartier","id_zone","id_quartier","geo_shape"])
df = df.rename(columns={"ref": "Loyers de référence","max": "Loyers de référence majorés", "min": "Loyers de référence minorés"})
print(df)