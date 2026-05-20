import subprocess
import os

project_root = os.path.dirname(__file__)

scripts = [
    "get_dvf.py",
    "get_Logement_sociaux.py",
    "get_loyers.py",
    "get_Pop_insee.py",
    "get_transport.py"
]

for script in scripts:

    script_path = os.path.join(project_root, "traitement", script)

    print("\n" + "=" * 50)
    print(f"Lancement de : {script}")
    print("=" * 50)

    try:
        subprocess.run(
            ["python", script_path],
            check=True
        )

        print(f"{script} terminé avec succès.")

    except subprocess.CalledProcessError as e:
        print(f"Erreur lors de l'exécution de {script}")
        print(e)

print("\nTous les scripts Bronze ont été exécutés.")