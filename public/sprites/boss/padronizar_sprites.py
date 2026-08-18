import os
from PIL import Image

def padronizar_sprites_local():
    # Detecta a pasta onde o próprio script está salvo
    pasta_atual = os.path.dirname(os.path.abspath(__file__)) if '__file__' in globals() else os.getcwd()
    
    # Define o caminho da subpasta de saída
    pasta_saida = os.path.join(pasta_atual, "sprites_padronizados")
    
    if not os.path.exists(pasta_saida):
        os.makedirs(pasta_saida)

    # Busca todos os arquivos PNG da pasta atual (ignorando pastas/subpastas)
    arquivos = [
        f for f in os.listdir(pasta_atual)
        if f.lower().endswith('.png') and os.path.isfile(os.path.join(pasta_atual, f))
    ]

    if not arquivos:
        print("Nenhuma imagem PNG encontrada na pasta do script!")
        return

    # Encontra a maior largura e altura entre todos os sprites
    max_w, max_h = 0, 0
    for arq in arquivos:
        caminho_img = os.path.join(pasta_atual, arq)
        try:
            with Image.open(caminho_img) as img:
                w, h = img.size
                if w > max_w: max_w = w
                if h > max_h: max_h = h
        except Exception as e:
            print(f"Aviso: Não foi possível ler {arq}: {e}")

    tamanho_final = (max_w, max_h)
    print(f"Encontrados {len(arquivos)} sprites. Padronizando para {max_w}x{max_h}px...")

    # Processa cada imagem e ajusta o canvas
    for arq in arquivos:
        caminho_img = os.path.join(pasta_atual, arq)
        try:
            with Image.open(caminho_img) as img:
                img = img.convert("RGBA")
                w, h = img.size

                # Cria o novo canvas transparente com a dimensão máxima encontrada
                novo_canvas = Image.new("RGBA", tamanho_final, (0, 0, 0, 0))

                # Posição: Centro na Horizontal, Base na Vertical (pés no chão)
                pos_x = (max_w - w) // 2
                pos_y = max_h - h

                # Cola o sprite no novo canvas
                novo_canvas.paste(img, (pos_x, pos_y), img)

                # Salva o arquivo ajustado dentro da subpasta
                caminho_destino = os.path.join(pasta_saida, arq)
                novo_canvas.save(caminho_destino)
                print(f" OK: {arq}")
        except Exception as e:
            print(f" Erro ao processar {arq}: {e}")

    print(f"\nPronto! Todos os sprites padronizados foram salvos na subpasta:\n{pasta_saida}")

if __name__ == "__main__":
    padronizar_sprites_local()
