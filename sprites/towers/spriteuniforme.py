import os
import cv2
import numpy as np
from PIL import Image
import collections

def uniformizar_e_escalar_por_corpo():
    pasta_atual = os.getcwd()
    pasta_output = os.path.join(pasta_atual, "sprites_perfeitos")
    
    if not os.path.exists(pasta_output):
        os.makedirs(pasta_output)

    grupos = collections.defaultdict(list)
    extensoes = ('.png', '.jpg', '.jpeg')
    
    for f in os.listdir(pasta_atual):
        if f.lower().endswith(extensoes) and not f.startswith('script'):
            if '_' in f:
                prefixo = f.rsplit('_', 1)[0]
                grupos[prefixo].append(f)
            else:
                grupos[f.split('.')[0]].append(f)

    for prefixo in grupos:
        grupos[prefixo].sort(key=lambda x: [int(s) if s.isdigit() else s for s in os.path.split(x)[-1].split('_')])

    print(f"Detetados {len(grupos)} grupos de animação.\n")

    for prefixo, ficheiros in grupos.items():
        if len(ficheiros) < 2:
            continue
            
        print(f"➔ A processar grupo com ajuste de escala: {prefixo}")
        
        caminho_ref = os.path.join(pasta_atual, ficheiros[0])
        img_ref_pil = Image.open(caminho_ref).convert('RGBA')
        
        w_ref, h_ref = img_ref_pil.size
        template_box = (int(w_ref*0.25), int(h_ref*0.25), int(w_ref*0.75), int(h_ref*0.75))
        template_pil = img_ref_pil.crop(template_box)
        
        template_cv = cv2.cvtColor(np.array(template_pil), cv2.COLOR_RGBA2GRAY)
        w_temp, h_temp = template_cv.shape[1], template_cv.shape[0]

        dados_alinhados = []
        max_ext_esquerda = 0
        max_ext_direita = 0
        max_ext_cima = 0
        max_ext_baixo = 0

        for nome_ficheiro in ficheiros:
            caminho_item = os.path.join(pasta_atual, nome_ficheiro)
            try:
                img_item_pil = Image.open(caminho_item).convert('RGBA')
                img_item_cv = cv2.cvtColor(np.array(img_item_pil), cv2.COLOR_RGBA2GRAY)
                
                melhor_escala = 1.0
                melhor_val = -1
                melhor_loc = (0, 0)
                
                for escala in np.linspace(0.5, 1.5, 30):
                    largura_teste = int(img_item_pil.size[0] * escala)
                    altura_teste = int(img_item_pil.size[1] * escala)
                    if largura_teste <= w_temp or altura_teste <= h_temp:
                        continue
                        
                    img_redimensionada = cv2.resize(img_item_cv, (largura_teste, altura_teste))
                    res = cv2.matchTemplate(img_redimensionada, template_cv, cv2.TM_CCOEFF_NORMED)
                    _, max_val, _, max_loc = cv2.minMaxLoc(res)
                    
                    if max_val > melhor_val:
                        melhor_val = max_val
                        melhor_escala = escala
                        melhor_loc = max_loc

                nova_largura = int(img_item_pil.size[0] * melhor_escala)
                nova_altura = int(img_item_pil.size[1] * melhor_escala)
                img_escalada_pil = img_item_pil.resize((nova_largura, nova_altura), Image.Resampling.LANCZOS)
                
                # CORRIGIDO: Removido a variável fantasma 'mejor_escala'
                corpo_centro_x = (melhor_loc[0]) + (w_temp / 2)
                corpo_centro_y = (melhor_loc[1]) + (h_temp / 2)
                
                ext_esquerda = corpo_centro_x
                ext_direita = nova_largura - corpo_centro_x
                ext_cima = corpo_centro_y
                ext_baixo = nova_altura - corpo_centro_y
                
                max_ext_esquerda = max(max_ext_esquerda, ext_esquerda)
                max_ext_direita = max(max_ext_direita, ext_direita)
                max_ext_cima = max(max_ext_cima, ext_cima)
                max_ext_baixo = max(max_ext_baixo, ext_baixo)
                
                dados_alinhados.append({
                    'nome': nome_ficheiro,
                    'img': img_escalada_pil,
                    'cx': corpo_centro_x,
                    'cy': corpo_centro_y
                })
                
            except Exception as e:
                print(f"  ✕ Erro ao processar escala de {nome_ficheiro}: {e}")

        if not dados_alinhados:
            continue

        canvas_w = int(max_ext_esquerda + max_ext_direita)
        canvas_h = int(max_ext_cima + max_ext_baixo)
        
        if canvas_w % 2 != 0: canvas_w += 1
        if canvas_h % 2 != 0: canvas_h += 1

        print(f"  ↳ Escala unificada. A gerar novas molduras de {canvas_w}x{canvas_h}...")

        for dado in dados_alinhados:
            canvas_final = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
            
            pos_x = int(max_ext_esquerda - dado['cx'])
            pos_y = int(max_ext_cima - dado['cy'])
            
            canvas_final.paste(dado['img'], (pos_x, pos_y), dado['img'])
            
            nome_saida = dado['nome'].rsplit('.', 1)[0] + ".png"
            canvas_final.save(os.path.join(pasta_output, nome_saida), "PNG")
            
        print(f"  ✓ Grupo '{prefixo}' processado.\n")

    print(f"Concluído! Pasta de saída: {pasta_output}")

if __name__ == "__main__":
    uniformizar_e_escalar_por_corpo()
