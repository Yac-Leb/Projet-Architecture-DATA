import subprocess
import os

project_root = os.path.dirname(__file__)

scripts = [
    "Clean_Population.py",
    "Clean_Revenus.py",
    "Clean_dvf.py",
    "Clean_Loyer.py",
    "Clean_Logement_social.py",
    "Clean_arrondissement.py",
    "Clean_fraicheur.py",
    "Clean_transport.py",
    "Clean_marches.py",
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
    print("Tous les scripts Silver ont été exécutés.")
else:
    print(f"{len(failed)} script(s) en échec :")
    for s in failed:
        print(f"  - {s}")
print("=" * 50)
