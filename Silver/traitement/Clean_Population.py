import pandas as pd

df = pd.read_csv("Projet-Architecture-DATA\\Bronze\\Data\\Population\\population.csv")
df = df.drop(columns=['FREQ',"TIME_PERIOD"])
df = df.rename(columns={"GEO": "geo_code","POPREF_MEASURE": "Mesure", "OBS_VALUE_NIVEAU": "population"})
print(df)