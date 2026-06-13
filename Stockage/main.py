import subprocess
import os

project_root = os.path.dirname(__file__)

scripts = [
    "get_dvf.py",
    "get_Logement_sociaux.py",
    "get_loyers.py",
    "get_Pop_insee.py",
    "get_arrondissement.py",
    "get_fraicheur.py",
    "get_transport.py",
    "get_marches.py",
    "get_revenus.py",
]

failed = []

for script in scripts:

    script_path = os.path.join(project_root, "traitement", script)

    print("\n" + "=" * 50)
    print(f"Lancement de : {script}")
    print("=" * 50)

    try:
        subprocess.run(
            ["python", script_path],
            check=True,
            cwd=os.path.join(project_root, "traitement"),
        )
        print(f"{script} terminé avec succès.")

    except subprocess.CalledProcessError as e:
        print(f"Erreur lors de l'exécution de {script}")
        print(e)
        failed.append(script)

print("\n" + "=" * 50)
if not failed:
    print("Tous les scripts Bronze ont été exécutés.")
else:
    print(f"{len(failed)} script(s) en échec :")
    for s in failed:
        print(f"  - {s}")
print("=" * 50)
