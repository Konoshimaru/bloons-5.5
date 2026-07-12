import os
from PIL import Image

def pad_sprites_to_1000(target_size=(1000, 1000)):
    pasta_atual = os.getcwd()
    # Pasta de output segura para guardares os novos sprites prontos
    pasta_output = os.path.join(pasta_atual, "sprites_prontos_1000")
    
    if not os.path.exists(pasta_output):
        os.makedirs(pasta_output)
        
    print(f"Diretório atual: {pasta_atual}")
    print(f"A exportar sem alterar a escala para: {pasta_output}\n")

    count = 0
    for nome_ficheiro in os.listdir(pasta_atual):
        if nome_ficheiro.lower().endswith('.png') and nome_ficheiro != 'pad_sprites.py':
            caminho_original = os.path.join(pasta_atual, nome_ficheiro)
            caminho_novo = os.path.join(pasta_output, nome_ficheiro)
            
            try:
                with Image.open(caminho_original) as img:
                    if img.mode != 'RGBA':
                        img = img.convert('RGBA')
                    
                    # Pegamos nas dimensões originais de fábrica (ex: 120x150)
                    orig_w, orig_h = img.size
                    
                    # Se por acaso o sprite já for maior que 1000, avisamos (raro)
                    if orig_w > target_size[0] or orig_h > target_size[1]:
                        print(f"⚠ Ficheiro muito grande: {nome_ficheiro} ({orig_w}x{orig_h})")
                        continue

                    # Cria uma nova tela 1000x1000 transparente
                    nova_img = Image.new("RGBA", target_size, (0, 0, 0, 0))
                    
                    # Calcula a posição de colagem para o centro perfeito
                    # Isto APENAS adiciona margens transparentes à volta, NÃO muda o tamanho do macaco
                    x = (target_size[0] - orig_w) // 2
                    y = (target_size[1] - orig_h) // 2
                    
                    # Cola o sprite original de forma direta
                    nova_img.paste(img, (x, y), img)
                    
                    # Guarda na pasta segura
                    nova_img.save(caminho_novo, "PNG")
                    print(f"✓ Moldura expandida: {nome_ficheiro}")
                    count += 1
            except Exception as e:
                print(f"✕ Erro em {nome_ficheiro}: {e}")

    print(f"\nConcluído! {count} imagens processadas na pasta: {pasta_output}")

if __name__ == "__main__":
    pad_sprites_to_1000()
