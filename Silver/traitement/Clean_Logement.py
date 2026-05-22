import pandas as pd

df = pd.read_csv("Projet-Architecture-DATA\\Bronze\\Data\\Logements_sociaux\\Logements_sociaux.csv")
df = df.drop(columns=["nb_plai","nb_plus","nb_pluscd","nb_pls","coord_x_l93","coord_y_l93","commentaires"])
df = df.rename(columns={"bs": "Bailleur social","nb_logmt_total": "Nombre total de logements financés"})
print(df)