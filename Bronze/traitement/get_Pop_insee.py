import pandas as pd
import json
import requests
import os

api_url = "https://api.insee.fr/melodi/data/DS_POPULATIONS_REFERENCE"

get_data = requests.get(api_url, verify= False)
data_from_net = get_data.content
data = json.loads(data_from_net)

# Extraction des informations du jeu de données
title = data['title']['fr']
identifier = data['identifier']

#Extraction des observations du jeu de données filtré, sur lesquelles on va boucler
observations = data['observations']
extracted_data = []

#Boucle de lecture des observations dans le json 
for obs in observations:
    dimensions = obs['dimensions']
    
    # Suivant les jeux de données attributes est présent ou non
    if 'attributes' in obs:
        attributes = obs['attributes']
    else:
        attributes = None

    # Suivant les jeux de données value peut être absent
    if 'value' in obs['measures']['OBS_VALUE_NIVEAU']:
        measures = obs['measures']['OBS_VALUE_NIVEAU']['value']
    else:
        mesures = None
    
    # on rassemble tout dans un objet
    if 'attributes' in obs:
        combined_data = {**dimensions,**attributes, 'OBS_VALUE_NIVEAU': measures}
    else:
        combined_data = {**dimensions, 'OBS_VALUE_NIVEAU': measures}
    
    extracted_data.append(combined_data)

#Création d'un dataframe python
df = pd.DataFrame(extracted_data)
#exportation des données dans leurs fichier
project_root = os.path.dirname(__file__)  # script location
output_path = os.path.join(project_root, "..", "Data","Population", "population.csv")

os.makedirs(os.path.dirname(output_path), exist_ok=True)

df.to_csv(output_path, index=False)

#print(f'Jeu de données : {identifier} \nTitre : {title} ')
#print(df)


