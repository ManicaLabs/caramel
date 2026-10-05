"""============ VOIX FLUIDE : modèle Piper « siwis medium » en poids float16 (v2.2.2) ============
La voix fluide du compagnon (js/core/piper-tts.js) calcule la parole dans le navigateur avec le MÊME modèle que les
clips enregistrés (tools/voix.mjs) : Piper fr_FR-siwis-medium. Le modèle publié pèse 63,2 Mo ; ses poids stockés en
float16 le ramènent à 32,0 Mo, sans changer le calcul (chaque poids est reconverti en float32 par un nœud Cast au
chargement : sortie à 36 dB de rapport signal/bruit de l'original, inaudible — mesures : rapport PT-proto).

  python3 tools/piper-modele.py <fr_FR-siwis-medium.onnx> [dossier de sortie, défaut models/piper]

Étapes (déterministes : même entrée → même fichier, empreinte affichée) :
  1. graphe pré-optimisé hors ligne au niveau BASIC d'onnxruntime (repli des constantes, nœuds inutiles) : ONNX
     standard, accepté par onnxruntime-web ;
  2. chaque initialiseur float32 d'au moins 1 024 valeurs → float16 + Cast(float32) placé en tête du graphe ;
  3. contrôle : session onnxruntime sur le résultat, entrées input / input_lengths / scales.
Le fichier de réglages (.onnx.json, table des phonèmes) est copié tel quel à côté du modèle.

Entrée : huggingface.co/rhasspy/piper-voices, commit c10ece1aade47bb51c153c893d14e5bf8e5b7117, fr/fr_FR/siwis/medium/
(fr_FR-siwis-medium.onnx, sha256 641d1ab0…baf99 ; .onnx.json à côté). Dépendances : `python3 -m venv v &&
v/bin/pip install onnx onnxruntime numpy` (essayé avec onnx 1.23.1, onnxruntime 1.30.0, numpy 2.5.3).
Licences : modèle Piper MIT ; données d'entraînement SIWIS CC BY 4.0 (attribution : README) ; les poids convertis sont
une adaptation (« poids convertis en float16 », crédit dans À propos et dans le README). """
import hashlib
import os
import shutil
import sys
import tempfile

import numpy as np
import onnx
import onnxruntime as ort
from onnx import TensorProto, helper, numpy_helper

MIN_VALUES = 1024


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1 << 20), b''):
            h.update(block)
    return h.hexdigest()


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    src = sys.argv[1]
    out_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'models', 'piper')
    os.makedirs(out_dir, exist_ok=True)
    name = os.path.basename(src)[:-5]                       # fr_FR-siwis-medium
    dst = os.path.join(out_dir, name + '-f16.onnx')
    cfg_src, cfg_dst = src + '.json', dst + '.json'
    if not os.path.exists(cfg_src):
        sys.exit('réglages introuvables : ' + cfg_src)

    with tempfile.TemporaryDirectory() as tmp:
        opt = os.path.join(tmp, 'opt.onnx')
        so = ort.SessionOptions()
        so.intra_op_num_threads = 1
        so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
        so.optimized_model_filepath = opt
        ort.InferenceSession(src, so, providers=['CPUExecutionProvider'])

        m = onnx.load(opt)
        g = m.graph
        inits, casts, n = [], [], 0
        for init in g.initializer:
            if init.data_type == TensorProto.FLOAT and int(np.prod(init.dims)) >= MIN_VALUES:
                half = numpy_helper.from_array(numpy_helper.to_array(init).astype(np.float16), init.name + '__f16')
                inits.append(half)
                casts.append(helper.make_node('Cast', [half.name], [init.name], to=TensorProto.FLOAT, name=init.name + '__cast'))
                n += 1
            else:
                inits.append(init)
        del g.initializer[:]
        g.initializer.extend(inits)
        nodes = list(g.node)
        del g.node[:]
        g.node.extend(casts + nodes)
        onnx.save(m, dst)

    s = ort.InferenceSession(dst, providers=['CPUExecutionProvider'])
    names = [i.name for i in s.get_inputs()]
    if names[:3] != ['input', 'input_lengths', 'scales']:
        sys.exit('entrées inattendues : ' + ', '.join(names))
    shutil.copyfile(cfg_src, cfg_dst)
    print(f'✓ {dst} : {os.path.getsize(dst):,} octets ({n} poids en float16), sha256 {sha256(dst)}'.replace(',', ' '))
    print(f'✓ {cfg_dst} : {os.path.getsize(cfg_dst):,} octets'.replace(',', ' '))


if __name__ == '__main__':
    main()
